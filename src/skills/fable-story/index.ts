/**
 * Fable Story Skill
 *
 * Helps generate fable stories to explain abstract concepts.
 * This skill is primarily driven by the SKILL.md instructions.
 * The index.ts provides minimal scaffolding for the skill registry.
 */

import type { SkillImplementation, SkillResult } from '../types';

const implementation: SkillImplementation = {
  async execute(params: Record<string, unknown>): Promise<SkillResult> {
    const concept = params.concept as string | undefined;

    if (!concept) {
      return {
        success: false,
        error: 'Missing required parameter: concept. Usage: invoke("fable-story", { concept: "your-concept-here" })',
      };
    }

    // The actual fable writing is done by the AI following SKILL.md instructions.
    // This implementation just validates the input and provides context.
    return {
      success: true,
      data: `[Fable Story Skill] Ready to generate a fable story for concept: "${concept}". Follow the SKILL.md instructions to write the寓言。`,
      metadata: {
        skillName: 'fable-story',
        concept,
      },
    };
  },
};

export default implementation;