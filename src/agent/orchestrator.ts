/**
 * Orchestrator — high-level pipeline runner for slide-narrator.
 *
 * Executes the sequential pipeline:
 *   script → outline → slides → TTS → recording
 *
 * Each phase invokes skill(s) via the registry, saves state into the
 * PipelineStore (Zustand), and reports progress to the UI.
 *
 * Errors are handled gracefully — the pipeline continues after a
 * phase failure, collecting errors for later inspection.
 *
 * Constraints:
 *   - Sequential execution only (no parallel phases)
 *   - No manual confirmation steps (auto-flow)
 *   - State saved after each phase
 */

import { usePipelineStore } from '../lib/pipeline/store';
import type {
  PipelineStore,
  Phase,
} from '../lib/pipeline/store';
import { invokeSkill } from '../skills/registry';

// ---------------------------------------------------------------------------
// Phase definitions — ordered list matching PipelineStore's Phase union
// ---------------------------------------------------------------------------

const PHASES: readonly Phase[] = [
  'CONTENT_AUTHORING',
  'WEB_DEV_CH1',
  'WEB_DEV_CH2N',
  'AUDIO_SYNTHESIS',
  'RECORDING',
];

// ---------------------------------------------------------------------------
// Progress reporting
// ---------------------------------------------------------------------------

/** Progress snapshot emitted after each phase step. */
export interface PipelineProgress {
  phase: Phase;
  phaseIndex: number; // 0-based
  totalPhases: number;
  status: 'running' | 'completed' | 'failed';
  message: string;
  /** Additional structured data from the phase (script, outline, etc.) */
  data?: unknown;
}

/** Callback invoked after each phase completes (or fails). */
export type ProgressCallback = (progress: PipelineProgress) => void;

/** Aggregate result of the full pipeline run. */
export interface PipelineResult {
  success: boolean;
  script: string | null;
  outline: string | null;
  errors: string[];
  completedPhases: number;
}

// ---------------------------------------------------------------------------
// Pipeline options
// ---------------------------------------------------------------------------

export interface PipelineOptions {
  /** Visual theme ID for slide generation (default: 'paper-press') */
  theme?: string;
  /** Voice ID for TTS synthesis (default: 'Chinese_male_wanwan') */
  voice?: string;
  /** Optional progress callback for UI updates */
  onProgress?: ProgressCallback;
}

// ---------------------------------------------------------------------------
// Store helpers (direct Zustand access — no React hook needed)
// ---------------------------------------------------------------------------

function readStore(): PipelineStore {
  return usePipelineStore.getState();
}

function patchStore(partial: Partial<PipelineStore>): void {
  usePipelineStore.setState(partial);
}

// ---------------------------------------------------------------------------
// Internal: emit progress event
// ---------------------------------------------------------------------------

function emit(
  phase: Phase,
  idx: number,
  status: PipelineProgress['status'],
  message: string,
  data?: unknown,
  onProgress?: ProgressCallback,
): PipelineProgress {
  const progress: PipelineProgress = {
    phase,
    phaseIndex: idx,
    totalPhases: PHASES.length,
    status,
    message,
    data,
  };
  onProgress?.(progress);
  return progress;
}

// ---------------------------------------------------------------------------
// Internal: record a phase result in the store
// ---------------------------------------------------------------------------

