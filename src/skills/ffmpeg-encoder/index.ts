import type { SkillResult } from '../types';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';

export interface FfmpegEncoderOutput {
  outputPath: string;
  duration: number;
  probeInfo?: {
    codecName: string;
    width: number;
    height: number;
    fps: number;
  };
}

function execFfmpeg(args: string[], timeout = 600_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'ffmpeg',
      args,
      { timeout, maxBuffer: 50 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err) {
          reject(new Error(`ffmpeg error: ${err.message}\nstderr: ${stderr}`));
        } else {
          resolve('done');
        }
      },
    );
  });
}

async function execFfprobe(filePath: string): Promise<Record<string, string | number>> {
  return new Promise((resolve, reject) => {
    execFile(
      'ffprobe',
      [
        '-v', 'error',
        '-show_entries', 'stream=codec_name,width,height,r_frame_rate',
        '-of', 'default=noprint_wrappers=1',
        filePath,
      ],
      { timeout: 30_000 },
      (err, stdout) => {
        if (err) return reject(new Error(`ffprobe failed: ${err.message}`));
        const result: Record<string, string | number> = {};
        for (const line of stdout.trim().split('\n')) {
          const [key, value] = line.split('=');
          if (key && value) result[key] = value;
        }
        resolve(result);
      },
    );
  });
}

export async function execute(
  params: Record<string, unknown>,
  _context?: Record<string, unknown>,
): Promise<SkillResult> {
  const framesDir = (params.frames as string) ?? 'out/frames';
  const audioDir = (params.audio as string) ?? 'out/audio';
  const srtPath = params.subtitles as string | undefined;
  const outputPath = (params.output as string) ?? 'out/video.mp4';

  // These skills require Node.js — refuse to run in browser environments
  let cwd: string;
  try {
    // eslint-disable-next-line no-unused-expressions
    cwd = process.cwd();
  } catch {
    return {
      success: false,
      error: 'ffmpeg-encoder requires a Node.js environment (process.cwd() unavailable in browser)',
    };
  }

  try {
    // Find input video/frame file
    let inputPath = join(cwd, framesDir);
    try {
      const entries = await fs.readdir(join(cwd, framesDir));
      const videoFile = entries.find(
        (f) => f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.raw'),
      );
      if (videoFile) {
        inputPath = join(cwd, framesDir, videoFile);
      }
    } catch {
      // frames dir may not exist yet
    }

    const finalOutput = join(cwd, outputPath);
    await fs.mkdir(dirname(finalOutput), { recursive: true });

    // Build FFmpeg arguments
    const args: string[] = ['-y'];

    // Input video
    args.push('-i', inputPath);

    // Input audio if available
    try {
      const audioEntries = await fs.readdir(join(cwd, audioDir));
      const audioFile = audioEntries.find((f) => f.endsWith('.mp3') || f.endsWith('.wav'));
      if (audioFile) {
        args.push('-i', join(cwd, audioDir, audioFile));
      }
    } catch {
      // No audio dir
    }

    // Video encoding
    args.push(
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-b:v', '5000k',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-s', '1920x1080',
    );

    // Subtitle burning (if SRT provided)
    if (srtPath) {
      const escaped = srtPath.replace(/([\\,:=;])/g, '\\$1');
      args.push(
        '-vf', `subtitles=${escaped}:force_style='FontSize=24,PrimaryColour=&HFFFFFF&,Bold=1'`,
      );
    }

    // Audio passthrough or default
    args.push('-c:a', 'aac', '-b:a', '192k');

    // Output
    args.push(finalOutput);

    await execFfmpeg(args);

    // Probe result
    let probeInfo: FfmpegEncoderOutput['probeInfo'];
    try {
      const probe = await execFfprobe(finalOutput);
      const r_frame_rate = String(probe.r_frame_rate ?? '30/1');
      const [num, den] = r_frame_rate.split('/').map(Number);
      probeInfo = {
        codecName: String(probe.codec_name ?? 'h264'),
        width: Number(probe.width ?? 1920),
        height: Number(probe.height ?? 1080),
        fps: (() => {
          const parts = String(probe.r_frame_rate ?? '30/1').split('/');
          const num = Number(parts[0]) || 30;
          const den = parts[1] ? Number(parts[1]) : 1;
          return den === 1 ? num : Math.round(num / den);
        })(),
      };
    } catch {
      // probe optional
    }

    return {
      success: true,
      data: {
        outputPath: finalOutput,
        duration: 0,
        probeInfo,
      } as FfmpegEncoderOutput,
      metadata: {
        skill: 'ffmpeg-encoder',
        inputPath,
        outputPath: finalOutput,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `FFmpeg encoding failed: ${message}`,
    };
  }
}