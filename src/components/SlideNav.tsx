import { useEffect, useCallback } from 'react';
import './SlideNav.css';

export interface SlideNavProps {
  currentSlide: number;
  totalSlides: number;
  onPrev?: () => void;
  onNext?: () => void;
  disabled?: boolean;
}

/**
 * Slide navigation controls with prev/next buttons,
 * current slide indicator, and keyboard arrow key support.
 */
export function SlideNav({
  currentSlide,
  totalSlides,
  onPrev,
  onNext,
  disabled,
}: SlideNavProps) {
  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        onPrev?.();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        onNext?.();
      }
    },
    [disabled, onPrev, onNext],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const canGoPrev = currentSlide > 1;
  const canGoNext = currentSlide < totalSlides;

  return (
    <div className="slidenav-container">
      <button
        type="button"
        className="slidenav-btn slidenav-prev"
        onClick={onPrev}
        disabled={disabled || !canGoPrev}
        aria-label="Previous slide"
        title="Previous slide (←)"
      >
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
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="slidenav-indicator" aria-live="polite">
        <span className="slidenav-current">{currentSlide}</span>
        <span className="slidenav-sep">/</span>
        <span className="slidenav-total">{totalSlides}</span>
      </div>

      <button
        type="button"
        className="slidenav-btn slidenav-next"
        onClick={onNext}
        disabled={disabled || !canGoNext}
        aria-label="Next slide"
        title="Next slide (→)"
      >
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
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}

export default SlideNav;