function recordPhaseResult(
  phase: Phase,
  skillName: string,
  success: boolean,
  output: unknown,
  error?: string,
): void {
  const s = readStore();
  s.addPhaseResult(phase, {
    skillName,
    success,
    output,
    error,
    timestamp: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Phase 1: CONTENT_AUTHORING — script + outline generation
// ---------------------------------------------------------------------------

async function runContentAuthoring(
  article: string,
  onProgress?: ProgressCallback,
): Promise<{ script: string | null; outline: string | null; errors: string[] }> {
  const errors: string[] = [];
  let script: string | null = null;
  let outline: string | null = null;

  // -- store article --
  patchStore({ article, currentPhase: 'CONTENT_AUTHORING', isRunning: true });

  // -- Step 1a: generate script from article --
  emit('CONTENT_AUTHORING', 0, 'running', 'Generating narration script from article...', undefined, onProgress);

  try {
    const result = await invokeSkill('script-generator', { article });

    if (result.success && result.data) {
      script = (result.data as { script?: string }).script ?? null;
      if (script) {
        patchStore({ script });
        recordPhaseResult('CONTENT_AUTHORING', 'script-generator', true, script);
        emit('CONTENT_AUTHORING', 0, 'completed', 'Script generated successfully', { scriptLength: script.length }, onProgress);
      } else {
        const msg = 'script-generator succeeded but returned no script text';
        errors.push(msg);
        recordPhaseResult('CONTENT_AUTHORING', 'script-generator', false, null, msg);
        emit('CONTENT_AUTHORING', 0, 'failed', msg, undefined, onProgress);
      }
    } else {
      const msg = result.error ?? 'script-generator failed with unknown error';
      errors.push(msg);
      recordPhaseResult('CONTENT_AUTHORING', 'script-generator', false, null, msg);
      emit('CONTENT_AUTHORING', 0, 'failed', msg, undefined, onProgress);
    }
  } catch (err) {
    const msg = `script-generator exception: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    recordPhaseResult('CONTENT_AUTHORING', 'script-generator', false, null, msg);
    emit('CONTENT_AUTHORING', 0, 'failed', msg, undefined, onProgress);
  }

  // -- Step 1b: generate outline from script + article --
  if (script) {
    emit('CONTENT_AUTHORING', 0, 'running', 'Generating outline from script + article...', undefined, onProgress);

    try {
      const result = await invokeSkill('outline-generator', { script, article });

      if (result.success && result.data) {
        outline = (result.data as { outline?: string }).outline ?? null;
        if (outline) {
          patchStore({ outline });
          recordPhaseResult('CONTENT_AUTHORING', 'outline-generator', true, outline);
          emit('CONTENT_AUTHORING', 0, 'completed', 'Outline generated successfully', { outlineLength: outline.length }, onProgress);
        } else {
          const msg = 'outline-generator succeeded but returned no outline text';
          errors.push(msg);
          recordPhaseResult('CONTENT_AUTHORING', 'outline-generator', false, null, msg);
          emit('CONTENT_AUTHORING', 0, 'failed', msg, undefined, onProgress);
        }
      } else {
        const msg = result.error ?? 'outline-generator failed with unknown error';
        errors.push(msg);
        recordPhaseResult('CONTENT_AUTHORING', 'outline-generator', false, null, msg);
        emit('CONTENT_AUTHORING', 0, 'failed', msg, undefined, onProgress);
      }
    } catch (err) {
      const msg = `outline-generator exception: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      recordPhaseResult('CONTENT_AUTHORING', 'outline-generator', false, null, msg);
      emit('CONTENT_AUTHORING', 0, 'failed', msg, undefined, onProgress);
    }
  } else {
    const msg = 'Skipping outline generation — no script available';
    errors.push(msg);
    emit('CONTENT_AUTHORING', 0, 'failed', msg, undefined, onProgress);
  }

  // Persist errors to store
  if (errors.length > 0) {
    patchStore({ errors: [...readStore().errors, ...errors] });
  }

  return { script, outline, errors };
}

// ---------------------------------------------------------------------------
// Phase 2: WEB_DEV_CH1 — initial slide generation
// ---------------------------------------------------------------------------

async function runWebDevCh1(
  script: string | null,
  outline: string | null,
  theme: string,
  onProgress?: ProgressCallback,
): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  patchStore({ currentPhase: 'WEB_DEV_CH1' });

  emit('WEB_DEV_CH1', 1, 'running', 'Generating slide presentation (pass 1)...', undefined, onProgress);

  if (!script || !outline) {
    const msg = 'Skipping slide generation (pass 1) — script or outline missing';
    errors.push(msg);
    recordPhaseResult('WEB_DEV_CH1', 'web-video-presentation', false, null, msg);
    emit('WEB_DEV_CH1', 1, 'failed', msg, undefined, onProgress);
    patchStore({ errors: [...readStore().errors, ...errors] });
    return { errors };
  }

  try {
    const result = await invokeSkill('web-video-presentation', { script, outline, theme });

    if (result.success) {
      recordPhaseResult('WEB_DEV_CH1', 'web-video-presentation', true, result.data);
      emit('WEB_DEV_CH1', 1, 'completed', 'Slides generated (pass 1)', result.data, onProgress);
    } else {
      const msg = result.error ?? 'web-video-presentation (pass 1) failed';
      errors.push(msg);
      recordPhaseResult('WEB_DEV_CH1', 'web-video-presentation', false, null, msg);
      emit('WEB_DEV_CH1', 1, 'failed', msg, undefined, onProgress);
    }
  } catch (err) {
    const msg = `web-video-presentation (pass 1) exception: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    recordPhaseResult('WEB_DEV_CH1', 'web-video-presentation', false, null, msg);
    emit('WEB_DEV_CH1', 1, 'failed', msg, undefined, onProgress);
  }

  if (errors.length > 0) {
    patchStore({ errors: [...readStore().errors, ...errors] });
  }

  return { errors };
}

// ---------------------------------------------------------------------------
// Phase 3: WEB_DEV_CH2N — slide refinement pass
// ---------------------------------------------------------------------------

async function runWebDevCh2n(
  script: string | null,
  outline: string | null,
  theme: string,
  onProgress?: ProgressCallback,
): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  patchStore({ currentPhase: 'WEB_DEV_CH2N' });

  emit('WEB_DEV_CH2N', 2, 'running', 'Refining slide presentation (pass 2)...', undefined, onProgress);

  if (!script || !outline) {
    const msg = 'Skipping slide refinement (pass 2) — script or outline missing';
    errors.push(msg);
    recordPhaseResult('WEB_DEV_CH2N', 'web-video-presentation', false, null, msg);
    emit('WEB_DEV_CH2N', 2, 'failed', msg, undefined, onProgress);
    patchStore({ errors: [...readStore().errors, ...errors] });
    return { errors };
  }

  try {
    const result = await invokeSkill('web-video-presentation', {
      script,
      outline,
      theme,
      refine: true,
    });

    if (result.success) {
      recordPhaseResult('WEB_DEV_CH2N', 'web-video-presentation', true, result.data);
      emit('WEB_DEV_CH2N', 2, 'completed', 'Slides refined (pass 2)', result.data, onProgress);
    } else {
      const msg = result.error ?? 'web-video-presentation (pass 2) failed';
      errors.push(msg);
      recordPhaseResult('WEB_DEV_CH2N', 'web-video-presentation', false, null, msg);
      emit('WEB_DEV_CH2N', 2, 'failed', msg, undefined, onProgress);
    }
  } catch (err) {
    const msg = `web-video-presentation (pass 2) exception: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    recordPhaseResult('WEB_DEV_CH2N', 'web-video-presentation', false, null, msg);
    emit('WEB_DEV_CH2N', 2, 'failed', msg, undefined, onProgress);
  }

  if (errors.length > 0) {
    patchStore({ errors: [...readStore().errors, ...errors] });
  }

  return { errors };
}

// ---------------------------------------------------------------------------
// Phase 4: AUDIO_SYNTHESIS — TTS audio + SRT subtitle generation
// ---------------------------------------------------------------------------

async function runAudioSynthesis(
  script: string | null,
  voice: string,
  onProgress?: ProgressCallback,
): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  patchStore({ currentPhase: 'AUDIO_SYNTHESIS' });

  emit('AUDIO_SYNTHESIS', 3, 'running', 'Synthesizing TTS audio and subtitles...', undefined, onProgress);

  if (!script) {
    const msg = 'Skipping audio synthesis — no script available';
    errors.push(msg);
    recordPhaseResult('AUDIO_SYNTHESIS', 'minimax-tts', false, null, msg);
    emit('AUDIO_SYNTHESIS', 3, 'failed', msg, undefined, onProgress);
    patchStore({ errors: [...readStore().errors, ...errors] });
    return { errors };
  }

  // -- Step 4a: TTS synthesis via MiniMax --
  try {
    // Dynamically import the TTS module (Node.js dependency — works only in
    // non-browser environments; graceful degradation in browser).
    const { synthesize } = await import('../lib/tts/minimax');

    // Split script into spoken segments (paragraphs delimited by ---)
    const segments = script
      .split('---')
      .map((s) => s.trim())
      .filter(Boolean);

    if (segments.length === 0) {
      segments.push(script.trim());
    }

    const ttsResults: Array<{ mp3: string; srt: string; index: number }> = [];

    for (let i = 0; i < segments.length; i++) {
      const text = segments[i];
      const outputPath = `out/audio/segment_${String(i).padStart(3, '0')}.mp3`;

      try {
        const { mp3Path, srtPath } = await synthesize(text, voice, outputPath);
        ttsResults.push({ mp3: mp3Path, srt: srtPath, index: i });
      } catch (synthErr) {
        const msg = `TTS synthesis failed for segment ${i}: ${synthErr instanceof Error ? synthErr.message : String(synthErr)}`;
        errors.push(msg);
        // Continue with remaining segments
      }
    }

    if (ttsResults.length > 0) {
      recordPhaseResult('AUDIO_SYNTHESIS', 'minimax-tts', true, ttsResults);
      emit('AUDIO_SYNTHESIS', 3, 'completed', `TTS synthesized ${ttsResults.length}/${segments.length} segments`, ttsResults, onProgress);
    } else if (errors.length === 0) {
      const msg = 'No TTS segments were generated';
      errors.push(msg);
      recordPhaseResult('AUDIO_SYNTHESIS', 'minimax-tts', false, null, msg);
      emit('AUDIO_SYNTHESIS', 3, 'failed', msg, undefined, onProgress);
    }
  } catch (err) {
    // Top-level dynamic import failure (likely browser environment —
    // node:child_process unavailable). This is expected in Vite dev mode.
    const msg = `TTS module unavailable (requires Node.js environment): ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    recordPhaseResult('AUDIO_SYNTHESIS', 'minimax-tts', false, null, msg);
    emit('AUDIO_SYNTHESIS', 3, 'failed', msg, undefined, onProgress);
  }

  // -- Step 4b: subtitle generation --
  emit('AUDIO_SYNTHESIS', 3, 'running', 'Generating SRT subtitles...', undefined, onProgress);

  try {
    const result = await invokeSkill('subtitle-generator', { script });

    if (result.success) {
      recordPhaseResult('AUDIO_SYNTHESIS', 'subtitle-generator', true, result.data);
      emit('AUDIO_SYNTHESIS', 3, 'completed', 'Subtitles generated', result.data, onProgress);
    } else {
      // subtitle-generator skill not implemented yet — non-fatal
      const msg = result.error ?? 'subtitle-generator not available';
      errors.push(msg);
      recordPhaseResult('AUDIO_SYNTHESIS', 'subtitle-generator', false, null, msg);
      emit('AUDIO_SYNTHESIS', 3, 'failed', msg, undefined, onProgress);
    }
  } catch (err) {
    const msg = `subtitle-generator exception: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    recordPhaseResult('AUDIO_SYNTHESIS', 'subtitle-generator', false, null, msg);
    emit('AUDIO_SYNTHESIS', 3, 'failed', msg, undefined, onProgress);
  }

  if (errors.length > 0) {
    patchStore({ errors: [...readStore().errors, ...errors] });
  }

  return { errors };
}

