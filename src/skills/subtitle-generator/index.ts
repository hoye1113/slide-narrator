import type { SkillResult } from '../types';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';

export interface SubtitleSegment {
  index: number;
  startTime: number; // ms
  endTime: number;    // ms
  text: string;
}

export interface SubtitleGeneratorOutput {
  srtPath: string;
  segments: SubtitleSegment[];
}

/**
 * Format milliseconds to SRT timestamp: HH:MM:SS,mmm
 */
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

/**
 * Escape HTML/SRT special characters in subtitle text
 */
function escapeSrtText(text: string): string {
  return text
    .replace(/\n/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\{[^}]+\}/g, '')
    .trim();
}

/**
 * Split long text into chunks that fit within ~2 seconds per line
 */
function splitLongText(text: string, maxChars = 80): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  const sentences = text.split(/(?<=[。！？.!?])/g);

  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length <= maxChars) {
      current += sentence;
    } else {
      if (current) chunks.push(current.trim());
      current = sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // If still too long, split by comma/em-dash
  if (chunks.length === 0 || chunks[0].length > maxChars) {
    const words = text.split(/([，,、])/);
    current = '';
    for (const word of words) {
      if ((current + word).length <= maxChars) {
        current += word;
      } else {
        if (current) chunks.push(current.trim());
        current = word;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [text.substring(0, maxChars)];
}

/**
 * Detect language from text
 */
function detectLanguage(text: string): 'zh-CN' | 'en' {
  if (!text || !text.trim()) return 'zh-CN';
  const chineseChars = (text.match(/[一-鿿]/g) || []).length;
  const asciiChars = (text.match(/[a-zA-Z]/g) || []).length;
  return chineseChars > asciiChars * 0.3 ? 'zh-CN' : 'en';
}

/**
 * Estimate speech duration in milliseconds
 */
function estimateDuration(text: string, language: 'zh-CN' | 'en'): number {
  const chars = text.replace(/\s/g, '').length;
  if (language === 'zh-CN') {
    return Math.max(1000, Math.ceil((chars / 4) * 1000));
  } else {
    const words = text.split(/\s+/).length;
    return Math.max(1000, Math.ceil((words / 150) * 1000));
  }
}

/**
 * Build SRT content from segments
 */
function buildSrt(segments: SubtitleSegment[]): string {
  const lines: string[] = [];
  for (const seg of segments) {
    lines.push(String(seg.index));
    lines.push(`${formatTimestamp(seg.startTime)} --> ${formatTimestamp(seg.endTime)}`);
    lines.push(escapeSrtText(seg.text));
    lines.push('');
  }
  return lines.join('\n');
}

export async function execute(
  params: Record<string, unknown>,
  _context?: Record<string, unknown>,
): Promise<SkillResult> {
  const script = params.script as string | undefined;

  if (!script) {
    return {
      success: false,
      error: 'Missing required parameter: script',
    };
  }

  // These skills require Node.js — refuse to run in browser environments
  let cwd: string;
  try {
    // eslint-disable-next-line no-unused-expressions
    cwd = process.cwd();
  } catch {
    return {
      success: false,
      error: 'subtitle-generator requires a Node.js environment (process.cwd() unavailable in browser)',
    };
  }

  try {
    const language = detectLanguage(script);
    const paragraphs = script
      .split(/---/)
      .map((p) => p.trim())
      .filter(Boolean);

    const segments: SubtitleSegment[] = [];
    const srtSegments: SubtitleSegment[] = [];
    let currentTime = (params.baseTime as number) ?? 0;
    let globalIndex = 1;

    for (const para of paragraphs) {
      const lines = para.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        const cleaned = line.replace(/^[-*#\d.)\s]+/, '').trim();
        if (!cleaned) continue;

        const textChunks = splitLongText(cleaned);

        for (const chunk of textChunks) {
          const duration = estimateDuration(chunk, language);
          segments.push({
            index: globalIndex,
            startTime: currentTime,
            endTime: currentTime + duration,
            text: chunk,
          });
          srtSegments.push({
            index: globalIndex,
            startTime: currentTime,
            endTime: currentTime + duration,
            text: chunk,
          });
          currentTime += duration;
          globalIndex++;
        }
      }
    }

    const srtContent = buildSrt(srtSegments);
    const outputDir = join(cwd, 'out', 'subtitles');
    await fs.mkdir(outputDir, { recursive: true });

    const srtPath = join(outputDir, 'subtitle_001.srt');
    await fs.writeFile(srtPath, '﻿' + srtContent, 'utf-8');

    return {
      success: true,
      data: {
        srtPath,
        segments,
      } as SubtitleGeneratorOutput,
      metadata: {
        skill: 'subtitle-generator',
        segmentCount: segments.length,
        language,
        durationMs: currentTime,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Subtitle generation failed: ${message}`,
    };
  }
}