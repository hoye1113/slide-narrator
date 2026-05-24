/// <reference types="node" />

import { execFile } from 'node:child_process';

/**
 * Options for configuring the MiniMax TTS client.
 */
export interface MinimaxConfig {
  /** MiniMax API key (optional — can be pre-configured via `mmx config set`) */
  apiKey?: string;
}

/**
 * A voice option returned by the MiniMax TTS API.
 */
export interface Voice {
  /** Voice identifier (e.g. `Chinese_male_wanwan`) */
  id: string;
  /** Human-readable voice name */
  name: string;
  /** Language code (e.g. `zh` for Chinese) */
  language: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Run the `mmx` CLI with the given arguments and return stdout.
 *
 * @param args    CLI arguments (e.g. `['speech', 'voices']`)
 * @param timeout Max wait in ms (default 120s)
 */
function execMmx(args: string[], timeout = 120_000): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    execFile(
      'mmx',
      args,
      { timeout, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          // Include stderr content in the error message when available
          const msg =
            err.message +
            ((err as NodeJS.ErrnoException & { stderr?: string }).stderr
              ? `\nstderr: ${(err as NodeJS.ErrnoException & { stderr?: string }).stderr}`
              : '');
          reject(new Error(msg));
        } else {
          resolve(stdout);
        }
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the `mmx` CLI is authenticated.
 *
 * Runs `mmx auth status` and returns `true` if the CLI reports success,
 * `false` otherwise (CLI not found, not logged in, network error, …).
 */
export async function auth(): Promise<boolean> {
  try {
    await execMmx(['auth', 'status'], 10_000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Return the current Token Plan quota (total chars and chars used).
 *
 * Expects `mmx quota show --output json` to produce a JSON object
 * with at least `chars` / `used` (or `total` / `usage`) keys.
 */
export async function quota(): Promise<{ chars: number; used: number }> {
  const stdout = await execMmx(['quota', 'show', '--output', 'json']);
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    // Fallback: try to parse a plain-text output
    const charsMatch = stdout.match(/chars:\s*(\d+)/i);
    const usedMatch = stdout.match(/used:\s*(\d+)/i);
    return {
      chars: charsMatch ? Number(charsMatch[1]) : 0,
      used: usedMatch ? Number(usedMatch[1]) : 0,
    };
  }

  // Normalise flattened JSON keys
  const chars =
    (data.chars as number | undefined) ??
    (data.total as number | undefined) ??
    ((data.quota as Record<string, unknown> | undefined)?.chars as number | undefined) ??
    0;
  const used =
    (data.used as number | undefined) ??
    ((data.usage as Record<string, unknown> | undefined)?.chars as number | undefined) ??
    0;

  return { chars, used };
}

/**
 * List available voices, filtered to **Chinese voices only** (v1 scope).
 *
 * Runs `mmx speech voices` and parses the output line by line.
 * Lines containing `zh`, `Chinese`, or `中文` are kept; others are
 * discarded.
 */
export async function voices(): Promise<Voice[]> {
  const stdout = await execMmx(['speech', 'voices']);

  // Try JSON output first (some mmx versions may support it)
  const trimmed = stdout.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const list = JSON.parse(trimmed) as Array<{ voice_id?: string; name?: string; language?: string }>;
      return list
        .filter((v) => /zh/i.test(v.language ?? ''))
        .map((v) => ({
          id: v.voice_id ?? v.name ?? '',
          name: v.name ?? v.voice_id ?? '',
          language: 'zh',
        }));
    } catch {
      // fall through to line-based parsing
    }
  }

  // Line-based parsing (default table output)
  const lines = trimmed.split('\n').filter(Boolean);
  const headerIndex = lines.findIndex((l) => /voice/i.test(l) && /id/i.test(l));

  const dataLines = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;

  return dataLines
    .filter((line) => /zh|Chinese|中文/i.test(line))
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        id: parts[0] ?? '',
        name: parts.slice(1).join(' ') || (parts[0] ?? ''),
        language: 'zh',
      };
    });
}

/**
 * Synthesise speech from `text` using a given `voice`, producing an MP3
 * and an SRT subtitle file (via the `--subtitles` flag).
 *
 * @param text       Text to speak (UTF-8, max ~10 000 chars per mmx docs)
 * @param voice      Voice ID (e.g. `Chinese_male_wanwan`)
 * @param outputPath Destination path for the MP3 (e.g. `out/audio/1.mp3`).
 *                   The SRT is written alongside it (`1.srt`).
 * @param options    Optional settings
 * @param options.speed  Playback speed multiplier (e.g. `1.2`)
 *
 * @returns Paths to the generated MP3 and SRT files.
 */
export async function synthesize(
  text: string,
  voice: string,
  outputPath: string,
  options?: { speed?: number },
): Promise<{ mp3Path: string; srtPath: string }> {
  const args: string[] = [
    'speech',
    'synthesize',
    '--text',
    text,
    '--voice',
    voice,
    '--out',
    outputPath,
    '--subtitles',
  ];

  if (options?.speed !== undefined) {
    args.push('--speed', String(options.speed));
  }

  await execMmx(args);

  const basePath = outputPath.replace(/\.mp3$/, '');
  return {
    mp3Path: `${basePath}.mp3`,
    srtPath: `${basePath}.srt`,
  };
}
