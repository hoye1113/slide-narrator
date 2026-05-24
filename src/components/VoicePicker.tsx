/**
 * VoicePicker — Chinese voice selection UI.
 *
 * Displays available Chinese TTS voices from MiniMax, allows previewing
 * audio samples, and calls `onSelect` when the user picks a voice.
 *
 * For v1, returns the known set of Chinese voices (from mmx-cli).
 * The Node.js agent pipeline (`minimax.ts`) can fetch live data.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Voice } from '../lib/tts/minimax';

// ---------------------------------------------------------------------------
// Known Chinese voices (stable list from mmx-cli, v1 scope)
// ---------------------------------------------------------------------------

const CHINESE_VOICES: Voice[] = [
  { id: 'male-qn-qingse', name: '男声-青涩', language: 'zh-CN' },
  { id: 'female-shaonv', name: '女声-少女', language: 'zh-CN' },
  { id: 'presenter_male', name: '男主播', language: 'zh-CN' },
  { id: 'presenter_female', name: '女主播', language: 'zh-CN' },
];

// ---------------------------------------------------------------------------
// Preview constants
// ---------------------------------------------------------------------------

/** Default preview text used for TTS sample synthesis */
const DEFAULT_PREVIEW_TEXT = '你好，欢迎收听科普视频。';

/** Preview audio cache: voiceId → blob URL */
const previewCache = new Map<string, string>();

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VoicePickerProps {
  /** Called when the user selects a voice */
  onSelect: (voice: Voice) => void;
  /** Currently selected voice ID (for controlled mode) */
  selectedVoice?: string;
  /** Optional CSS class name */
  className?: string;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  title: {
    fontFamily: 'var(--heading)',
    fontSize: '16px',
    fontWeight: 500,
    color: 'var(--text-h)',
    margin: 0,
  },
  subtitle: {
    fontFamily: 'var(--sans)',
    fontSize: '13px',
    color: 'var(--text)',
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '8px',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    fontSize: '14px',
    color: 'var(--text)',
  },
  cardSelected: {
    borderColor: 'var(--accent)',
    boxShadow: '0 0 0 1px var(--accent-border)',
    background: 'var(--accent-bg)',
  },
  cardHover: {
    borderColor: 'var(--accent-border)',
  },
  voiceInfo: {
    flex: 1,
    minWidth: 0,
  },
  voiceName: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-h)',
    lineHeight: '1.4',
  },
  voiceLang: {
    display: 'block',
    fontSize: '11px',
    color: 'var(--text)',
    lineHeight: '1.3',
    marginTop: '2px',
  },
  previewBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '1px solid var(--border)',
    background: 'var(--code-bg)',
    cursor: 'pointer',
    padding: 0,
    fontSize: '14px',
    color: 'var(--text)',
    flexShrink: 0,
    transition: 'background 0.15s ease, color 0.15s ease',
  },
  previewBtnActive: {
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
    borderColor: 'var(--accent-border)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    color: 'var(--text)',
    fontFamily: 'var(--sans)',
    fontSize: '14px',
    gap: '8px',
  },
  error: {
    padding: '8px 12px',
    borderRadius: '6px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
    fontSize: '13px',
    fontFamily: 'var(--sans)',
  },
  checkmark: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 700,
    flexShrink: 0,
  },
  previewing: {
    opacity: 0.5,
    pointerEvents: 'none' as const,
  },
} satisfies Record<string, React.CSSProperties>;

// ---------------------------------------------------------------------------
// Speaker SVG icon (inline, no external dependency)
// ---------------------------------------------------------------------------

