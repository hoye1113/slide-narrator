/**
 * Skill Registry — dynamic skill discovery, metadata parsing, and invocation.
 *
 * Skills are self-contained directories under src/skills/ with:
 *   - SKILL.md   — YAML frontmatter metadata (name, description, parameters, etc.)
 *   - index.ts   — default export implementing the SkillImplementation interface
 *
 * The registry uses Vite's import.meta.glob for discovery so it works at
 * runtime in the browser without filesystem access.
 */

import type { SkillMetadata, SkillInvocation, SkillResult, SkillImplementation } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Internal entry: metadata + implementation loader */
interface SkillEntry {
  metadata: SkillMetadata;
  loadImpl: (() => Promise<SkillImplementation>) | null;
}

// ---------------------------------------------------------------------------
// SKILL.md path pattern & implementation path pattern
// Both use Vite glob — paths relative to this file.
// ---------------------------------------------------------------------------

const SKILL_MD_PATTERN = './*/SKILL.md' as const;
const SKILL_IMPL_PATTERN = './*/index.ts' as const;

// ---------------------------------------------------------------------------
// Built-in skill metadata (fallback for skills without SKILL.md yet)
// ---------------------------------------------------------------------------

const BUILT_IN_SKILLS: SkillMetadata[] = [
  {
    name: 'script-generator',
    description: 'Generates narration scripts from structured outlines',
    parameters: [
      {
        name: 'outline',
        type: 'string',
        description: 'Structured outline to narrate',
        required: true,
      },
    ],
    output: { type: 'string', description: 'Generated narration script' },
  },
  {
    name: 'outline-generator',
    description: 'Generates structured outlines from raw source content',
    parameters: [
      {
        name: 'content',
        type: 'string',
        description: 'Raw source content to outline',
        required: true,
      },
    ],
    output: { type: 'string', description: 'Generated structured outline' },
  },
  {
    name: 'web-video-presentation',
    description: 'Produces a complete web-based video presentation from a script',
    parameters: [
      {
        name: 'script',
        type: 'string',
        description: 'Narration script to present',
        required: true,
      },
    ],
    output: { type: 'string', description: 'Presentation HTML output' },
  },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Discovered skills, keyed by normalized skill name */
let registry: Map<string, SkillEntry> | null = null;

// ---------------------------------------------------------------------------
// Frontmatter parser (no YAML dependency required)
// ---------------------------------------------------------------------------

/**
 * Minimal YAML frontmatter parser.
 * Handles the subset used by SKILL.md files:
 *   key: value
 *   key: "quoted value"
 *   multi-line descriptions in block scalar style
 */
function parseFrontmatter(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Extract content between leading --- markers
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return result;

  const body = match[1];
  const lines = body.split('\n');

  let currentKey: string | null = null;
  let currentValue: string[] = [];

  const commitValue = (): void => {
    if (currentKey) {
      const val = currentValue.join('\n').trim();
      result[currentKey] = parseScalar(val);
      currentKey = null;
      currentValue = [];
    }
  };

  for (let raw of lines) {
    // Check for a new key:value pair
    const keyMatch = raw.match(/^(\w[\w-]*?):\s*(.*)$/);
    if (keyMatch) {
      commitValue();
      currentKey = keyMatch[1];
      const rest = keyMatch[2].trim();
      if (rest) {
        // Inline value (possibly the start of a block scalar)
        if (rest.startsWith('|') || rest.startsWith('>')) {
          // Block scalar — remaining indented lines become the value
          currentValue = [rest];
        } else {
          currentValue = [rest];
          commitValue(); // single-line value
        }
      }
    } else if (currentKey) {
      // Continuation line (indented or blank)
      currentValue.push(raw);
    }
  }
  commitValue();

  return result;
}

/** Parse a YAML scalar from string representation */
function parseScalar(value: string): unknown {
  const trimmed = value.trim();

  // Quoted strings
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  // Numbers
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed.includes('.') ? parseFloat(trimmed) : parseInt(trimmed, 10);
  }

  // Booleans
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Block scalar indicators — strip the leading | or > line
  if (/^[|>]\s*/.test(trimmed)) {
    return trimmed.replace(/^[|>]\s*\n?/, '').trim();
  }

  return trimmed;
}

// ---------------------------------------------------------------------------
// SKILL.md → SkillMetadata conversion
// ---------------------------------------------------------------------------

/** Convert a raw SKILL.md string into structured SkillMetadata. */
export function parseSkillMetadata(raw: string): SkillMetadata {
  const frontmatter = parseFrontmatter(raw);

  const name = String(frontmatter.name ?? '');
  const description = String(frontmatter.description ?? '');
  const parameters = frontmatter.parameters as SkillMetadata['parameters'] | undefined;
  const output = frontmatter.output as SkillMetadata['output'] | undefined;

  if (!name) {
    throw new Error('SKILL.md is missing required field: name');
  }

  return {
    name,
    description,
    parameters,
    output,
    ...frontmatter,
  };
}

// ---------------------------------------------------------------------------
// Registry operations
// ---------------------------------------------------------------------------

