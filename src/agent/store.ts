/**
 * Zustand pipeline store — single source of truth for AgentStateMachine.
 *
 * The hook-based `usePipelineStore` is for React components; the agent
 * accesses the same store via `getState()` / `setState()` (vanilla API).
 */

import { create } from 'zustand';
import type { Phase, Checkpoint, PipelineState } from './types';
import { DEFAULT_PIPELINE_STATE } from './types';

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface PipelineStoreState {
  pipeline: PipelineState;
  setPhase: (phase: Phase) => void;
  setCheckpoint: (checkpoint: Checkpoint) => void;
  updateState: (partial: Partial<PipelineState>) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePipelineStore = create<PipelineStoreState>((set) => ({
  pipeline: { ...DEFAULT_PIPELINE_STATE },

  setPhase: (phase: Phase) =>
    set((s) => ({ pipeline: { ...s.pipeline, phase } })),

  setCheckpoint: (checkpoint: Checkpoint) =>
    set((s) => ({ pipeline: { ...s.pipeline, checkpoint } })),

  updateState: (partial: Partial<PipelineState>) =>
    set((s) => ({ pipeline: { ...s.pipeline, ...partial } })),

  reset: () =>
    set({ pipeline: { ...DEFAULT_PIPELINE_STATE } }),
}));

/**
 * Convenience helper: read pipeline state outside of React (agent-friendly).
 */
export function getPipelineState(): PipelineState {
  return usePipelineStore.getState().pipeline;
}
