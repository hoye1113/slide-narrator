import { useState, useCallback, useRef, type ChangeEvent, type DragEvent } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORDS_PER_MINUTE = 150;
const MIN_WORD_COUNT = 100;
const ACCEPTED_TYPES = ['.md', '.txt', 'text/plain', 'text/markdown'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ArticleInputProps {
  /** Called when the user submits a valid article */
  onSubmit: (article: string) => void;
  /** Disable input and button (e.g. during processing) */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Count words in a string (handles CJK characters as individual words).
 */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  // Count CJK characters individually, group Latin words by whitespace
  const cjkChars = (trimmed.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) ?? []).length;
  const latinWords = trimmed
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;

  return cjkChars + latinWords;
}

/**
 * Estimate video length in minutes (150 words/min).
 */
function estimateLength(wordCount: number): string {
  if (wordCount === 0) return '';
  const minutes = Math.ceil(wordCount / WORDS_PER_MINUTE);
  return `~${minutes} min`;
}

/**
 * Read a File as text.
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Check if a File matches accepted types.
 */
function isAcceptedFile(file: File): boolean {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_TYPES.includes(extension);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto',
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
  dropZone: {
    position: 'relative' as const,
    borderRadius: '8px',
    border: '2px dashed var(--border)',
    background: 'var(--bg)',
    transition: 'border-color 0.15s ease, background 0.15s ease',
    cursor: 'text',
  },
  dropZoneActive: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-bg)',
  },
  dropOverlay: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    background: 'rgba(0, 0, 0, 0.03)',
    fontFamily: 'var(--sans)',
    fontSize: '14px',
    color: 'var(--accent)',
    pointerEvents: 'none' as const,
    zIndex: 1,
  },
  textarea: {
    width: '100%',
    minHeight: '240px',
    padding: '16px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    fontFamily: 'var(--mono)',
    fontSize: '14px',
    lineHeight: '1.7',
    color: 'var(--text)',
    resize: 'vertical' as const,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  textareaDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  stats: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontFamily: 'var(--sans)',
    fontSize: '13px',
    color: 'var(--text)',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  statValue: {
    fontWeight: 500,
    color: 'var(--text-h)',
  },
  warning: {
    color: '#f59e0b',
  },
  error: {
    color: '#ef4444',
  },
  warningText: {
    fontFamily: 'var(--sans)',
    fontSize: '12px',
    color: '#f59e0b',
    margin: 0,
  },
  errorText: {
    fontFamily: 'var(--sans)',
    fontSize: '12px',
    color: '#ef4444',
    margin: 0,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  uploadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--code-bg)',
    cursor: 'pointer',
    fontFamily: 'var(--sans)',
    fontSize: '13px',
    color: 'var(--text)',
    transition: 'border-color 0.15s ease, background 0.15s ease',
  },
  uploadBtnHover: {
    borderColor: 'var(--accent-border)',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 24px',
    borderRadius: '6px',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'var(--sans)',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'opacity 0.15s ease',
  },
  submitBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  fileInput: {
    display: 'none',
  },
} satisfies Record<string, React.CSSProperties>;

// ---------------------------------------------------------------------------
// Upload icon (inline SVG)
// ---------------------------------------------------------------------------

function UploadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ArticleInput component
// ---------------------------------------------------------------------------

export function ArticleInput({ onSubmit, disabled }: ArticleInputProps) {
  const [article, setArticle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadHovered, setUploadHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = countWords(article);
  const estimatedLength = estimateLength(wordCount);
  const isBelowMinimum = wordCount > 0 && wordCount < MIN_WORD_COUNT;
  const canSubmit = wordCount >= MIN_WORD_COUNT && !disabled;

  // -----------------------------------------------------------------------
  // Text input
  // -----------------------------------------------------------------------

  const handleTextChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setArticle(e.target.value);
    setError(null);
  }, []);

  // -----------------------------------------------------------------------
  // File handling
  // -----------------------------------------------------------------------

  const handleFile = useCallback(async (file: File) => {
    if (!isAcceptedFile(file)) {
      setError(`Unsupported file type. Accepted: ${ACCEPTED_TYPES.join(', ')}`);
      return;
    }

    try {
      const text = await readFileAsText(file);
      setArticle((prev) => (prev ? `${prev}\n\n${text}` : text));
      setError(null);
    } catch {
      setError('Failed to read file.');
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [handleFile],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // -----------------------------------------------------------------------
  // Drag & drop
  // -----------------------------------------------------------------------

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    setError(null);
    onSubmit(article);
  }, [article, canSubmit, onSubmit]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div style={styles.container}>
      <div>
        <h3 style={styles.title}>输入文章</h3>
        <p style={styles.subtitle}>
          粘贴文章内容或拖入 .md / .txt 文件。最少 {MIN_WORD_COUNT} 字。
        </p>
      </div>

      {error && <p style={styles.errorText}>{error}</p>}

      <div
        style={{
          ...styles.dropZone,
          ...(isDragOver ? styles.dropZoneActive : {}),
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div style={styles.dropOverlay}>释放文件以导入</div>
        )}

        <textarea
          value={article}
          onChange={handleTextChange}
          placeholder={`在此粘贴文章内容...\n\n支持格式: Markdown (.md), 纯文本 (.txt)\n\n也可拖拽文件到此处`}
          style={{
            ...styles.textarea,
            ...(disabled ? styles.textareaDisabled : {}),
          }}
          disabled={disabled}
          aria-label="文章内容输入"
        />
      </div>

      <div style={styles.footer}>
        <div style={styles.stats}>
          <span style={styles.statItem}>
            字数: <span style={styles.statValue}>{wordCount.toLocaleString()}</span>
          </span>
          {estimatedLength && (
            <span style={styles.statItem}>
              预计时长: <span style={styles.statValue}>{estimatedLength}</span>
            </span>
          )}
          {isBelowMinimum && (
            <span style={styles.warningText}>
              至少需要 {MIN_WORD_COUNT} 字（当前 {wordCount} 字）
            </span>
          )}
        </div>

        <div style={styles.actions}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            style={styles.fileInput}
            onChange={handleFileSelect}
            aria-label="选择文件"
          />
          <button
            type="button"
            style={{
              ...styles.uploadBtn,
              ...(uploadHovered ? styles.uploadBtnHover : {}),
            }}
            onClick={handleUploadClick}
            onMouseEnter={() => setUploadHovered(true)}
            onMouseLeave={() => setUploadHovered(false)}
            disabled={disabled}
          >
            <UploadIcon />
            导入文件
          </button>
          <button
            type="button"
            style={{
              ...styles.submitBtn,
              ...(!canSubmit ? styles.submitBtnDisabled : {}),
            }}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            开始生成
          </button>
        </div>
      </div>
    </div>
  );
}

export default ArticleInput;
