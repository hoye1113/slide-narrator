/**
 * AgentStateMachine — agentic pipeline orchestration engine.
 *
 * Implements observe → plan → act → reflect with checkpoint handling.
 * Connects to the Zustand pipeline store. Uses dependency‑injected
 * SkillInvoker for skill execution (registry plugs in later).
 *
 * Constraints enforced:
 *   - No hardcoded sequential execution (data‑driven via PHASE_SKILLS map)
 *   - No parallel skill execution in Phase 2 (WEB_DEV_CH{1,2N})
 *   - Self‑check protocol (自检协议) before each transition
 *   - Mandatory checkpoints: PLAN, AUDIO, COMPLETE
 *   - No bypassing AGENT.md constraints
 */

import { usePipelineStore } from '../lib/pipeline/store';
import type { PipelineStore } from '../lib/pipeline/store';
import { Phase, Checkpoint, PHASE_ORDER } from './types';
import type {
  SkillResult,
  SkillInvoker,
  ActionPlan,
  SelfCheckResult,
  AgentObservation,
} from './types';

// ---------------------------------------------------------------------------
// Static phase configuration – data‑driven, NOT hardcoded sequential
// ---------------------------------------------------------------------------

const PHASE_SKILLS: Record<Phase, string[]> = {
  [Phase.CONTENT_AUTHORING]: ['script-generator', 'outline-generator'],
  [Phase.WEB_DEV_CH1]: ['web-video-presentation'],
  [Phase.WEB_DEV_CH2N]: ['web-video-presentation'],
  [Phase.AUDIO_SYNTHESIS]: ['minimax-tts', 'subtitle-generator'],
  [Phase.RECORDING]: ['puppeteer-recorder', 'ffmpeg-encoder'],
};

