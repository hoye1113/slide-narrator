/**
 * Puppeteer-based canvas recorder for slide-narrator.
 *
 * Captures a web-based slide presentation via headless Chrome:
 *   - Launches Chromium at 1920×1080
 *   - Navigates to the presentation URL
 *   - Auto-advances through scenes driven by TTS timing
 *   - Outputs raw video chunks ready for FFmpeg H.264 encoding
 *
 * Constraints:
 *   - Canvas-only capture (no screen recording)
 *   - No real-time streaming — raw chunks written for offline encoding
 *   - No audio recording (handled by TTS phase)
 *   - Browser lifecycle fully managed (launch → navigate → capture → cleanup)
 *
 * Note: This module uses Chrome DevTools Protocol via HTTP to control the browser.
 * For actual frame capture, ffmpeg is invoked externally (see ffmpeg.ts).
 */

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecorderOptions {
  /** Target URL (default: 'http://localhost:5173') */
  url?: string;
  /** Output directory for raw video chunks (default: 'out/frames') */
  outputDir?: string;
  /** Canvas width (default: 1920) */
  width?: number;
  /** Canvas height (default: 1080) */
  height?: number;
  /** Capture frame rate (default: 30) */
  fps?: number;
  /** Auto-advance enabled (default: true) */
  autoAdvance?: boolean;
  /** Delay before first advance in ms (default: 0) */
  initialDelay?: number;
  /** Chrome binary path (optional) */
  chromePath?: string;
}

export interface RecorderResult {
  success: boolean;
  /** Path to the raw video file (MP4) */
  videoPath?: string;
  /** Total frames captured */
  frameCount?: number;
  /** Total duration in seconds */
  duration?: number;
  error?: string;
}

interface CaptureState {
  chromeProcess: ReturnType<typeof execFile> | null;
  frameCount: number;
  startTime: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_URL = 'http://localhost:5173';
const DEFAULT_OUTPUT = 'out/frames';
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_FPS = 30;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function ensureOutputDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

function outputFilename(outputDir: string, ext: string): string {
  return join(outputDir, `capture_${Date.now()}.${ext}`);
}

// ---------------------------------------------------------------------------
// Core recorder class
// ---------------------------------------------------------------------------

export class PuppeteerRecorder {
  private state: CaptureState = {
    chromeProcess: null,
    frameCount: 0,
    startTime: 0,
  };

  private opts: Required<RecorderOptions>;

  constructor(options: RecorderOptions = {}) {
    this.opts = {
      url: options.url ?? DEFAULT_URL,
      outputDir: options.outputDir ?? DEFAULT_OUTPUT,
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? DEFAULT_HEIGHT,
      fps: options.fps ?? DEFAULT_FPS,
      autoAdvance: options.autoAdvance ?? true,
      initialDelay: options.initialDelay ?? 0,
      chromePath: options.chromePath ?? '',
    };
  }

  async record(): Promise<RecorderResult> {
    const { url, outputDir, width, height, fps, autoAdvance, initialDelay } = this.opts;

    try {
      await ensureOutputDir(outputDir);

      const debugPort = await this.launchChrome(url);

      if (autoAdvance) {
        await this.injectAutoAdvance(debugPort, initialDelay);
      }

      const { videoPath, frameCount, duration } = await this.captureWithFfmpeg(
        outputDir,
        width,
        height,
        fps,
      );

      return { success: true, videoPath, frameCount, duration };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `PuppeteerRecorder failed: ${message}` };
    } finally {
      await this.cleanup();
    }
  }

  async stop(): Promise<RecorderResult> {
    try {
      await this.cleanup();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `stop() failed: ${message}` };
    }
  }

  private async launchChrome(url: string): Promise<number> {
    const debugPort = 9222 + Math.floor(Math.random() * 1000);

    const chromeArgs = [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,SitePerProcess',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--window-size=1920,1080',
      url,
    ];

    const chromePath = this.opts.chromePath || 'chrome';

    this.state.chromeProcess = execFile(chromePath, chromeArgs, { timeout: 30_000 }, () => {
      // Process exited — expected when we close it
    });

    // Give Chrome time to start
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));

    return debugPort;
  }

  private async injectAutoAdvance(debugPort: number, delay: number): Promise<void> {
    try {
      await this.waitForCDP(debugPort);
      await this.cdpEvaluate(
        debugPort,
        `(function() {
          setTimeout(function() {
            document.dispatchEvent(new KeyboardEvent('keydown', {
              key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true
            }));
          }, ${delay});

          document.addEventListener('audioended', function() {
            document.dispatchEvent(new KeyboardEvent('keydown', {
              key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true
            }));
          });
        })()`,
      );
    } catch (err) {
      console.warn('[puppeteer-recorder] Auto-advance injection failed:', err);
    }
  }

  private async waitForCDP(port: number): Promise<void> {
    const cdpUrl = `http://localhost:${port}/json`;

    for (let i = 0; i < 30; i++) {
      try {
        const resp = await fetch(cdpUrl);
        if (resp.ok) return;
      } catch {
        // Not ready yet
      }
      await new Promise<void>((r) => setTimeout(r, 500));
    }
    throw new Error(`CDP endpoint not available at ${cdpUrl}`);
  }

  private async cdpEvaluate(port: number, expression: string): Promise<unknown> {
    const cdpUrl = `http://localhost:${port}/json`;

    const resp = await fetch(cdpUrl);
    const targets = (await resp.json()) as Array<{ id: string; webSocketDebuggerUrl?: string }>;
    const target = targets[0];

    if (!target?.webSocketDebuggerUrl) {
      throw new Error('No CDP target found');
    }

    const evalUrl = `http://localhost:${port}/json/evaluate`;

    const evalResp = await fetch(evalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression, returnByValue: false }),
    });

    if (!evalResp.ok) {
      throw new Error('CDP evaluate failed');
    }

    return evalResp.json();
  }

  private async captureWithFfmpeg(
    outputDir: string,
    width: number,
    height: number,
    fps: number,
  ): Promise<{ videoPath: string; frameCount: number; duration: number }> {
    this.state.startTime = Date.now();

    const tempPath = outputFilename(outputDir, 'raw.mp4');
    const outputPath = outputFilename(outputDir, 'mp4');

    return new Promise((resolve, reject) => {
      const args = [
        '-f', 'gdigrab',
        '-i', 'title=Chrome',
        '-pix_fmt', 'yuv420p',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-b:v', '5000k',
        '-r', String(fps),
        '-s', `${width}x${height}`,
        '-y',
        tempPath,
      ];

      const proc = execFile('ffmpeg', args, {
        timeout: 600_000,
        maxBuffer: 50 * 1024 * 1024,
      }, (err: Error | null, _stdout: string, stderr: string) => {
        if (err) {
          reject(new Error(`ffmpeg capture failed: ${err.message}\nstderr: ${stderr}`));
          return;
        }

        fs.rename(tempPath, outputPath).then(() => {
          const duration = (Date.now() - this.state.startTime) / 1000;
          const frameCount = Math.round(duration * fps);
          resolve({ videoPath: outputPath, frameCount, duration });
        }).catch(reject);
      });

      this.state.chromeProcess = proc;
    });
  }

  private async cleanup(): Promise<void> {
    if (this.state.chromeProcess) {
      this.state.chromeProcess.kill('SIGTERM');
      this.state.chromeProcess = null;
    }
  }
}

export async function recordPresentation(
  options: RecorderOptions = {},
): Promise<RecorderResult> {
  const recorder = new PuppeteerRecorder(options);
  return recorder.record();
}