/**
 * Normalize a skill name for use as a registry key / directory name.
 * Replaces whitespace with hyphens and lowercases.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Extract the skill directory name from a glob result path.
 * e.g. "./script-generator/SKILL.md" → "script-generator"
 */
function dirNameFromPath(path: string): string {
  const parts = path.replace(/^\.\//, '').split('/');
  return parts[0] ?? '';
}

/**
 * Scan src/skills/ for all SKILL.md files and their implementations.
 * Uses Vite's import.meta.glob for compile-time file discovery.
 *
 * Safe to call multiple times — subsequent calls return the cached result.
 */
export async function scanSkillsDirectory(): Promise<SkillMetadata[]> {
  if (registry) {
    return listSkills();
  }

  registry = new Map();

  // ---- Seed built-in skills as defaults (overridden by SKILL.md if found) ----
  for (const meta of BUILT_IN_SKILLS) {
    const key = normalizeName(meta.name);
    if (!registry.has(key)) {
      registry.set(key, { metadata: meta, loadImpl: null });
    }
  }

  // ---- Discover SKILL.md files ----
  // Vite transforms this into a static module map at build time.
  const skillMdModules = import.meta.glob<{ default: string }>(
    SKILL_MD_PATTERN,
    { query: '?raw', eager: true, import: 'default' },
  );

  // ---- Discover implementation modules ----
  const implModules = import.meta.glob<SkillImplementation>(
    SKILL_IMPL_PATTERN,
    { eager: false },
  );

  // ---- Parse metadata and register each skill ----
  for (const [path, loader] of Object.entries(skillMdModules)) {
    try {
      // `loader` is eagerly resolved by Vite, so it's the raw string directly
      const raw = typeof loader === 'function' ? await (loader as unknown as () => Promise<string>)() : loader;
      const content = typeof raw === 'string' ? raw : (raw as { default?: string })?.default ?? String(raw);
      const metadata = parseSkillMetadata(content);
      const dirName = dirNameFromPath(path);
      const key = normalizeName(metadata.name);

      // Find matching implementation
      const implPath = `./${dirName}/index.ts`;
      const implLoader = implModules[implPath] ?? null;

      registry.set(key, {
        metadata,
        loadImpl: implLoader
          ? (() => implLoader().then(m => {
              // Support both default export and named `execute` export
              if (typeof (m as SkillImplementation).execute === 'function') {
                return m as SkillImplementation;
              }
              const maybeDefault = (m as { default?: unknown }).default;
              if (maybeDefault && typeof (maybeDefault as SkillImplementation).execute === 'function') {
                return maybeDefault as SkillImplementation;
              }
              throw new Error(`Skill "${metadata.name}" implementation does not export an execute function`);
            }))
          : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[skill-registry] Failed to parse ${path}: ${msg}`);
    }
  }

  return listSkills();
}

/**
 * Return metadata for all discovered skills.
 * Returns an empty array if scanSkillsDirectory() has not been called yet.
 */
export function listSkills(): SkillMetadata[] {
  if (!registry) return [];
  return Array.from(registry.values()).map(entry => entry.metadata);
}

/**
 * Get metadata for a single skill by name.
 */
export function getSkillMetadata(skillName: string): SkillMetadata | null {
  if (!registry) return null;
  return registry.get(normalizeName(skillName))?.metadata ?? null;
}

/**
 * Invoke a skill with the given parameters.
 *
 * The registry must have been initialised via scanSkillsDirectory() first.
 *
 * @param skillName - Name of the skill to invoke (matched case-insensitively).
 * @param params    - Parameters to pass to the skill implementation.
 * @param context   - Optional execution context.
 *
 * @throws If the skill is not found or has no implementation.
 */
export async function invokeSkill(
  skillName: string,
  params: Record<string, unknown>,
  context?: Record<string, unknown>,
): Promise<SkillResult> {
  if (!registry) {
    await scanSkillsDirectory();
  }

  const key = normalizeName(skillName);
  const entry = registry?.get(key);

  if (!entry) {
    return {
      success: false,
      error: `Skill "${skillName}" not found. Available: ${
        registry ? Array.from(registry.keys()).join(', ') : '(none)'
      }`,
    };
  }

  if (!entry.loadImpl) {
    return {
      success: false,
      error: `Skill "${skillName}" has no implementation (missing index.ts)`,
      metadata: entry.metadata,
    };
  }

  try {
    const impl = await entry.loadImpl();
    const result = await impl.execute(params, context);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Skill "${skillName}" execution failed: ${message}`,
      metadata: entry.metadata,
    };
  }
}

/**
 * Convenience overload: invoke a skill from a SkillInvocation object.
 */
export async function invoke(invocation: SkillInvocation): Promise<SkillResult> {
  return invokeSkill(invocation.skillName, invocation.parameters, invocation.context);
}

/**
 * Check whether a skill has an implementation registered.
 */
export function hasImplementation(skillName: string): boolean {
  if (!registry) return false;
  return registry.get(normalizeName(skillName))?.loadImpl !== null;
}

/**
 * Return the number of registered skills.
 */
export function skillCount(): number {
  return registry?.size ?? 0;
}
