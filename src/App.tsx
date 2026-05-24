import { useState, useCallback, useEffect } from 'react';
import { ArticleInput } from './components/ArticleInput';
import { ThemePicker } from './components/ThemePicker';
import { VoicePicker } from './components/VoicePicker';
import { Stage } from './components/Stage';
import { PipelineUI } from './components/PipelineUI';
import { SlideNav } from './components/SlideNav';
import { usePipelineState } from './lib/pipeline/state';
import { runPipeline } from './agent/orchestrator';
import type { Voice } from './lib/tts/minimax';
import './App.css';

function App() {
  const {
    phase,
    article,
    themeId,
    slides,
    error,
    setArticle,
    setThemeId,
    setScript,
    setOutline,
    setError,
    reset,
  } = usePipelineState();

  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [isRunning, setIsRunning] = useState(false);

  // Reset slide index when slides change
  useEffect(() => {
    if (slides && Array.isArray(slides) && slides.length > 0) {
      setCurrentSlide(1);
    }
  }, [slides]);

  const handleArticleSubmit = useCallback(
    (text: string) => {
      setArticle(text);
    },
    [setArticle],
  );

  const handleThemeSelect = useCallback(
    (theme: { id: string }) => {
      setThemeId(theme.id);
    },
    [setThemeId],
  );

  const handleVoiceSelect = useCallback((voice: Voice) => {
    setSelectedVoice(voice);
  }, []);

  const handleSlidePrev = useCallback(() => {
    setCurrentSlide((prev) => Math.max(1, prev - 1));
  }, []);

  const handleSlideNext = useCallback(() => {
    setCurrentSlide((prev) => {
      const total = slides && Array.isArray(slides) ? slides.length : 1;
      return Math.min(total, prev + 1);
    });
  }, [slides]);

  const handleStartPipeline = useCallback(async () => {
    if (!article || article.trim().length === 0) {
      setError('Please enter an article first');
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const result = await runPipeline(article, {
        theme: themeId,
        voice: selectedVoice?.id ?? 'male-qn-qingse',
        onProgress: () => {
          // Progress tracked via PipelineUI using usePipelineState
        },
      });

      if (result.script) setScript(result.script);
      if (result.outline) setOutline(result.outline);
      if (result.errors.length > 0) {
        setError(result.errors.join('\n'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }, [article, themeId, selectedVoice, setArticle, setScript, setOutline, setError]);

  const handleReset = useCallback(() => {
    reset();
    setSelectedVoice(null);
    setCurrentSlide(1);
    setIsRunning(false);
  }, [reset]);

  const totalSlides =
    slides && Array.isArray(slides) ? slides.length : 0;

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">Slide Narrator</h1>
        <p className="app-subtitle">AI-powered video presentation generator</p>
      </header>

      {/* Main content */}
      <main className="app-main">
        {/* Left panel: configuration */}
        <section className="app-panel app-config">
          <ArticleInput
            onSubmit={handleArticleSubmit}
            disabled={isRunning}
          />

          <ThemePicker
            onSelect={handleThemeSelect}
            selectedTheme={themeId}
          />

          <VoicePicker
            onSelect={handleVoiceSelect}
            selectedVoice={selectedVoice?.id}
          />

          {/* Pipeline controls */}
          <div className="app-actions">
            <button
              type="button"
              className="app-btn app-btn-primary"
              onClick={handleStartPipeline}
              disabled={isRunning || !article}
            >
              {isRunning ? 'Running...' : 'Start Pipeline'}
            </button>

            <button
              type="button"
              className="app-btn app-btn-secondary"
              onClick={handleReset}
              disabled={isRunning}
            >
              Reset
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="app-error">
              <span className="app-error-icon">⚠</span>
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* Right panel: preview */}
        <section className="app-panel app-preview">
          {/* Pipeline progress */}
          <PipelineUI />

          {/* Stage preview with SlideNav */}
          {totalSlides > 0 && (
            <div className="app-stage-wrapper">
              <Stage
                chapter={1}
                step={currentSlide}
                totalSteps={totalSlides}
                onPrev={handleSlidePrev}
                onNext={handleSlideNext}
              >
                <div className="stage-slide-content">
                  <p>Slide {currentSlide} of {totalSlides}</p>
                </div>
              </Stage>

              <SlideNav
                currentSlide={currentSlide}
                totalSlides={totalSlides}
                onPrev={handleSlidePrev}
                onNext={handleSlideNext}
                disabled={isRunning}
              />
            </div>
          )}

          {/* Empty state */}
          {totalSlides === 0 && phase === 'idle' && (
            <div className="app-empty">
              <p>Enter an article and click "Start Pipeline" to generate slides.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;