const PHASE_CHECKPOINTS: Partial<Record<Phase, Checkpoint>> = {
  [Phase.CONTENT_AUTHORING]: Checkpoint.PLAN,
  [Phase.WEB_DEV_CH2N]: Checkpoint.AUDIO,
  [Phase.RECORDING]: Checkpoint.COMPLETE,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPhase2(phase: Phase): boolean {
  return phase === Phase.WEB_DEV_CH1 || phase === Phase.WEB_DEV_CH2N;
}

function getNextPhase(current: Phase): Phase | null {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

// ---------------------------------------------------------------------------
// AgentStateMachine
// ---------------------------------------------------------------------------

export class AgentStateMachine {
  private _skillInvoker: SkillInvoker | null = null;
  private _completedSkills: Set<string> = new Set();
  private _checkpointPassed: Set<Checkpoint> = new Set();
  private _lastResult: SkillResult | null = null;

  // -----------------------------------------------------------------------
  // Store access – flat Zustand store (PipelineStore is the state shape)
  // -----------------------------------------------------------------------

  private readStore(): PipelineStore {
    return usePipelineStore.getState();
  }

  private patchStore(partial: Partial<PipelineStore>): void {
    usePipelineStore.setState(partial);
  }

  // -----------------------------------------------------------------------
  // Dependency injection
  // -----------------------------------------------------------------------

  setSkillInvoker(invoker: SkillInvoker): void {
    this._skillInvoker = invoker;
  }

  // -----------------------------------------------------------------------
  // observe() – inspect current pipeline state
  // -----------------------------------------------------------------------

  observe(): AgentObservation {
    const s = this.readStore();
    const pendingCp = this.resolveCheckpoint(s.currentPhase);

    return {
      currentPhase: s.currentPhase,
      phaseComplete: this.arePhaseSkillsDone(s.currentPhase),
      checkpointPending:
        pendingCp !== null && !this._checkpointPassed.has(pendingCp),
      pendingCheckpoint:
        pendingCp !== null && !this._checkpointPassed.has(pendingCp)
          ? pendingCp
          : null,
      errors: s.errors,
      lastResult: this._lastResult,
    };
  }

  // -----------------------------------------------------------------------
  // plan() – agentic decision: what to do next
  // -----------------------------------------------------------------------

  plan(): ActionPlan {
    const s = this.readStore();
    const required = PHASE_SKILLS[s.currentPhase] ?? [];
    const remaining = required.filter((skill) => !this._completedSkills.has(skill));

    if (remaining.length > 0) {
      const skills = isPhase2(s.currentPhase) ? [remaining[0]] : remaining;
      return {
        phase: s.currentPhase,
        skills,
        reason: `Executing ${skills.length} skill(s) for ${s.currentPhase}: ${skills.join(', ')}`,
      };
    }

    const cp = this.resolveCheckpoint(s.currentPhase);
    if (cp && !this._checkpointPassed.has(cp)) {
      return {
        phase: s.currentPhase,
        skills: [],
        checkpoint: cp,
        reason: `Phase ${s.currentPhase} complete — checkpoint ${cp} requires confirmation`,
      };
    }

    const next = getNextPhase(s.currentPhase);
    if (next) {
      this._completedSkills.clear();
      const nextRequired = PHASE_SKILLS[next] ?? [];
      const skills = isPhase2(next) ? [nextRequired[0]] : nextRequired;
      return {
        phase: next,
        skills,
        reason: `Advancing from ${s.currentPhase} → ${next}`,
      };
    }

    return { phase: s.currentPhase, skills: [], reason: 'Pipeline complete' };
  }

  // -----------------------------------------------------------------------
  // act() – execute the plan
  // -----------------------------------------------------------------------

  async act(plan: ActionPlan): Promise<SkillResult> {
    if (plan.phase !== this.readStore().currentPhase) {
      this.transitionTo(plan.phase);
    }

    if (plan.skills.length === 0) {
      return { success: true, output: `No skills to execute (${plan.reason})` };
    }

    let last: SkillResult = { success: true };

    for (const skillName of plan.skills) {
      last = await this.callSkill(skillName, {
        phase: plan.phase,
        state: this.readStore(),
      });
      this._completedSkills.add(skillName);
      this._lastResult = last;
      if (!last.success) break;
    }

    return last;
  }

  // -----------------------------------------------------------------------
  // reflect() – self‑check protocol (自检协议)
  // -----------------------------------------------------------------------

  async reflect(): Promise<SelfCheckResult> {
    if (!this._lastResult) {
      return {
        passed: true,
        issues: [],
        fixes: [],
        report: 'No action executed yet — nothing to reflect on',
      };
    }

    const issues: string[] = [];
    const fixes: string[] = [];

    if (!this._lastResult.success) {
      issues.push(`Skill failed: ${this._lastResult.error ?? 'unknown error'}`);
      fixes.push('Retry skill invocation or inspect parameters');
    }

    if (this._lastResult.success && this._lastResult.output === undefined) {
      issues.push('Skill succeeded but produced no output');
      fixes.push('Verify skill implementation returns meaningful output');
    }

    const s = this.readStore();
    if (s.script && !s.outline) {
      issues.push('Script exists without outline — double-source principle violated');
      fixes.push('Generate outline.md after script.md');
    }

    return {
      passed: issues.length === 0,
      issues,
      fixes,
      report:
        issues.length === 0
          ? `Self-check passed for ${this.readStore().currentPhase}`
          : `Self-check failed: ${issues.join('; ')}`,
    };
  }

  // -----------------------------------------------------------------------
  // handleCheckpoint() – pause at checkpoints
  // -----------------------------------------------------------------------

  async handleCheckpoint(): Promise<boolean> {
    const s = this.readStore();
    const cp = this.resolveCheckpoint(s.currentPhase);

    if (!cp) return true;
    if (this._checkpointPassed.has(cp)) return true;

    // Mark checkpoint as pending in store
    s.setCheckpointStatus(cp, 'pending');
    return false;
  }

  passCheckpoint(cp: Checkpoint): void {
    this._checkpointPassed.add(cp);
    this.readStore().setCheckpointStatus(cp, 'passed');
  }

  // -----------------------------------------------------------------------
  // callSkill() – invoke a skill by name
  // -----------------------------------------------------------------------

  async callSkill(
    skillName: string,
    params: Record<string, unknown>,
  ): Promise<SkillResult> {
    if (!this._skillInvoker) {
      return {
        success: false,
        error: `SkillInvoker not set — cannot invoke "${skillName}". Call setSkillInvoker() first.`,
      };
    }

    try {
      return await this._skillInvoker(skillName, params);
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // -----------------------------------------------------------------------
  // Agentic loop convenience
  // -----------------------------------------------------------------------

  async step(): Promise<{
    observation: AgentObservation;
    plan: ActionPlan;
    result: SkillResult;
    reflection: SelfCheckResult;
  }> {
    const observation = this.observe();

    if (observation.checkpointPending) {
      const canContinue = await this.handleCheckpoint();
      if (!canContinue) {
        throw new CheckpointPausedError(observation.pendingCheckpoint!);
      }
    }

    const actionPlan = this.plan();
    const result = await this.act(actionPlan);
    const reflection = await this.reflect();

    return { observation, plan: actionPlan, result, reflection };
  }

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  reset(): void {
    usePipelineStore.getState().reset();
    this._completedSkills.clear();
    this._checkpointPassed.clear();
    this._lastResult = null;
    this._skillInvoker = null;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private arePhaseSkillsDone(phase: Phase): boolean {
    const required = PHASE_SKILLS[phase] ?? [];
    if (required.length === 0) return false;
    return required.every((skill) => this._completedSkills.has(skill));
  }

  private transitionTo(target: Phase): void {
    this._completedSkills.clear();
    this.patchStore({ currentPhase: target });
  }

  private resolveCheckpoint(phase: Phase): Checkpoint | null {
    return PHASE_CHECKPOINTS[phase] ?? null;
  }
}

// ---------------------------------------------------------------------------
// CheckpointPausedError
// ---------------------------------------------------------------------------

export class CheckpointPausedError extends Error {
  readonly checkpoint: Checkpoint;

  constructor(checkpoint: Checkpoint) {
    super(`Pipeline paused at checkpoint: ${checkpoint}`);
    this.name = 'CheckpointPausedError';
    this.checkpoint = checkpoint;
  }
}

// ---------------------------------------------------------------------------
// Default singleton
// ---------------------------------------------------------------------------

export const agent = new AgentStateMachine();
