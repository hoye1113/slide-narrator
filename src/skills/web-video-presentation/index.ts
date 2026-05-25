import type { SkillImplementation, SkillResult } from '../types';

/**
 * web-video-presentation: Maps script + outline to slide scenes ready for TTS
 *
 * Accepts script + theme (themeId), parses chapters/steps from the script format,
 * and outputs structured slides with screenContent, narration text, and theme tokens.
 *
 * Script format: markdown with ## N. chapter-id 节标题, each chapter has
 * - step N or numbered list items, separated by `---`
 *
 * Output: array of chapters, each with steps containing:
 *   - screenContent: hero | panel | list | chart
 *   - narration: the narration text for this step
 *   - themeTokens: { shell, surface, surface-2, surface-3, text, text-2, text-mute, text-faint, accent, accent-soft, accent-glow }
 */

// Built-in theme definitions (23 themes from garden-skills)
interface ThemeTokens {
  shell: string;
  surface: string;
  surface2: string;
  surface3: string;
  text: string;
  text2: string;
  textMute: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  accentGlow: string;
}

interface ThemeDefinition {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  mood: string[];
  bestFor: string[];
  preview: {
    shell: string;
    surface: string;
    text: string;
    accent: string;
  };
}

interface SlideScene {
  stepIndex: number;
  screenContent: 'hero' | 'panel' | 'list' | 'chart';
  narration: string;
  estimatedDuration: number;
  themeTokens: ThemeTokens;
}

interface ChapterOutput {
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  scenes: SlideScene[];
  totalDuration: number;
}

interface WvpOutput {
  themeId: string;
  themeName: string;
  themeDescription: string;
  chapters: ChapterOutput[];
  totalSteps: number;
  totalDuration: number;
  slides: SlideScene[];
}

