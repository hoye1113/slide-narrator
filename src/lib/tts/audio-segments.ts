import type { AudioSegment } from './subtitle';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface AudioSubtitleMapping {
  chapterIndex: number;
  stepIndex: number;
  audioFile: string;
  srtFile: string;
  duration: number;  // ms
  startTime: number;
  endTime: number;
}

/**
 * Create audio segments from script chapters.
 *
 * Each step in each chapter becomes an AudioSegment. Timing is estimated
 * based on text length (~80ms per character, min 500ms) and accumulated
 * sequentially across all segments.
 *
 * @param chapters - Array of chapters containing narrated steps
 * @returns Flat array of AudioSegments with sequential timing
 */
export function createSegments(
  chapters: Array<{
    chapterIndex: number;
    steps: Array<{ stepIndex: number; text: string; audioPath?: string }>;
  }>,
): AudioSegment[] {
  const segments: AudioSegment[] = [];

  for (const chapter of chapters) {
    for (const step of chapter.steps) {
      // Rough estimate: ~80ms per character, minimum 500ms
      const estimatedDuration = Math.max(step.text.length * 80, 500);

      segments.push({
        id: `ch${chapter.chapterIndex}-step${step.stepIndex}`,
        chapterIndex: chapter.chapterIndex,
        stepIndex: step.stepIndex,
        text: step.text,
        audioPath: step.audioPath ?? `audio/ch${chapter.chapterIndex}/step${step.stepIndex}.mp3`,
        startTime: 0,
        endTime: estimatedDuration,
      });
    }
  }

  // Accumulate timing sequentially
  let currentTime = 0;
  for (const segment of segments) {
    const duration = segment.endTime - segment.startTime;
    segment.startTime = currentTime;
    segment.endTime = currentTime + duration;
    currentTime = segment.endTime;
  }

  return segments;
}

/**
 * Map an audio file to its corresponding SRT subtitle file.
 *
 * Extracts chapter/step indices from the filename and creates
 * a mapping entry. Actual timing values are set to 0 by default
 * and should be populated after processing.
 *
 * @param audioPath - Path to the audio file
 * @param srtPath   - Path to the SRT subtitle file
 * @returns A mapping entry linking the audio and subtitle files
 */
export function mapSubtitleToAudio(
  audioPath: string,
  srtPath: string,
): AudioSubtitleMapping {
  const chapterMatch = audioPath.match(/chapter[_-]?(\d+)/i);
  const stepMatch = audioPath.match(/step[_-]?(\d+)/i);

  const chapterIndex = chapterMatch ? parseInt(chapterMatch[1], 10) : 0;
  const stepIndex = stepMatch ? parseInt(stepMatch[1], 10) : 0;

  return {
    chapterIndex,
    stepIndex,
    audioFile: audioPath,
    srtFile: srtPath,
    duration: 0,
    startTime: 0,
    endTime: 0,
  };
}

/**
 * Get the duration of an audio segment in milliseconds.
 *
 * @param segment - The audio segment to measure
 * @returns Duration in milliseconds (endTime - startTime)
 */
export function getSegmentDuration(segment: AudioSegment): number {
  return segment.endTime - segment.startTime;
}

/**
 * Filter segments whose audio files are missing from disk.
 *
 * Checks whether the audio file referenced by each segment exists
 * within the given directory. Segments with missing or inaccessible
 * audio files are returned so they can be re-synthesized.
 *
 * @param segments - Array of audio segments to check
 * @param audioDir - Directory containing the audio files
 * @returns Segments whose audio file does not exist on disk
 */
/**
 * Check if we're running in a Node.js environment (vs browser).
 * process.cwd exists only in Node.js.
 */
function isNodeEnvironment(): boolean {
  try {
    // eslint-disable-next-line no-unused-expressions
    process.cwd();
    return true;
  } catch {
    return false;
  }
}

/**
 * Filter segments whose audio files are missing from disk.
 *
 * In browser environments this returns an empty array (disk access unavailable).
 * In Node.js environments this checks actual file existence via existsSync.
 *
 * @param segments - Array of audio segments to check
 * @param audioDir - Directory containing the audio files
 * @returns Segments whose audio file does not exist on disk
 */
export function getMissingSegments(
  segments: AudioSegment[],
  audioDir: string,
): AudioSegment[] {
  if (!isNodeEnvironment()) {
    // Browser environment — cannot access disk
    return [];
  }

  // Node.js environment — verify actual file existence
  return segments.filter((segment) => {
    const fullPath = join(audioDir, segment.audioPath);
    return !existsSync(fullPath);
  });
}