function SpeakerIcon({ playing }: { playing: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {playing ? (
        <>
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </>
      ) : (
        <>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// VoicePicker component
// ---------------------------------------------------------------------------

export function VoicePicker({
  onSelect,
  selectedVoice,
  className,
}: VoicePickerProps) {
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [hoveredVoice, setHoveredVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewTimeouts = useRef<Map<string, number>>(new Map());

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      previewTimeouts.current.forEach((t) => clearTimeout(t));
      previewTimeouts.current.clear();
    };
  }, []);

  // -----------------------------------------------------------------------
  // Preview handling
  // -----------------------------------------------------------------------

  const fetchPreview = useCallback(async (voiceId: string): Promise<string | null> => {
    // Check cache first
    const cached = previewCache.get(voiceId);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        voice: voiceId,
        text: DEFAULT_PREVIEW_TEXT,
      });
      const res = await fetch(`/api/tts/preview?${params}`);

      if (!res.ok) {
        throw new Error(`Preview failed: ${res.status} ${res.statusText}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      previewCache.set(voiceId, url);
      return url;
    } catch {
      // Backend not available — try alternative pattern
      try {
        const res = await fetch(`/api/tts/preview/${encodeURIComponent(voiceId)}`);
        if (!res.ok) throw new Error('Not found');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        previewCache.set(voiceId, url);
        return url;
      } catch {
        return null;
      }
    }
  }, []);

  const handlePreview = useCallback(
    async (voiceId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      setPreviewError(null);

      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // If already previewing this voice, just stop
      if (previewing === voiceId) {
        setPreviewing(null);
        return;
      }

      setPreviewing(voiceId);

      const url = await fetchPreview(voiceId);

      if (!url) {
        setPreviewError(`预览暂不可用（voice: ${voiceId}）`);
        // Auto-clear error after 3s
        const tid = window.setTimeout(() => setPreviewError(null), 3000);
        previewTimeouts.current.set('error', tid);
        setPreviewing(null);
        return;
      }

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setPreviewing(null);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setPreviewError('音频播放失败');
        setPreviewing(null);
        audioRef.current = null;
        const tid = window.setTimeout(() => setPreviewError(null), 3000);
        previewTimeouts.current.set('error', tid);
      };

      await audio.play().catch(() => {
        setPreviewError('音频播放被阻止');
        setPreviewing(null);
        audioRef.current = null;
        const tid = window.setTimeout(() => setPreviewError(null), 3000);
        previewTimeouts.current.set('error', tid);
      });
    },
    [previewing, fetchPreview],
  );

  // -----------------------------------------------------------------------
  // Selection
  // -----------------------------------------------------------------------

  const handleSelect = useCallback(
    (voice: Voice) => {
      onSelect(voice);
    },
    [onSelect],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className={className} style={styles.container}>
      <div>
        <h3 style={styles.title}>选择配音声线</h3>
        <p style={styles.subtitle}>
          共 {CHINESE_VOICES.length} 种中文声线可选
        </p>
      </div>

      {previewError && <div style={styles.error}>{previewError}</div>}

      <div style={styles.grid} role="radiogroup" aria-label="中文声线选择">
        {CHINESE_VOICES.map((voice) => {
          const isSelected = selectedVoice === voice.id;
          const isPreviewing = previewing === voice.id;
          const isHovered = hoveredVoice === voice.id;

          return (
            <button
              key={voice.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              style={{
                ...styles.card,
                ...(isSelected ? styles.cardSelected : {}),
                ...(isHovered && !isSelected ? styles.cardHover : {}),
              }}
              onClick={() => handleSelect(voice)}
              onMouseEnter={() => setHoveredVoice(voice.id)}
              onMouseLeave={() => setHoveredVoice(null)}
            >
              <div style={styles.voiceInfo}>
                <span style={styles.voiceName}>{voice.name}</span>
                <span style={styles.voiceLang}>{voice.language}</span>
              </div>

              <button
                type="button"
                style={{
                  ...styles.previewBtn,
                  ...(isPreviewing ? styles.previewBtnActive : {}),
                }}
                onClick={(e) => handlePreview(voice.id, e)}
                title={isPreviewing ? '停止预览' : '试听'}
                aria-label={isPreviewing ? `停止试听 ${voice.name}` : `试听 ${voice.name}`}
              >
                <SpeakerIcon playing={isPreviewing} />
              </button>

              {isSelected && (
                <div style={styles.checkmark} aria-label="已选择">
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default VoicePicker;
