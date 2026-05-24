/**
 * PipelineUI — Real-time pipeline progress display.
 *
 * Shows the 5-phase pipeline (Content Authoring → Slides → TTS → Recording)
 * with step indicators, phase-specific output previews, and error reporting.
 *
 * Auto-flow: no manual confirmation buttons needed between phases.
 */

import { usePipelineState } from '../lib/pipeline/state';
import type { PipelinePhase } from '../lib/pipeline/state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhaseDefinition {
  id: PipelinePhase;
  label: string;
  sublabel: string;
}

type PhaseStatus = 'pending' | 'active' | 'completed' | 'failed';

// ---------------------------------------------------------------------------
// Phase definitions — ordered step list matching pipeline order
// ---------------------------------------------------------------------------

const PHASES: PhaseDefinition[] = [
  { id: 'script',    label: 'Content Authoring', sublabel: 'Script & Outline generation' },
  { id: 'outline',   label: 'Outline',           sublabel: 'Structure planning'          },
  { id: 'slides',    label: 'Slides',            sublabel: 'HTML slide generation'      },
  { id: 'tts',       label: 'Audio Synthesis',   sublabel: 'TTS + Subtitles'           },
  { id: 'recording', label: 'Recording',         sublabel: 'MP4 video encoding'        },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Animated pulsing dot for the active phase */
function ActiveDot() {
  return (
    <span style={{
      display: 'inline-block',
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: 'var(--accent)',
      animation: 'pipeline-pulse 1.2s ease-in-out infinite',
    }} />
  );
}

/** Step indicator circle */
function PhaseCircle({ status, label }: { status: PhaseStatus; label: string }) {
  const styles: Record<PhaseStatus, { bg: string; color: string; border: string }> = {
    pending:   { bg: 'var(--bg)',         color: 'var(--text)',    border: 'var(--border)'     },
    active:    { bg: 'var(--accent-bg)',  color: 'var(--accent)',   border: 'var(--accent-border)'},
    completed: { bg: 'var(--accent)',     color: '#fff',           border: 'var(--accent)'      },
    failed:    { bg: '#dc2626',           color: '#fff',           border: '#dc2626'            },
  };
  const s = styles[status];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: s.bg,
        color: s.color,
        border: `2px solid ${s.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        fontWeight: 600,
        fontFamily: 'var(--mono)',
        transition: 'all 0.2s ease',
        ...(status === 'active' ? { boxShadow: '0 0 0 4px var(--accent-bg)' } : {}),
      }}>
        {status === 'completed' ? '✓' : status === 'failed' ? '✗' : status === 'active' ? <ActiveDot /> : label}
      </div>
    </div>
  );
}

/** Connector line between phase circles */
function PhaseConnector({ status }: { status: 'filled' | 'empty' }) {
  return (
    <div style={{
      flex: 1,
      height: '2px',
      background: status === 'filled' ? 'var(--accent)' : 'var(--border)',
      transition: 'background 0.3s ease',
      margin: '0 4px',
      alignSelf: 'center',
      marginTop: '-20px',
    }} />
  );
}

/** Preview card for a specific phase output */
function PreviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '8px',
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--code-bg)',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        fontFamily: 'var(--mono)',
      }}>
        {title}
      </div>
      <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text)' }}>
        {children}
      </div>
    </div>
  );
}

/** Truncated text preview with line count */
function TextPreview({ text, maxLines = 4 }: { text: string; maxLines?: number }) {
  const allLines = text.split('\n');
  const lines = allLines.slice(0, maxLines);
  const truncated = lines.join('\n');
  const isTruncated = allLines.length > maxLines;

  return (
    <div style={{
      fontFamily: 'var(--mono)',
      fontSize: '12px',
      lineHeight: '1.6',
      color: 'var(--text)',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {truncated}
      {isTruncated && (
        <span style={{ color: 'var(--accent)', display: 'block', marginTop: '4px' }}>
          … ({allLines.length} lines total)
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase preview renderers
// ---------------------------------------------------------------------------

function ScriptPreview({ script }: { script: string | null }) {
  if (!script) return <span style={{ color: 'var(--text)', fontStyle: 'italic' }}>Waiting for script generation…</span>;
  return <TextPreview text={script} maxLines={6} />;
}

function OutlinePreview({ outline }: { outline: string | null }) {
  if (!outline) return <span style={{ color: 'var(--text)', fontStyle: 'italic' }}>Waiting for outline generation…</span>;
  return <TextPreview text={outline} maxLines={8} />;
}

function SlidesPreview({ slides, themeId }: { slides: unknown[] | null; themeId: string }) {
  const count = slides ? (Array.isArray(slides) ? slides.length : Object.keys(slides).length) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
        <span style={{ color: 'var(--text)' }}>
          Slides: <strong style={{ color: 'var(--text-h)' }}>{count || '—'}</strong>
        </span>
        <span style={{ color: 'var(--text)' }}>
          Theme: <strong style={{ color: 'var(--text-h)', fontFamily: 'var(--mono)' }}>{themeId}</strong>
        </span>
      </div>
      {count > 0 && (
        <div style={{
          display: 'flex',
          gap: '4px',
          flexWrap: 'wrap',
        }}>
          {Array.from({ length: Math.min(count, 12) }).map((_, i) => (
            <div key={i} style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              background: 'var(--code-bg)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontFamily: 'var(--mono)',
              color: 'var(--text)',
            }}>
              {i + 1}
            </div>
          ))}
          {count > 12 && (
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              background: 'var(--accent-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: 'var(--accent)',
            }}>
              +{count - 12}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TTSPreview({ audioPath }: { audioPath: string | null }) {
  if (!audioPath) return <span style={{ color: 'var(--text)', fontStyle: 'italic' }}>Waiting for audio synthesis…</span>;
  const filename = audioPath.split('/').pop() ?? audioPath;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
      <span style={{ color: 'var(--text)' }}>
        File: <code style={{ fontFamily: 'var(--mono)', fontSize: '12px', background: 'var(--code-bg)', padding: '2px 6px', borderRadius: '4px' }}>{filename}</code>
      </span>
    </div>
  );
}

function RecordingPreview() {
  return (
    <span style={{ color: 'var(--text)', fontStyle: 'italic' }}>
      Waiting for recording to complete…
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PipelineUI() {
  const { phase, script, outline, slides, themeId, audioPath, error } = usePipelineState();

  // Map PipelinePhase to 5 display step indices
  // 'script'/'outline' both map to step 0 (Content Authoring)
  // 'slides' maps to step 2 (skipping outline as separate step)
  const phaseToStepIndex: Record<PipelinePhase, number> = {
    idle:      -1,
    script:    0,
    outline:   0,
    slides:    2,
    tts:       3,
    recording: 4,
    complete:  5,
    error:     -1,
  };

  const activeStep = phaseToStepIndex[phase] ?? -1;

  // Determine status for each display step
  const getStepStatus = (stepIdx: number): PhaseStatus => {
    if (phase === 'complete') return stepIdx < 5 ? 'completed' : 'pending';
    if (phase === 'error') {
      if (stepIdx < activeStep) return 'completed';
      if (stepIdx === activeStep) return 'failed';
      return 'pending';
    }
    if (stepIdx < activeStep) return 'completed';
    if (stepIdx === activeStep) return 'active';
    return 'pending';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      padding: '24px 0',
    }}>
      {/* Phase stepper */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0',
          overflowX: 'auto',
          paddingBottom: '8px',
        }}>
          {PHASES.map((phaseDef, idx) => {
            const status = getStepStatus(idx);
            const isLast = idx === PHASES.length - 1;
            return (
              <div key={phaseDef.id} style={{
                display: 'flex',
                alignItems: 'center',
                flex: isLast ? 'none' : 1,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <PhaseCircle status={status} label={String(idx + 1)} />
                  <div style={{
                    textAlign: 'center',
                    maxWidth: '72px',
                  }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: status === 'active' ? 'var(--accent)' : status === 'completed' ? 'var(--text-h)' : 'var(--text)',
                      lineHeight: '1.3',
                    }}>
                      {phaseDef.label}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: 'var(--text)',
                      lineHeight: '1.3',
                      marginTop: '2px',
                    }}>
                      {phaseDef.sublabel}
                    </div>
                  </div>
                </div>
                {!isLast && <PhaseConnector status={status === 'completed' ? 'filled' : 'empty'} />}
              </div>
            );
          })}
        </div>

        {/* Current phase label */}
        {phase !== 'idle' && phase !== 'complete' && phase !== 'error' && (
          <div style={{
            marginTop: '12px',
            fontSize: '12px',
            color: 'var(--accent)',
            fontFamily: 'var(--mono)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'pipeline-pulse 1.2s ease-in-out infinite',
              display: 'inline-block',
            }} />
            Running: {PHASES[activeStep]?.label ?? phase}
          </div>
        )}
      </div>

      {/* Phase-specific previews */}
      {activeStep >= 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          {/* Script / Content Authoring preview (step 0) */}
          {activeStep === 0 && (
            <PreviewCard title="Script Output">
              <ScriptPreview script={script} />
            </PreviewCard>
          )}

          {/* Outline preview (shown alongside script when available) */}
          {(activeStep === 0 || phase === 'outline') && outline && (
            <PreviewCard title="Outline Structure">
              <OutlinePreview outline={outline} />
            </PreviewCard>
          )}

          {/* Slides preview (step 2) */}
          {activeStep === 2 && (
            <PreviewCard title="Generated Slides">
              <SlidesPreview slides={slides} themeId={themeId} />
            </PreviewCard>
          )}

          {/* TTS preview (step 3) */}
          {activeStep === 3 && (
            <PreviewCard title="Audio Synthesis">
              <TTSPreview audioPath={audioPath} />
            </PreviewCard>
          )}

          {/* Recording preview (step 4) */}
          {activeStep === 4 && (
            <PreviewCard title="Video Recording">
              <RecordingPreview />
            </PreviewCard>
          )}
        </div>
      )}

      {/* Always show available previews if data exists */}
      {phase === 'complete' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          {script && (
            <PreviewCard title="Final Script">
              <ScriptPreview script={script} />
            </PreviewCard>
          )}
          {outline && (
            <PreviewCard title="Final Outline">
              <OutlinePreview outline={outline} />
            </PreviewCard>
          )}
          {slides && (
            <PreviewCard title="Generated Slides">
              <SlidesPreview slides={slides} themeId={themeId} />
            </PreviewCard>
          )}
          {audioPath && (
            <PreviewCard title="Audio Output">
              <TTSPreview audioPath={audioPath} />
            </PreviewCard>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
        }}>
          <span style={{
            fontSize: '16px',
            lineHeight: '1',
            color: '#dc2626',
            flexShrink: 0,
          }}>
            ⚠
          </span>
          <div style={{ fontSize: '13px', color: 'var(--text-h)', lineHeight: '1.5' }}>
            <strong style={{ display: 'block', marginBottom: '4px', color: '#dc2626' }}>Pipeline Error</strong>
            {error}
          </div>
        </div>
      )}

      {/* CSS animation for pulse */}
      <style>{`
        @keyframes pipeline-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}

export default PipelineUI;