// ---------------------------------------------------------------------------
// Phase 5: RECORDING — MP4 encoding via Puppeteer + FFmpeg
// ---------------------------------------------------------------------------

async function runRecording(
  onProgress?: ProgressCallback,
): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  patchStore({ currentPhase: 'RECORDING' });

  emit('RECORDING', 4, 'running', 'Recording MP4 video...', undefined, onProgress);

  // -- Step 5a: Puppeteer screen capture --
  emit('RECORDING', 4, 'running', 'Capturing presentation frames via Puppeteer...', undefined, onProgress);

  try {
    const result = await invokeSkill('puppeteer-recorder', {
      url: './presentation/index.html',
      output: 'out/frames',
    });

    if (result.success) {
      recordPhaseResult('RECORDING', 'puppeteer-recorder', true, result.data);
      emit('RECORDING', 4, 'completed', 'Frame capture complete', result.data, onProgress);
    } else {
      // puppeteer-recorder skill not implemented yet — non-fatal
      const msg = result.error ?? 'puppeteer-recorder not available (requires Node.js backend)';
      errors.push(msg);
      recordPhaseResult('RECORDING', 'puppeteer-recorder', false, null, msg);
      emit('RECORDING', 4, 'failed', msg, undefined, onProgress);
    }
  } catch (err) {
    const msg = `puppeteer-recorder exception: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    recordPhaseResult('RECORDING', 'puppeteer-recorder', false, null, msg);
    emit('RECORDING', 4, 'failed', msg, undefined, onProgress);
  }

  // -- Step 5b: FFmpeg MP4 encoding --
  emit('RECORDING', 4, 'running', 'Encoding MP4 with FFmpeg...', undefined, onProgress);

  try {
    const result = await invokeSkill('ffmpeg-encoder', {
      frames: 'out/frames',
      audio: 'out/audio',
      output: 'out/video.mp4',
    });

    if (result.success) {
      recordPhaseResult('RECORDING', 'ffmpeg-encoder', true, result.data);
      emit('RECORDING', 4, 'completed', 'MP4 encoding complete', result.data, onProgress);
    } else {
      const msg = result.error ?? 'ffmpeg-encoder not available (requires Node.js backend)';
      errors.push(msg);
      recordPhaseResult('RECORDING', 'ffmpeg-encoder', false, null, msg);
      emit('RECORDING', 4, 'failed', msg, undefined, onProgress);
    }
  } catch (err) {
    const msg = `ffmpeg-encoder exception: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    recordPhaseResult('RECORDING', 'ffmpeg-encoder', false, null, msg);
    emit('RECORDING', 4, 'failed', msg, undefined, onProgress);
  }

  if (errors.length > 0) {
    patchStore({ errors: [...readStore().errors, ...errors] });
  }

  // Pass COMPLETE checkpoint
  readStore().setCheckpointStatus('COMPLETE', 'passed');
  patchStore({ isRunning: false });

  return { errors };
}