const BUILT_IN_THEMES: Record<string, ThemeDefinition> = {
  'midnight-press': {
    id: 'midnight-press',
    name: 'Midnight Press',
    nameZh: '午夜出版社',
    description: 'Cinematic editorial dark with warm espresso + hot orange',
    descriptionZh: '电影感编辑级深色。暖色 espresso + 火热橙',
    mood: ['dark', 'cinematic', 'slow'],
    bestFor: ['editorial', 'pitch deck', 'product demo'],
    preview: { shell: '#080808', surface: '#101010', text: '#f0f0f0', accent: '#ff6b35' },
  },
  'paper-press': {
    id: 'paper-press',
    name: 'Paper Press',
    nameZh: '纸媒出版社',
    description: 'Editorial paper with warm cream + hot orange',
    descriptionZh: '编辑级纸张。暖奶油 + 纸纹 + 火热橙',
    mood: ['light', 'editorial', 'warm'],
    bestFor: ['editorial', 'storytelling', 'article'],
    preview: { shell: '#f5f0e8', surface: '#fffef9', text: '#1a1a1a', accent: '#ff6b35' },
  },
  'warm-keynote': {
    id: 'warm-keynote',
    name: 'Warm Keynote',
    nameZh: '温暖主题演讲',
    description: 'Modern SaaS keynote with glass slab + teal + warm grid',
    descriptionZh: '现代 SaaS keynote。奶油 + 棕褐墨 + 青绿',
    mood: ['light', 'modern', 'glass'],
    bestFor: ['keynote', 'SaaS demo', 'product'],
    preview: { shell: '#f8f6f1', surface: '#ffffff', text: '#2d2a26', accent: '#2d9596' },
  },
  'newsroom': {
    id: 'newsroom',
    name: 'Newsroom',
    nameZh: '新闻编辑室',
    description: 'NYT broadsheet with newsprint cream + banner red',
    descriptionZh: 'NYT 报刊。报纸奶油 + 墨黑衬线 + 旗红',
    mood: ['light', 'editorial', 'serious'],
    bestFor: ['news', 'editorial', 'documentary'],
    preview: { shell: '#f4f1e8', surface: '#faf8f3', text: '#1a1a1a', accent: '#c41e3a' },
  },
  'bauhaus-bold': {
    id: 'bauhaus-bold',
    name: 'Bauhaus Bold',
    nameZh: '包豪斯大胆',
    description: 'Manifesto modernist with 0 radius + 4px thick frame',
    descriptionZh: '现代主义宣言。米白 + 墨黑 + 原色蓝',
    mood: ['light', 'bold', 'geometric'],
    bestFor: ['manifesto', 'declaration', 'statement'],
    preview: { shell: '#f8f8f8', surface: '#ffffff', text: '#000000', accent: '#0055aa' },
  },
  'chalk-garden': {
    id: 'chalk-garden',
    name: 'Chalk Garden',
    nameZh: '粉笔花园',
    description: 'Slate chalkboard with handwritten Patrick Hand + chalk-yellow',
    descriptionZh: '深石板黑板。Patrick Hand 手写，粉笔黄 accent',
    mood: ['dark', 'handwritten', 'chalk'],
    bestFor: ['classroom', 'tutorial', 'handwritten'],
    preview: { shell: '#1a1a2e', surface: '#252535', text: '#f0f0c0', accent: '#f7d354' },
  },
  'terminal-green': {
    id: 'terminal-green',
    name: 'Terminal Green',
    nameZh: '终端绿',
    description: '80s phosphor CRT with mono-only + scanlines',
    descriptionZh: '80 年代磷光终端。纯黑 + JetBrains Mono',
    mood: ['dark', 'retro', 'terminal'],
    bestFor: ['terminal', 'code', 'hacker'],
    preview: { shell: '#000000', surface: '#0a0a0a', text: '#00ff41', accent: '#00ff41' },
  },
  'blueprint': {
    id: 'blueprint',
    name: 'Blueprint',
    nameZh: '蓝图',
    description: 'Drafting board with deep navy + cyan + 60px grid',
    descriptionZh: '工程蓝图。深海军蓝 + 绘图青 + IBM Plex Mono',
    mood: ['dark', 'technical', 'grid'],
    bestFor: ['technical', 'engineering', 'diagram'],
    preview: { shell: '#0a1628', surface: '#0d1e36', text: '#7ec8e3', accent: '#00d4ff' },
  },
  'dark-botanical': {
    id: 'dark-botanical',
    name: 'Dark Botanical',
    nameZh: '黑暗植物学',
    description: 'Premium editorial dark with terracotta / blush / gold glow',
    descriptionZh: '高级感编辑暗底。暖陶 / 玫粉 / 鎏金叠层',
    mood: ['dark', 'premium', 'botanical'],
    bestFor: ['luxury', 'botanical', 'magazine'],
    preview: { shell: '#0d0b0a', surface: '#1a1514', text: '#f0e6d8', accent: '#d4956a' },
  },
  'neon-cyber': {
    id: 'neon-cyber',
    name: 'Neon Cyber',
    nameZh: '霓虹赛博',
    description: 'Cyberpunk with deep navy + cyan + magenta double-neon',
    descriptionZh: '赛博朋克。深海军底 + 电光青 + 玫红双霓虹',
    mood: ['dark', 'cyberpunk', 'neon'],
    bestFor: ['cyberpunk', 'tech', 'gaming'],
    preview: { shell: '#0a0a1a', surface: '#101025', text: '#00ffff', accent: '#ff00ff' },
  },
  'bold-signal': {
    id: 'bold-signal',
    name: 'Bold Signal',
    nameZh: '醒目信号',
    description: 'Hero pitch-deck with dark gradient + orange focal card',
    descriptionZh: 'hero pitch-deck 暗底。深色渐变 + 大橙色焦点色卡',
    mood: ['dark', 'bold', 'pitch'],
    bestFor: ['pitch deck', 'hero', 'presentation'],
    preview: { shell: '#0d0d0d', surface: '#1a1a1a', text: '#ffffff', accent: '#ff6b35' },
  },
  'creative-voltage': {
    id: 'creative-voltage',
    name: 'Creative Voltage',
    nameZh: '创意电压',
    description: 'Saturated electric blue + neon yellow halftone',
    descriptionZh: '饱和电光蓝底 + 霓虹黄强调',
    mood: ['dark', 'creative', 'energy'],
    bestFor: ['creative', 'design', 'studio'],
    preview: { shell: '#0a1a3d', surface: '#0f2a5f', text: '#ffffff', accent: '#ffe600' },
  },
  'sunset-zine': {
    id: 'sunset-zine',
    name: 'Sunset Zine',
    nameZh: '日落杂志',
    description: 'Risograph zine with peach + magenta + dashed cut lines',
    descriptionZh: '独立 risograph zine。暖桃 + riso 洋红',
    mood: ['light', 'playful', 'zine'],
    bestFor: ['zine', 'independent', 'creative'],
    preview: { shell: '#fce8d8', surface: '#fef6f0', text: '#2d2a26', accent: '#e85d75' },
  },
  'monochrome-print': {
    id: 'monochrome-print',
    name: 'Monochrome Print',
    nameZh: '单色印刷',
    description: 'Refined Monocle / Wallpaper print restraint',
    descriptionZh: '安静精炼的印刷杂志',
    mood: ['light', 'minimal', 'print'],
    bestFor: ['magazine', 'editorial', 'minimal'],
    preview: { shell: '#f5f5f0', surface: '#ffffff', text: '#1a1a1a', accent: '#3d5a80' },
  },
  'vintage-editorial': {
    id: 'vintage-editorial',
    name: 'Vintage Editorial',
    nameZh: '复古编辑',
    description: 'Witty Fraunces + geometric overlay (circle / line / dot)',
    descriptionZh: '俏皮编辑奶油底。Fraunces italic + 暖陶 accent',
    mood: ['light', 'editorial', 'witty'],
    bestFor: ['editorial', 'magazine', 'column'],
    preview: { shell: '#f8f4ed', surface: '#fefcf8', text: '#2d2a26', accent: '#c4785a' },
  },
  'pastel-dream': {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    nameZh: '梦幻粉彩',
    description: 'Soft pastel + sage + right-edge pill ribbon',
    descriptionZh: '友好柔光。柔粉蓝灰底 + 鼠尾草绿',
    mood: ['light', 'soft', 'friendly'],
    bestFor: ['onboarding', 'friendly', 'presentation'],
    preview: { shell: '#e8e4f0', surface: '#f5f2fa', text: '#4a4a5a', accent: '#7eb89c' },
  },
  'split-canvas': {
    id: 'split-canvas',
    name: 'Split Canvas',
    nameZh: '分割画布',
    description: 'Dual-tone with peach left + lavender right',
    descriptionZh: '双色分屏。蜜桃 + 薰衣草 50/50 硬切分',
    mood: ['light', 'dual', 'playful'],
    bestFor: ['split', 'comparison', 'debate'],
    preview: { shell: '#fcc8a0', surface: '#e0c8f0', text: '#2d2a3a', accent: '#e85d75' },
  },
  'electric-studio': {
    id: 'electric-studio',
    name: 'Electric Studio',
    nameZh: '电光工作室',
    description: 'Corporate clarity with crisp white + electric-blue base bar',
    descriptionZh: '企业电光蓝。净白底 + 单一电光蓝',
    mood: ['light', 'corporate', 'clear'],
    bestFor: ['corporate', 'B2B', 'presentation'],
    preview: { shell: '#f0f4f8', surface: '#ffffff', text: '#1a2a3a', accent: '#0066cc' },
  },
  'indigo-porcelain': {
    id: 'indigo-porcelain',
    name: 'Indigo Porcelain',
    nameZh: '靛蓝瓷',
    description: 'Indigo IS the ink + porcelain white',
    descriptionZh: '靛蓝当墨 + 瓷白纸。Playfair Display italic',
    mood: ['light', 'academic', 'refined'],
    bestFor: ['academic', 'research', 'journal'],
    preview: { shell: '#f8f5f0', surface: '#ffffff', text: '#1a365d', accent: '#2c4a7c' },
  },
  'forest-ink': {
    id: 'forest-ink',
    name: 'Forest Ink',
    nameZh: '森林墨',
    description: 'Forest green IS the ink + ivory (vintage National Geographic)',
    descriptionZh: '森林绿当墨 + 象牙暖纸',
    mood: ['light', 'nature', 'vintage'],
    bestFor: ['nature', 'documentary', 'magazine'],
    preview: { shell: '#f4f1e8', surface: '#faf8f0', text: '#2d4a3e', accent: '#5a7c5a' },
  },
  'kraft-paper': {
    id: 'kraft-paper',
    name: 'Kraft Paper',
    nameZh: '牛皮纸',
    description: 'Deep brown IS the ink + kraft beige + copper accent',
    descriptionZh: '牛皮纸。深棕当墨 + 牛皮米 + 紫铜 accent',
    mood: ['light', 'tactile', 'vintage'],
    bestFor: ['notebook', 'craft', 'handmade'],
    preview: { shell: '#d4c4a8', surface: '#e8dcc8', text: '#3d2e1a', accent: '#8b6914' },
  },
  'dune': {
    id: 'dune',
    name: 'Dune',
    nameZh: '沙丘',
    description: 'Charcoal + sand + almost no accent (architecture brochure)',
    descriptionZh: '炭褐当墨 + 沙底 + 几乎无 accent',
    mood: ['light', 'architecture', 'minimal'],
    bestFor: ['architecture', 'gallery', 'minimal'],
    preview: { shell: '#e8e0d4', surface: '#f4f0e8', text: '#3d3832', accent: '#8b7355' },
  },
  'swiss-ikb': {
    id: 'swiss-ikb',
    name: 'Swiss IKB',
    nameZh: '瑞士国际主义',
    description: 'Extra-light 200 weight Helvetica + IKB + 1px hairline grid',
    descriptionZh: '瑞士国际主义。极细 200 weight Inter + IKB 克莱因蓝',
    mood: ['light', 'swiss', 'minimal'],
    bestFor: ['Swiss design', 'information', 'presentation'],
    preview: { shell: '#f8f8f8', surface: '#ffffff', text: '#000000', accent: '#0055aa' },
  },
};

