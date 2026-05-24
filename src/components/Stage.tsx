import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import './Stage.css';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

export interface StageProps {
  chapter: number;
  step: number;
  totalSteps?: number;
  onNext?: () => void;
  onPrev?: () => void;
  children?: ReactNode;
}

/**
 * Fixed 1920x1080 stage component that scales to browser window.
 * Designed for screen recording with clean presentation surface.
 */
export function Stage({
  chapter,
  step,
  totalSteps = 1,
  onNext,
  onPrev,
  children,
}: StageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [showProgress, setShowProgress] = useState(false);

  // Calculate scale factor based on window size
  useEffect(() => {
    const calculateScale = () => {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const scaleX = windowWidth / STAGE_WIDTH;
      const scaleY = windowHeight / STAGE_HEIGHT;
      setScale(Math.min(scaleX, scaleY));
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        onNext?.();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        onPrev?.();
      }
    },
    [onNext, onPrev]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const progress = totalSteps > 1 ? (step / totalSteps) * 100 : 0;

  return (
    <div
      className="stage-container"
      ref={containerRef}
      onMouseEnter={() => setShowProgress(true)}
      onMouseLeave={() => setShowProgress(false)}
    >
      <div
        className="stage-viewport"
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        <div className="stage-content">{children}</div>

        <div className={`stage-progress ${showProgress ? 'visible' : ''}`}>
          <div className="stage-progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <div className={`stage-nav-hint ${showProgress ? 'visible' : ''}`}>
          <span className="stage-chapter">Ch {chapter}</span>
          <span className="stage-step">Step {step}</span>
        </div>
      </div>
    </div>
  );
}

export default Stage;