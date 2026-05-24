/**
 * Pipeline state persistence using Zustand with localStorage middleware.
 *
 * Auto-saves after every state change (via persist middleware).
 * Auto-restores on app start (via hydration).
 * Non-blocking: localStorage is synchronous but fast (<1ms typical).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'slide-narrator-pipeline-state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PipelinePhase =
  | 'idle'
  | 'script'
  | 'outline'
  | 'slides'
  | 'tts'
  | 'recording'
  | 'complete'
  | 'error';

export interface PipelineState {
  phase: PipelinePhase;
  article: string;
  script: string | null;
  outline: string | null;
  themeId: string;
  slides: unknown[] | null;
  audioPath: string | null;
  srtPath: string | null;
  error: string | null;
}

export interface PipelineActions {
  setPhase: (phase: PipelinePhase) => void;
  setArticle: (article: string) => void;
  setScript: (script: string | null) => void;
  setOutline: (outline: string | null) => void;
  setThemeId: (themeId: string) => void;
  setSlides: (slides: unknown[] | null) => void;
  setAudioPath: (path: string | null) => void;
  setSrtPath: (path: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export type PipelineStore = PipelineState & PipelineActions;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: PipelineState = {
  phase: 'idle',
  article: '',
  script: null,
  outline: null,
  themeId: 'default',
  slides: null,
  audioPath: null,
  srtPath: null,
  error: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePipelineState = create<PipelineStore>()(
  persist(
    (set) => ({
      ...initialState,

      setPhase: (phase) => set({ phase, error: null }),

      setArticle: (article) => set({ article }),

      setScript: (script) => set({ script }),

      setOutline: (outline) => set({ outline }),

      setThemeId: (themeId) => set({ themeId }),

      setSlides: (slides) => set({ slides }),

      setAudioPath: (audioPath) => set({ audioPath }),

      setSrtPath: (srtPath) => set({ srtPath }),

      setError: (error) => set({ error, phase: 'error' }),

      reset: () => set(initialState),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Auto-save on every state change — built-in persist behavior
      // Non-blocking: localStorage is synchronous (<1ms typical),
      // no need for async wrappers
    },
  ),
);

// ---------------------------------------------------------------------------
// restoreState – manually read persisted state from localStorage
// Useful for: checking if a previous session exists before hydrating the store
// ---------------------------------------------------------------------------

export function restoreState(): PipelineState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Zustand persist stores state under a "state" key
    return (parsed?.state as PipelineState) ?? null;
  } catch {
    return null;
  }
}
