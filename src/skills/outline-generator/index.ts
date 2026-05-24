import type { SkillImplementation, SkillResult } from '../types';

/**
 * outline-generator: 从口播稿 + 原文生成开发计划
 *
 * Produces outline.md — chapter breakdown, per-step screen content, and info pool.
 * Follows OUTLINE-FORMAT.md rules:
 * - 每章 step数/估时
 * - 每步屏幕内容 (hero/数据/标语/列表项)
 * - 章节级信息池 (从article抽的数字/引用/案例/标签)
 *
 * NOT written to outline:
 * - 动画类型 (wipe/blur/弹簧)
 * - CSS实现手段
 * - 时长数值 (~2.5s / 80~120ms)
 * - 持续微动/错峰量等微观节奏
 */

export interface OutlineGeneratorParams {
  script: string;
  article: string;
}

interface ParsedChapter {
  id: string;
  title: string;
  steps: Array<{
    screenContent: string;
    estimatedDuration: number;
  }>;
  infoPool: Array<{
    type: string;
    content: string;
    source: string;
  }>;
  narrationExcerpt: string;
}

interface OutlineGenerationResult {
  theme: string;
  themeId: string;
  totalDuration: number;
  totalSteps: number;
  chapters: ParsedChapter[];
}

function parseScript(script: string): Array<{
  chapterId: string;
  chapterTitle: string;
  steps: Array<{ content: string; duration: number }>;
  narrationExcerpt: string;
}> {
  const chapters: Array<{
    chapterId: string;
    chapterTitle: string;
    steps: Array<{ content: string; duration: number }>;
    narrationExcerpt: string;
  }> = [];

  const chapterBlocks = script.split(/(?:^##\s+\d+\.|^---)/m);

  for (const block of chapterBlocks) {
    if (!block.trim()) continue;

    const titleMatch = block.match(/^#+\s*(\d+)\.\s*([\w-]+)\s*[-–—]\s*(.+)/);
    if (titleMatch) {
      const chapterId = titleMatch[2].toLowerCase();
      const chapterTitle = titleMatch[3].trim();

      const stepMatches = block.matchAll(/(?:- step\s*(\d+)|(\d+)\.\s+)(.+)/gi);
      const steps: Array<{ content: string; duration: number }> = [];
      const excerptLines: string[] = [];

      for (const match of stepMatches) {
        const content = (match[3] || match[0]).trim();
        const charCount = content.length;
        const duration = Math.max(3, Math.min(10, Math.ceil(charCount / 4)));

        steps.push({ content, duration });
        excerptLines.push(content);
      }

      if (steps.length === 0) {
        const paragraphs = block.split(/\n\n+/).filter(p => p.trim().length > 20);
        for (const para of paragraphs.slice(0, 8)) {
          const cleanPara = para.replace(/[#*-]/g, '').trim();
          if (cleanPara.length > 10) {
            const duration = Math.max(3, Math.min(10, Math.ceil(cleanPara.length / 4)));
            steps.push({ content: cleanPara.substring(0, 100), duration });
          }
        }
      }

      chapters.push({
        chapterId,
        chapterTitle,
        steps: steps.length > 0 ? steps : [{ content: '核心内容展示', duration: 5 }],
        narrationExcerpt: excerptLines.slice(0, 3).join(' '),
      });
    }
  }

  if (chapters.length === 0) {
    const paragraphs = script.split(/\n\n+/).filter(p => p.trim().length > 20);
    const steps = paragraphs.slice(0, 6).map(p => ({
      content: p.replace(/[#*-]/g, '').trim().substring(0, 80),
      duration: Math.max(3, Math.min(10, Math.ceil(p.length / 4))),
    }));

    chapters.push({
      chapterId: 'main',
      chapterTitle: '主要内容',
      steps: steps.length > 0 ? steps : [{ content: '核心内容', duration: 5 }],
      narrationExcerpt: paragraphs.slice(0, 2).join(' '),
    });
  }

  return chapters;
}

function parseArticle(article: string): Array<{
  type: string;
  content: string;
  source: string;
}> {
  const infoPool: Array<{
    type: string;
    content: string;
    source: string;
  }> = [];

  const numberMatches = article.matchAll(/(\d+(?:\.\d+)?)\s*(?:个|次|年|月|日|人|元|%|°|px)/g);
  for (const match of numberMatches) {
    const idx = match.index ?? 0;
    infoPool.push({
      type: '数字',
      content: match[0],
      source: `article §${Math.ceil((idx + 1) / 500)}`,
    });
  }

  const quoteMatches = article.matchAll(/"([^"]{10,80})"/g);
  for (const match of quoteMatches) {
    const idx = match.index ?? 0;
    infoPool.push({
      type: '引用',
      content: match[1],
      source: `article §${Math.ceil((idx + 1) / 500)}`,
    });
  }

  const statMatches = article.matchAll(/(?:增长|下降|提升|减少|达到|超过)\s*(\d+(?:\.\d+)?)\s*%/g);
  for (const match of statMatches) {
    const idx = match.index ?? 0;
    const contextStart = Math.max(0, idx - 50);
    const contextEnd = Math.min(article.length, idx + match[0].length + 20);
    const context = article.substring(contextStart, contextEnd).replace(/\n/g, ' ').trim();
    infoPool.push({
      type: '数据',
      content: context.substring(0, 60),
      source: `article §${Math.ceil((idx + 1) / 500)}`,
    });
  }

  return infoPool.slice(0, 20);
}

function generateOutlineMarkdown(result: OutlineGenerationResult): string {
  const lines: string[] = [];

  lines.push('# Video Outline');
  lines.push('');
  lines.push(`> **主题**：\`${result.themeId}\`—— ${result.theme}`);
  lines.push(`> **总时长**：约 ${Math.floor(result.totalDuration / 60)} 分 ${result.totalDuration % 60} 秒（口播 ~${Math.ceil(result.totalDuration * 4)} 字）`);
  lines.push(`> **章节数**：${result.chapters.length} 章 / ${result.totalSteps} 步`);
  lines.push('');
  lines.push('---');
  lines.push('');

  result.chapters.forEach((chapter, idx) => {
    const chapterNum = idx + 1;
    const chapterDuration = chapter.steps.reduce((sum, s) => sum + s.estimatedDuration, 0);

    lines.push(`## ${chapterNum}. ${chapter.id} — ${chapter.title}（${chapter.steps.length} steps · ~${chapterDuration}s）`);
    lines.push('');

    if (chapter.infoPool.length > 0) {
      lines.push('**信息池**：');
      chapter.infoPool.forEach(item => {
        lines.push(`- ${item.type}：${item.content} —— ${item.source}`);
      });
      lines.push('');
    }

    lines.push('**开发计划**：');
    lines.push('');
    chapter.steps.forEach((step, stepIndex) => {
      const stepNum = stepIndex + 1;
      lines.push(`- step ${stepNum} (~${step.estimatedDuration}s) — ${step.screenContent}`);
    });
    lines.push('');

    if (chapter.narrationExcerpt) {
      lines.push('口播节选：');
      lines.push(`> ${chapter.narrationExcerpt.substring(0, 150)}${chapter.narrationExcerpt.length > 150 ? '...' : ''}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  });

  lines.push('## 素材清单');
  lines.push('');
  result.chapters.forEach((chapter, idx) => {
    const chapterNum = idx + 1;
    lines.push(`### ${chapterNum}. ${chapter.id}`);
    lines.push('- ⚠️ 待填充资源描述');
    lines.push('');
  });

  return lines.join('\n');
}

const outlineGeneratorImpl: SkillImplementation = {
  async execute(params: Record<string, unknown>): Promise<SkillResult> {
    const script = params.script as string | undefined;
    const article = params.article as string | undefined;

    if (!script) {
      return {
        success: false,
        error: 'Missing required parameter: script',
      };
    }

    if (!article) {
      return {
        success: false,
        error: 'Missing required parameter: article',
      };
    }

    try {
      const parsedChapters = parseScript(script);
      const articleInfoPool = parseArticle(article);

      const result: OutlineGenerationResult = {
        theme: '主题开发计划',
        themeId: 'theme-default',
        totalDuration: 0,
        totalSteps: 0,
        chapters: [],
      };

      const infoPoolPerChapter = Math.ceil(articleInfoPool.length / Math.max(parsedChapters.length, 1));

      parsedChapters.forEach((parsed, index) => {
        const startIdx = index * infoPoolPerChapter;
        const endIdx = Math.min(startIdx + infoPoolPerChapter, articleInfoPool.length);

        const chapterInfo = {
          id: parsed.chapterId,
          title: parsed.chapterTitle,
          steps: parsed.steps.map(s => ({
            screenContent: s.content,
            estimatedDuration: s.duration,
          })),
          infoPool: articleInfoPool.slice(startIdx, endIdx),
          narrationExcerpt: parsed.narrationExcerpt,
        };

        result.chapters.push(chapterInfo);
        result.totalSteps += parsed.steps.length;
        result.totalDuration += parsed.steps.reduce((sum, s) => sum + s.duration, 0);
      });

      if (result.chapters.length === 0) {
        const articleParagraphs = article.split(/\n\n+/).filter(p => p.trim().length > 20);
        const steps = articleParagraphs.slice(0, 6).map(p => ({
          screenContent: p.replace(/[#*-]/g, '').trim().substring(0, 80),
          estimatedDuration: Math.max(3, Math.min(10, Math.ceil(p.length / 4))),
        }));

        result.chapters.push({
          id: 'overview',
          title: '内容概览',
          steps,
          infoPool: articleInfoPool.slice(0, 5),
          narrationExcerpt: articleParagraphs.slice(0, 2).join(' '),
        });
        result.totalSteps = steps.length;
        result.totalDuration = steps.reduce((sum, s) => sum + s.estimatedDuration, 0);
      }

      const firstLine = article.split('\n')[0] || script.split('\n')[0] || '默认主题';
      result.theme = firstLine.replace(/^#+\s*/, '').trim();
      result.themeId = result.theme.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30);

      const outline = generateOutlineMarkdown(result);

      return {
        success: true,
        data: {
          outline,
          format: 'markdown',
        },
        metadata: {
          skill: 'outline-generator',
          chapterCount: result.chapters.length,
          stepCount: result.totalSteps,
          estimatedDuration: result.totalDuration,
          scriptLength: script.length,
          articleLength: article.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Outline generation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
export default outlineGeneratorImpl;
