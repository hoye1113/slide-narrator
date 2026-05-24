/**
 * Skill type definitions for the skill registry system.
 *
 * Skills are discoverable modules with metadata (from SKILL.md) and
 * an executable implementation. The registry handles discovery, metadata
 * parsing, and dynamic invocation.
 */

/**
 * Parameter definition for a skill.
 */
export interface SkillParameter {
  /** Parameter name (used as key in invocation params) */
  name: string;
  /** Expected type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Human-readable description */
  description: string;
  /** Whether this parameter is required */
  required?: boolean;
  /** Default value if not provided */
  default?: unknown;
}

/**
 * Output definition for a skill.
 */
export interface SkillOutput {
  /** Expected output type */
  type: string;
  /** Human-readable description of the output */
  description: string;
}

/**
 * Metadata parsed from a skill's SKILL.md frontmatter.
 */
export interface SkillMetadata {
  /** Unique skill name */
  name: string;
  /** Short description of what the skill does */
  description: string;
  /** Input parameters the skill accepts */
  parameters?: SkillParameter[];
  /** Output the skill produces */
  output?: SkillOutput;
  /** Any additional metadata fields from the frontmatter */
  [key: string]: unknown;
}

/**
 * Invocation parameters for calling a skill.
 */
export interface SkillInvocation {
  /** Target skill name */
  skillName: string;
  /** Parameters to pass to the skill */
  parameters: Record<string, unknown>;
  /** Optional execution context (e.g. workspace path, agent state) */
  context?: Record<string, unknown>;
}

/**
 * Result returned from a skill invocation.
 */
export interface SkillResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Output data from the skill */
  data?: unknown;
  /** Error message if execution failed */
  error?: string;
  /** Additional execution metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Internal interface: a skill implementation module.
 * Each skill directory must export an `execute` function of this shape.
 */
export interface SkillImplementation {
  execute: (
    params: Record<string, unknown>,
    context?: Record<string, unknown>,
  ) => Promise<SkillResult>;
}
