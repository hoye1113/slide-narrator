import { create } from 'zustand';

// Inline state types to avoid verbatimModuleSyntax cross-module issues
type Phase = 'CONTENT_AUTHORING' | 'WEB_DEV_CH1' | 'WEB_DEV_CH2N' | 'AUDIO_SYNTHESIS' | 'RECORDING';
type Checkpoint = 'PLAN' | 'AUDIO' | 'COMPLETE';
type CheckpointStatus = 'pending' | 'passed' | 'failed';

interface SkillResult {
  skillName: string;
  success: boolean;
  output: unknown;
  error?: string;
  timestamp: number;
}

interface PhaseHistoryEntry {
  phase: Phase;
  results: SkillResult[];
}

interface PipelineStateData {
  currentPhase: Phase;
  checkpointStatus: Record<Checkpoint, CheckpointStatus>;
  article: string | null;
  script: string | null;
  outline: string | null;
  errors: string[];
  phaseHistory: PhaseHistoryEntry[];
  isRunning: boolean;
}

interface PipelineStore extends PipelineStateData {
  setPhase: (phase: Phase) => void;
  setCheckpointStatus: (checkpoint: Checkpoint, status: CheckpointStatus) => void;
  setArticle: (article: string) => void;
  setScript: (script: string) => void;
  setOutline: (outline: string) => void;
  addError: (error: string) => void;
  clearErrors: () => void;
  addPhaseResult: (phase: Phase, result: SkillResult) => void;
  setRunning: (running: boolean) => void;
  reset: () => void;
}

export type { Phase, Checkpoint, CheckpointStatus, SkillResult, PipelineStateData, PipelineStore };

const initialState: PipelineStateData = {
  currentPhase: 'CONTENT_AUTHORING',
  checkpointStatus: {
    PLAN: 'pending',
    AUDIO: 'pending',
    COMPLETE: 'pending',
  },
  article: null,
  script: null,
  outline: null,
  errors: [],
  phaseHistory: [],
  isRunning: false,
};

export const usePipelineStore = create<PipelineStore>()((set) => ({
  ...initialState,

  setPhase: (phase) => set({ currentPhase: phase }),

  setCheckpointStatus: (checkpoint, status) =>
    set((state) => ({
      checkpointStatus: { ...state.checkpointStatus, [checkpoint]: status },
    })),

  setArticle: (article) => set({ article }),

  setScript: (script) => set({ script }),

  setOutline: (outline) => set({ outline }),

  addError: (error) =>
    set((state) => ({ errors: [...state.errors, error] })),

  clearErrors: () => set({ errors: [] }),

  addPhaseResult: (phase, result) =>
    set((state) => {
      const existingIdx = state.phaseHistory.findIndex((h) => h.phase === phase);
      if (existingIdx >= 0) {
        const updated = [...state.phaseHistory];
        updated[existingIdx] = {
          ...updated[existingIdx],
          results: [...updated[existingIdx].results, result],
        };
        return { phaseHistory: updated };
      }
      return {
        phaseHistory: [...state.phaseHistory, { phase, results: [result] }],
      };
    }),

  setRunning: (isRunning) => set({ isRunning }),

  reset: () => set(initialState),
}));
