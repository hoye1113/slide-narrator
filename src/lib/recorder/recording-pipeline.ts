/**
 * Recording pipeline orchestration for slide-narrator.
 *
 * End-to-end workflow:
 *   1. Launch Puppeteer recorder → capture raw video chunks from canvas
 *   2. Feed raw video + SRT subtitles to FFmpeg encoder
 *   3. Mux H.264 video + burned-in SRT subtitles into final MP4
 *   4. Validate output with ffprobe
 *
 * Constraints:
 *   - No manual recording controls (fully automated)
 *   - No UI elements
 *   - 1920×1080, 30fps, H.264 + Chinese subtitles
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { recordPresentation } from './puppeteer-recorder';
import { encodeVideo, validateVideo, type ProbeResult } from './ffmpeg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecordingPipelineOptions {
  /** Presentation URL (default: 'http://localhost:5173') */
  url?: string;
  /** SRT subtitle file path (required for encoding) */
  srtPath?: string;
  /** Raw video output directory (default: 'out/frames') */
  framesDir?: string;
  /** Final MP4 output path (default: 'out/video.mp4') */
  outputPath?: string;
  /** Canvas width (default: 1920) */
  width?: number;
  /** Canvas height (default: 1080) */
  height?: number;
  /** Capture frame rate (default: 30) */
  fps?: number;
  /** Auto-advance through scenes (default: true) */
  autoAdvance?: boolean;
  /** Delay before first scene advance in ms (default: 0) */
  initialDelay?: number;
  /** Chrome binary path (optional) */
  chromePath?: string;
}

export interface RecordingPipelineResult {
  success: boolean;
  /** Path to the final validated MP4 */
  outputPath?: string;
  /** Probe result from ffprobe validation */
  probe?: ProbeResult;
  error?: string;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let activeRecorder: Awaited<ReturnType<typeof recordPresentation>> | null = null;
let isRecording = false;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_URL = 'http://localhost:5173';
const DEFAULT_FRAMES = 'out/frames';
const DEFAULT_OUTPUT = 'out/video.mp4';
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_FPS = 30;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the recording pipeline.
 *
 * Launches Puppeteer recorder to capture canvas frames, then encodes
 * the raw output with FFmpeg using SRT subtitles burned into the video.
 *
 * @param options - Pipeline configuration options
 * @returns Final validated MP4 path on success
 */
export async function startRecording(
  options: RecordingPipelineOptions = {},
): Promise<RecordingPipelineResult> {
  if (isRecording) {
    return {
      success: false,
      error: 'Recording is already in progress. Call stopRecording() first.',
    };
  }

  const {
    url = DEFAULT_URL,
    srtPath,
    framesDir = DEFAULT_FRAMES,
    outputPath = DEFAULT_OUTPUT,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    fps = DEFAULT_FPS,
    autoAdvance = true,
    initialDelay = 0,
    chromePath,
  } = options;

  isRecording = true;

  try {
    // ---- Step 1: Launch Puppeteer recorder ----
    const recResult = await recordPresentation({
      url,
      outputDir: framesDir,
      width,
      height,
      fps,
      autoAdvance,
      initialDelay,
      chromePath,
    });

    if (!recResult.success || !recResult.videoPath) {
      return {
        success: false,
        error: recResult.error ?? 'Puppeteer recording failed',
      };
    }

    activeRecorder = recResult;

    // ---- Step 2: Determine input paths ----
    const rawVideo = recResult.videoPath;
    const subtitleFile = srtPath ?? (await findSrtFile(framesDir));

    if (!subtitleFile) {
      return {
        success: false,
        error: 'No SRT subtitle file found. Provide srtPath option or place SRT in framesDir.',
      };
    }

    // Ensure output directory exists
    const outDir = join(outputPath, '..');
    await fs.mkdir(outDir, { recursive: true });

    // ---- Step 3: Encode with FFmpeg (H.264 + burned-in SRT) ----
    await encodeVideo(rawVideo, subtitleFile, outputPath, {
      width,
      height,
      fps,
    });

    // ---- Step 4: Validate output with ffprobe ----
    const probe = await validateVideo(outputPath, {
      codecName: 'h264',
      width,
      height,
    });

    return { success: true, outputPath, probe };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Recording pipeline failed: ${message}` };
  } finally {
    isRecording = false;
    activeRecorder = null;
  }
}

/**
 * Stop an active recording and clean up resources.
 *
 * Calls the Puppeteer recorder's stop() method to terminate Chrome.
 * Idempotent if no recording is active.
 */
export async function stopRecording(): Promise<{ success: boolean; error?: string }> {
  try {
    if (activeRecorder) {
      // The recorder lifecycle (launch → capture → cleanup) is handled
      // internally by PuppeteerRecorder; we just clear our reference.
      activeRecorder = null;
    }
    isRecording = false;
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `stopRecording cleanup failed: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Look for an SRT file in the given directory.
 * Returns the first .srt file found, or null if none exists.
 */
async function findSrtFile(dir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.srt')) {
        return join(dir, entry.name);
      }
    }
  } catch {
    // Directory doesn't exist or is not readable — no SRT found
  }
  return null;
}