/**
 * Get theme tokens from a theme definition
 */
function getThemeTokens(theme: ThemeDefinition): ThemeTokens {
  // Generate derived tokens from preview colors
  const { shell, surface, text, accent } = theme.preview;

  // Derive surface2/surface3 from surface (lighter/darker variants)
  const surface2 = adjustColor(surface, 0.95);
  const surface3 = adjustColor(surface, 0.9);

  // Derive text variants
  const text2 = adjustColor(text, 0.85);
  const textMute = adjustColor(text, 0.6);
  const textFaint = adjustColor(text, 0.4);

  // Derive accent variants
  const accentSoft = adjustColor(accent, 0.3, 0.3);
  const accentGlow = adjustColor(accent, 0.5, 0.2);

  return {
    shell,
    surface,
    surface2,
    surface3,
    text,
    text2,
    textMute,
    textFaint,
    accent,
    accentSoft,
    accentGlow,
  };
}

/**
 * Lighten or darken a color, or adjust opacity
 */
function adjustColor(color: string, factor: number): string {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      // Expand 3-digit hex to 6-digit (e.g. #fc0 → #ffcc00)
      const expanded = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      const r = parseInt(expanded.slice(0, 2), 16);
      const g = parseInt(expanded.slice(2, 4), 16);
      const b = parseInt(expanded.slice(4, 6), 16);
      const newR = Math.min(255, Math.floor(r * factor));
      const newG = Math.min(255, Math.floor(g * factor));
      const newB = Math.min(255, Math.floor(b * factor));
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const newR = Math.min(255, Math.floor(r * factor));
      const newG = Math.min(255, Math.floor(g * factor));
      const newB = Math.min(255, Math.floor(b * factor));
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    }
  }
  // Return as-is for other formats
  return color;
}