// ---------------------------------------------------------------------------
// Public API: runPipeline()
// ---------------------------------------------------------------------------

/**
 * Execute the full slide-narrator pipeline sequentially.
 *
 * Phases:
 *   1. CONTENT_AUTHORING — script from article, outline from script+article
 *   2. WEB_DEV_CH1         — initial slide generation
 *   3. WEB_DEV_CH2N        — slide refinement pass
 *   4. AUDIO_SYNTHESIS     — TTS audio (MiniMax) + SRT subtitles
 *   5. RECORDING           — Puppeteer frame capture + FFmpeg MP4 encode
 *
 * Each phase runs to completion (or failure) before the next begins.
 * Phase failures are collected and reported but do NOT abort the pipeline.
 *
 * @param article - Raw article text (the source content to narrate)
 * @param options - Optional theme, voice, and progress callback
 * @returns PipelineResult with script, outline, errors, and phase count
 */
export async function runPipeline(
  article: string,
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const { theme = 'paper-press', voice = 'Chinese_male_wanwan', onProgress } = options;

  // Reset the store for a fresh run
  readStore().reset();
  patchStore({ isRunning: true });

  const allErrors: string[] = [];
  let completedPhases = 0;
  let script: string | null = null;
  let outline: string | null = null;

  // ---- Phase 1: CONTENT_AUTHORING ----
  const caResult = await runContentAuthoring(article, onProgress);
  allErrors.push(...caResult.errors);
  script = caResult.script;
  outline = caResult.outline;
  if (caResult.errors.length === 0) completedPhases++;

  // ---- Phase 2: WEB_DEV_CH1 ----
  const ch1Result = await runWebDevCh1(script, outline, theme, onProgress);
  allErrors.push(...ch1Result.errors);
  if (ch1Result.errors.length === 0) completedPhases++;

  // ---- Phase 3: WEB_DEV_CH2N ----
  const ch2nResult = await runWebDevCh2n(script, outline, theme, onProgress);
  allErrors.push(...ch2nResult.errors);
  if (ch2nResult.errors.length === 0) completedPhases++;

  // ---- Phase 4: AUDIO_SYNTHESIS ----
  const audioResult = await runAudioSynthesis(script, voice, onProgress);
  allErrors.push(...audioResult.errors);
  if (audioResult.errors.length === 0) completedPhases++;

  // ---- Phase 5: RECORDING ----
  const recResult = await runRecording(onProgress);
  allErrors.push(...recResult.errors);
  if (recResult.errors.length === 0) completedPhases++;

  // Finalize
  patchStore({ isRunning: false, errors: allErrors });

  return {
    success: allErrors.length === 0,
    script,
    outline,
    errors: allErrors,
    completedPhases,
  };
}

