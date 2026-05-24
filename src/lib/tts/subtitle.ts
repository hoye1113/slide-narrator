/**
 * SRT subtitle generation from audio segments.
 *
 * Provides utilities for generating, parsing, and merging
 * SubRip (SRT) subtitle files from timed audio segments.
 */

export interface SubtitleSegment {
  /** 1-based subtitle index */
  index: number;
  /** Start time in milliseconds */
  startTime: number;
  /** End time in milliseconds */
  endTime: number;
  /** Subtitle text content */
  text: string;
}

export interface AudioSegment {
  /** Unique segment identifier */
  id: string;
  /** Chapter this segment belongs to */
  chapterIndex: number;
  /** Step within the chapter */
  stepIndex: number;
  /** Text content to narrate */
  text: string;
  /** Start time in milliseconds */
  startTime: number;
  /** End time in milliseconds */
  endTime: number;
  /** Path to the generated audio file */
  audioPath: string;
}

/**
 * Format milliseconds to SRT time format (HH:MM:SS,mmm).
 *
 * @param ms - Time in milliseconds
 * @returns Formatted time string (e.g. "00:01:23,456")
 */
export function formatSRTTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.round(ms % 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

/**
 * Parse SRT time format (HH:MM:SS,mmm) back to milliseconds.
 *
 * Accepts both comma (`,`) and period (`.`) as the millisecond separator.
 *
 * @param time - SRT time string (e.g. "00:01:23,456")
 * @returns Time in milliseconds
 * @throws {Error} If the time string format is invalid
 */
export function parseSRTTime(time: string): number {
  const match = time.match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/);
  if (!match) {
    throw new Error(`Invalid SRT time format: "${time}"`);
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const millis = parseInt(match[4], 10);

  return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + millis;
}

/**
 * Generate SRT subtitle content from audio segments.
 *
 * Segments are sorted by start time before generating.
 * Each segment becomes one subtitle entry with sequential numbering.
 *
 * @param segments - Array of audio segments with timing and text
 * @returns Complete SRT file content as a string
 */
export function generateSRT(segments: AudioSegment[]): string {
  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);

  return sorted
    .map((seg, i) => {
      const index = i + 1;
      const start = formatSRTTime(seg.startTime);
      const end = formatSRTTime(seg.endTime);
      return `${index}\n${start} --> ${end}\n${seg.text}`;
    })
    .join('\n\n');
}

/**
 * Parse SRT file content into an array of subtitle segments.
 *
 * Handles multi-line text entries and skips malformed blocks gracefully.
 *
 * @param srtContent - Raw SRT file content as a string
 * @returns Array of parsed subtitle segments
 */
export function parseSRT(srtContent: string): SubtitleSegment[] {
  const blocks = srtContent.trim().split(/\n\s*\n/);
  const segments: SubtitleSegment[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    // Parse 1-based subtitle index
    const index = parseInt(lines[0], 10);
    if (isNaN(index)) continue;

    // Parse time range line (e.g. "00:00:01,000 --> 00:00:04,000")
    const timeMatch = lines[1].match(
      /^(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})$/,
    );
    if (!timeMatch) continue;

    const startTime = parseSRTTime(timeMatch[1]);
    const endTime = parseSRTTime(timeMatch[2]);

    // Text may span multiple lines
    const text = lines.slice(2).join('\n');

    segments.push({ index, startTime, endTime, text });
  }

  return segments;
}

/**
 * Merge multiple SRT content strings into a single SRT with re-indexed entries.
 *
 * All subtitle entries from all inputs are concatenated in order and
 * re-numbered sequentially. Timing values are preserved as-is.
 *
 * @param srtContents - Array of SRT content strings to merge
 * @returns Single merged SRT content string
 */
export function mergeSubtitles(srtContents: string[]): string {
  let globalIndex = 0;
  const merged: string[] = [];

  for (const content of srtContents) {
    const segments = parseSRT(content);
    for (const seg of segments) {
      globalIndex++;
      const start = formatSRTTime(seg.startTime);
      const end = formatSRTTime(seg.endTime);
      merged.push(`${globalIndex}\n${start} --> ${end}\n${seg.text}`);
    }
  }

  return merged.join('\n\n');
}