/**
 * Detect screen content type from narration text
 */
function detectScreenContent(text: string): 'hero' | 'panel' | 'list' | 'chart' {
  const lower = text.toLowerCase();
  if (lower.includes('数据') || lower.includes('数字') || lower.includes('%') || lower.includes('增长') || lower.includes('下降')) {
    return 'chart';
  }
  if (lower.includes('第一') || lower.includes('第二') || lower.includes('第三') || lower.includes('列表') || lower.includes('几点')) {
    return 'list';
  }
  if (lower.includes('标题') || lower.includes('大字') || lower.includes('主题') || text.length < 30) {
    return 'hero';
  }
  return 'panel';
}

/**
 * Parse script into chapters with steps
 * Script format: ## N. chapter-id 节标题, with `- step N` or numbered items, separated by `---`
 */
function parseScriptToChapters(script: string): Array<{
  chapterId: string;
  chapterTitle: string;
  steps: Array<{ content: string; duration: number }>;
}> {
  const chapters: Array<{
    chapterId: string;
    chapterTitle: string;
    steps: Array<{ content: string; duration: number }>;
  }> = [];

  // Split by chapter headers or `---` separators
  const blocks = script.split(/(?:^##\s+\d+\.\s+|^-{3,}\s*$)/gm).filter(b => b.trim());

  let currentChapter: {
    chapterId: string;
    chapterTitle: string;
    steps: Array<{ content: string; duration: number }>;
  } | null = null;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Check if this block starts a new chapter
    const chapterMatch = trimmed.match(/^(\d+)\.\s*([\w-]+)\s*[-–—]\s*(.+)/);
    if (chapterMatch) {
      if (currentChapter) {
        chapters.push(currentChapter);
      }
      const chapterId = chapterMatch[2].toLowerCase();
      const chapterTitle = chapterMatch[3].trim();
      currentChapter = { chapterId, chapterTitle, steps: [] };
      continue;
    }

    // If we have a current chapter, parse steps from this block
    if (currentChapter) {
      // Split by newlines and parse step items
      const lines = trimmed.split('\n').filter(l => l.trim());

      for (const line of lines) {
        // Match "- step N" or "- N." patterns
        const stepMatch = line.match(/(?:^-?\s*step\s*(\d+)\s*[-–—]?\s*(.+)|^-?\s*(\d+)\.\s+(.+))/i);
        if (stepMatch) {
          // First alternative (step N): content is group 2.
          // Second alternative (N.): content is group 3.
          const content = (stepMatch[2] ?? stepMatch[3] ?? '').trim();
          if (content) {
            // Estimate duration: Chinese ~4 chars/sec
            const charCount = content.replace(/[#*`]/g, '').length;
            const duration = Math.max(3, Math.min(10, Math.ceil(charCount / 4)));
            currentChapter.steps.push({ content, duration });
          }
        }
      }

      // If no specific step format found, treat paragraphs as steps
      if (currentChapter.steps.length === 0) {
        const paragraphs = trimmed.split(/\n\n+/).filter(p => p.trim().length > 10);
        for (const para of paragraphs.slice(0, 8)) {
          const cleanPara = para.replace(/[#*`-]/g, '').trim();
          if (cleanPara.length > 5) {
            const duration = Math.max(3, Math.min(10, Math.ceil(cleanPara.length / 4)));
            currentChapter.steps.push({ content: cleanPara.substring(0, 100), duration });
          }
        }
      }
    }
  }

  if (currentChapter) {
    chapters.push(currentChapter);
  }

  // If no chapters found, treat entire script as one chapter
  if (chapters.length === 0) {
    const paragraphs = script.split(/\n\n+/).filter(p => p.trim().length > 10);
    const steps = paragraphs.slice(0, 8).map(p => ({
      content: p.replace(/[#*`-]/g, '').trim().substring(0, 80),
      duration: Math.max(3, Math.min(10, Math.ceil(p.length / 4))),
    }));
    chapters.push({
      chapterId: 'main',
      chapterTitle: '主要内容',
      steps: steps.length > 0 ? steps : [{ content: '核心内容', duration: 5 }],
    });
  }

  return chapters;
}

/**
 * Parse chapters from the outline document.
 * Outline format: ## N. chapter-id 节标题, with `- step N` or numbered items.
 */
function parseChaptersFromOutline(outline: string): Array<{
  chapterId: string;
  chapterTitle: string;
  steps: Array<{ content: string; duration: number }>;
}> {
  const chapters: Array<{
    chapterId: string;
    chapterTitle: string;
    steps: Array<{ content: string; duration: number }>;
  }> = [];

  const blocks = outline.split(/(?:^##\s+\d+\.\s+|^-{3,}\s*$)/gm).filter(b => b.trim());

  let currentChapter: {
    chapterId: string;
    chapterTitle: string;
    steps: Array<{ content: string; duration: number }>;
  } | null = null;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const chapterMatch = trimmed.match(/^(\d+)\.\s*([\w-]+)\s*[-–—]\s*(.+)/);
    if (chapterMatch) {
      if (currentChapter) chapters.push(currentChapter);
      currentChapter = {
        chapterId: chapterMatch[2].toLowerCase(),
        chapterTitle: chapterMatch[3].trim(),
        steps: [],
      };
      continue;
    }

    if (currentChapter) {
      const lines = trimmed.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const stepMatch = line.match(/(?:^-?\s*step\s*(\d+)\s*[-–—]?\s*(.+)|^-?\s*(\d+)\.\s+(.+))/i);
        if (stepMatch) {
          // First alternative (step N): content is group 2.
          // Second alternative (N.): content is group 3.
          const content = (stepMatch[2] ?? stepMatch[3] ?? '').trim();
          if (content) {
            const charCount = content.replace(/[#*`]/g, '').length;
            const duration = Math.max(3, Math.min(10, Math.ceil(charCount / 4)));
            currentChapter.steps.push({ content, duration });
          }
        }
      }
      if (currentChapter.steps.length === 0) {
        const paragraphs = trimmed.split(/\n\n+/).filter(p => p.trim().length > 10);
        for (const para of paragraphs.slice(0, 8)) {
          const cleanPara = para.replace(/[#*`-]/g, '').trim();
          if (cleanPara.length > 5) {
            const duration = Math.max(3, Math.min(10, Math.ceil(cleanPara.length / 4)));
            currentChapter.steps.push({ content: cleanPara.substring(0, 100), duration });
          }
        }
      }
    }
  }

  if (currentChapter) chapters.push(currentChapter);

  if (chapters.length === 0) {
    return parseScriptToChapters(outline);
  }

  return chapters;
}

const wvpSkillImpl: SkillImplementation = {
  async execute(params: Record<string, unknown>): Promise<SkillResult> {
    const script = params.script as string | undefined;
    const outline = params.outline as string | undefined;
    const themeId = (params.theme as string) ?? 'paper-press';
    const refine = Boolean(params.refine);

    if (!script) {
      return {
        success: false,
        error: 'Missing required parameter: script',
      };
    }

    try {
      // Get theme definition
      const themeDef = BUILT_IN_THEMES[themeId] ?? BUILT_IN_THEMES['paper-press'];
      const themeTokens = getThemeTokens(themeDef);

      // Parse chapters from outline if provided (explicit structure),
      // otherwise fall back to parsing from script.
      let parsedChapters = outline
        ? parseChaptersFromOutline(outline)
        : parseScriptToChapters(script);

      // Refinement pass: keep only the most impactful half of slides,
      // condensed for clarity and pacing.
      if (refine) {
        const allChapters = parsedChapters;
        const allSteps = allChapters.flatMap((ch) => ch.steps);
        const topSteps = allSteps
          .sort((a, b) => b.duration - a.duration)
          .slice(0, Math.max(1, Math.ceil(allSteps.length / 2)));
        // Re-build chapter structure from top steps, preserving chapter boundaries
        // by finding which chapter each top step came from.
        const topStepSet = new Set(topSteps.map((s) => s.content));
        parsedChapters = allChapters
          .map((ch) => ({
            ...ch,
            steps: ch.steps.filter((s) => topStepSet.has(s.content)),
          }))
          .filter((ch) => ch.steps.length > 0);
      }

      // Build output structure
      const chapters: ChapterOutput[] = [];
      const allSlides: SlideScene[] = [];
      let totalSteps = 0;
      let totalDuration = 0;

      parsedChapters.forEach((parsed, chapterIndex) => {
        const scenes: SlideScene[] = parsed.steps.map((step, stepIndex) => {
          const slide: SlideScene = {
            stepIndex,
            screenContent: detectScreenContent(step.content),
            narration: step.content,
            estimatedDuration: step.duration,
            themeTokens,
          };
          allSlides.push(slide);
          totalSteps++;
          totalDuration += step.duration;
          return slide;
        });

        chapters.push({
          chapterId: parsed.chapterId,
          chapterTitle: parsed.chapterTitle,
          chapterIndex: chapterIndex + 1,
          scenes,
          totalDuration: scenes.reduce((sum, s) => sum + s.estimatedDuration, 0),
        });
      });

      const output: WvpOutput = {
        themeId: themeDef.id,
        themeName: themeDef.nameZh,
        themeDescription: themeDef.descriptionZh,
        chapters,
        totalSteps,
        totalDuration,
        slides: allSlides,
      };

      return {
        success: true,
        data: output,
        metadata: {
          skill: 'web-video-presentation',
          themeId: themeDef.id,
          themeName: themeDef.nameZh,
          chapterCount: chapters.length,
          stepCount: totalSteps,
          estimatedDuration: totalDuration,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Web video presentation generation failed: ${message}`,
      };
    }
  },
};

export default wvpSkillImpl;