/**
 * Convenience: run the pipeline with a progress callback only.
 * Equivalent to `runPipeline(article, { onProgress })`.
 */
export async function runPipelineWithProgress(
  article: string,
  onProgress: ProgressCallback,
): Promise<PipelineResult> {
  return runPipeline(article, { onProgress });
}

/**
 * Cancel a running pipeline (no-op if not running).
 * Resets isRunning flag in the store.
 */
export function cancelPipeline(): void {
  const s = readStore();
  if (s.isRunning) {
    patchStore({ isRunning: false });
    s.addError('Pipeline cancelled by user');
    readStore().setCheckpointStatus('COMPLETE', 'failed');
  }
}

/**
 * Get the current pipeline progress state from the store.
 * Useful for polling from UI components.
 */
export function getPipelineState(): {
  currentPhase: Phase;
  isRunning: boolean;
  errors: string[];
  script: string | null;
  outline: string | null;
  completedPhases: number;
} {
  const s = readStore();
  const completed = s.phaseHistory.filter(
    (h) => h.results.length > 0 && h.results.every((r) => r.success),
  ).length;

  return {
    currentPhase: s.currentPhase,
    isRunning: s.isRunning,
    errors: s.errors,
    script: s.script,
    outline: s.outline,
    completedPhases: completed,
  };
}
