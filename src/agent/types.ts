/**
 * Agent pipeline types: phases, checkpoints, pipeline state, and skill results.
 *
 * Uses `as const` objects instead of `enum` to satisfy erasableSyntaxOnly.
 * Consumed by AgentStateMachine (core.ts) and the Zustand pipeline store.
 */

// ---------------------------------------------------------------------------
// Phase – pipeline stages (per task spec, UPPERCASE)
// ---------------------------------------------------------------------------

export const Phase = {
  CONTENT_AUTHORING: 'CONTENT_AUTHORING',
  WEB_DEV_CH1: 'WEB_DEV_CH1',
  WEB_DEV_CH2N: 'WEB_DEV_CH2N',
  AUDIO_SYNTHESIS: 'AUDIO_SYNTHESIS',
  RECORDING: 'RECORDING',
} as const;

export type Phase = (typeof Phase)[keyof typeof Phase];

/** Ordered phase sequence for transition logic */
export const PHASE_ORDER: readonly Phase[] = [
  Phase.CONTENT_AUTHORING,
  Phase.WEB_DEV_CH1,
  Phase.WEB_DEV_CH2N,
  Phase.AUDIO_SYNTHESIS,
  Phase.RECORDING,
];

// ---------------------------------------------------------------------------
// Checkpoint – mandatory pause points (per task spec, UPPERCASE)
// ---------------------------------------------------------------------------

export const Checkpoint = {
  PLAN: 'PLAN',
  AUDIO: 'AUDIO',
  COMPLETE: 'COMPLETE',
} as const;

export type Checkpoint = (typeof Checkpoint)[keyof typeof Checkpoint];

export type CheckpointStatus = 'pending' | 'passed' | 'failed';

// ---------------------------------------------------------------------------
// PipelineState – snapshottable pipeline progress
// ---------------------------------------------------------------------------

export interface PipelineState {
  phase: Phase;
  checkpoint: Checkpoint;
  articlePath?: string;
  scriptPath?: string;
  outlinePath?: string;
  currentChapter: number;
  totalChapters: number;
  currentStep: number;
  totalSteps: number;
  theme?: string;
  voice?: string;
}

// ---------------------------------------------------------------------------
// SkillResult – agent‑level skill invocation outcome
// ---------------------------------------------------------------------------

export interface SkillResult {
  success: boolean;
  output?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// SkillInvoker – dependency‑injected function for callSkill
// ---------------------------------------------------------------------------

export type SkillInvoker = (
  skillName: string,
  params: Record<string, unknown>,
) => Promise<SkillResult>;

// ---------------------------------------------------------------------------
// ActionPlan – what the agent decides to do after planning
// ---------------------------------------------------------------------------

export interface ActionPlan {
  phase: Phase;
  skills: string[];
  checkpoint?: Checkpoint;
  reason: string;
}

// ---------------------------------------------------------------------------
// SelfCheckResult – outcome of the self‑check protocol (自检协议)
// ---------------------------------------------------------------------------

export interface SelfCheckResult {
  passed: boolean;
  issues: string[];
  fixes: string[];
  report: string;
}

// ---------------------------------------------------------------------------
// AgentObservation – what observe() returns
// ---------------------------------------------------------------------------

export interface AgentObservation {
  currentPhase: Phase;
  phaseComplete: boolean;
  checkpointPending: boolean;
  pendingCheckpoint: Checkpoint | null;
  errors: string[];
  lastResult: SkillResult | null;
}

// ---------------------------------------------------------------------------
// SkillEntry – registered skill metadata
// ---------------------------------------------------------------------------

export interface SkillEntry {
  name: string;
  description: string;
  phase: Phase;
}

// ---------------------------------------------------------------------------
// Default pipeline state
// ---------------------------------------------------------------------------

export const DEFAULT_PIPELINE_STATE: PipelineState = {
  phase: Phase.CONTENT_AUTHORING,
  checkpoint: Checkpoint.PLAN,
  currentChapter: 1,
  totalChapters: 0,
  currentStep: 1,
  totalSteps: 0,
};
