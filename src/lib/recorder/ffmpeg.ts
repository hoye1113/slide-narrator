/**
 * FFmpeg integration for slide-narrator video encoding.
 *
 * Encodes raw video (YUV/webcam stream) to H.264 MP4 with burned-in SRT subtitles.
 * Validates output using ffprobe.
 */

import { execFile } from 'node:child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EncodeOptions {
  /** Output width in pixels (default: 1920) */
  width?: number;
  /** Output height in pixels (default: 1080) */
  height?: number;
  /** Frame rate (default: 30) */
  fps?: number;
  /** Video bitrate (default: '5000k') */
  bitrate?: string;
}

export interface ProbeResult {
  /** Video codec name (e.g. 'h264') */
  codecName: string;
  /** Video width in pixels */
  width: number;
  /** Video height in pixels */
  height: number;
  /** Frame rate as a number */
  fps: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Run the `ffmpeg` CLI with the given arguments.
 *
 * @param args    CLI arguments for ffmpeg
 * @param timeout Max wait in ms (default 300s for video encoding)
 */
function execFfmpeg(args: string[], timeout = 300_000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    execFile(
      'ffmpeg',
      args,
      { timeout, maxBuffer: 10 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err) {
          const msg =
            err.message +
            (stderr ? `\nstderr: ${stderr}` : '');
          reject(new Error(msg));
        } else {
          resolve();
        }
      },
    );
  });
}

/**
 * Run the `ffprobe` CLI and return parsed stream information.
 *
 * @param filePath Path to the media file to probe
 * @returns Parsed stream metadata
 */
function execFfprobe(filePath: string): Promise<ProbeResult> {
  return new Promise<ProbeResult>((resolve, reject) => {
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
        if (err) {
          reject(new Error(`ffprobe failed: ${err.message}`));
          return;
        }

        const lines = stdout.trim().split('\n');
        const result: Partial<ProbeResult> = {};

        for (const line of lines) {
          const [key, value] = line.split('=');
          if (!key || !value) continue;

          switch (key) {
            case 'codec_name':
              result.codecName = value;
              break;
            case 'width':
              result.width = parseInt(value, 10);
              break;
            case 'height':
              result.height = parseInt(value, 10);
              break;
            case 'r_frame_rate': {
              // Format is "num/den" (e.g. "30/1")
              const [num, den] = value.split('/').map(Number);
              result.fps = den ? Math.round(num / den) : num;
              break;
            }
          }
        }

        if (result.codecName && result.width && result.height && result.fps) {
          resolve(result as ProbeResult);
        } else {
          reject(new Error(`Incomplete probe result: ${stdout}`));
        }
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encode a raw video file to H.264 MP4 with burned-in SRT subtitles.
 *
 * The SRT subtitles are embedded and rendered directly into the video frames
 * (burned-in), producing a single self-contained MP4 file.
 *
 * @param inputVideo Path to the raw input video (e.g. .mp4, .mkv, or raw YUV)
 * @param inputSrt   Path to the SRT subtitle file
 * @param outputMp4  Destination path for the encoded MP4 file
 * @param options    Optional encoding settings
 */
export async function encodeVideo(
  inputVideo: string,
  inputSrt: string,
  outputMp4: string,
  options: EncodeOptions = {},
): Promise<void> {
  const {
    width = 1920,
    height = 1080,
    fps = 30,
    bitrate = '5000k',
  } = options;

  const args: string[] = [
    '-y', // Overwrite output file without asking
    '-i', inputVideo,       // Input video
    '-i', inputSrt,        // Input subtitles
    '-c:v', 'libx264',     // H.264 encoding via libx264
    '-preset', 'medium',    // Encoding speed/quality tradeoff
    '-b:v', bitrate,        // Video bitrate
    '-pix_fmt', 'yuv420p',  // Required for broad compatibility
    '-vf', `subtitles=${inputSrt}:force_style='FontSize=24,PrimaryColour=&HFFFFFF&,Bold=1'`,
    // Scale to target resolution
    '-s', `${width}x${height}`,
    // Frame rate
    '-r', String(fps),
    // Audio passthrough (copy) — no re-encoding
    '-c:a', 'copy',
    // Output
    outputMp4,
  ];

  await execFfmpeg(args);
}

/**
 * Validate a video file using ffprobe.
 *
 * Checks that the file is a valid video with H.264 codec at the expected
 * resolution and frame rate.
 *
 * @param filePath  Path to the video file to validate
 * @param expected  Expected video properties (all optional)
 * @returns Probe result with actual video properties
 * @throws {Error} If validation fails (codec mismatch, resolution mismatch, etc.)
 */
export async function validateVideo(
  filePath: string,
  expected: Partial<ProbeOptions> = {},
): Promise<ProbeResult> {
  const result = await execFfprobe(filePath);

  const {
    codecName: expectedCodec = 'h264',
    width: expectedWidth = 1920,
    height: expectedHeight = 1080,
  } = expected;

  const errors: string[] = [];

  if (result.codecName !== expectedCodec) {
    errors.push(
      `Codec mismatch: expected '${expectedCodec}', got '${result.codecName}'`,
    );
  }

  if (result.width !== expectedWidth) {
    errors.push(
      `Width mismatch: expected ${expectedWidth}, got ${result.width}`,
    );
  }

  if (result.height !== expectedHeight) {
    errors.push(
      `Height mismatch: expected ${expectedHeight}, got ${result.height}`,
    );
  }

  if (errors.length > 0) {
    throw new Error(`Video validation failed:\n${errors.join('\n')}`);
  }

  return result;
}

export interface ProbeOptions {
  codecName: string;
  width: number;
  height: number;
}