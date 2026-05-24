/**
 * ThemePicker — 23 built-in themes selection UI.
 *
 * Displays all available themes from web-video-presentation with preview
 * thumbnails (4-color swatches), description, and mood tags. Calls
 * `onSelect` when the user picks a theme.
 *
 * For v1, the theme list is statically defined to match the 23 themes
 * shipped with web-video-presentation.
 */

import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Theme {
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

export interface ThemePickerProps {
  /** Called when the user selects a theme */
  onSelect: (theme: Theme) => void;
  /** Currently selected theme ID (for controlled mode) */
  selectedTheme?: string;
  /** Optional CSS class name */
  className?: string;
}

// ---------------------------------------------------------------------------
// All 23 themes from web-video-presentation (data from actual theme.json)
// ---------------------------------------------------------------------------

const ALL_THEMES: Theme[] = [
  // ── Dark themes ─────────────────────────────────────────────────────
  {
    id: 'midnight-press',
    name: 'Midnight Press',
    nameZh: '暗色印刷',
    description: 'Warm dark backdrop with a single hot accent. Cinematic, terminal-y, developer vibe.',
    descriptionZh: '暖色暗底 + 单一热橙强调色。电影感、终端气质、开发者审美。',
    mood: ['dark', 'cinematic', 'warm', 'terminal', 'developer'],
    bestFor: ['开发者教程', 'AI / 工具评测', '技术 deep dive'],
    preview: { shell: '#0d0b09', surface: '#1a1714', text: '#f5f0e5', accent: '#ff4a2b' },
  },
  {
    id: 'chalk-garden',
    name: 'Chalk Garden',
    nameZh: '粉笔花园',
    description: 'Dark slate chalkboard with handwritten type and chalk-yellow accent. Classroom vibe.',
    descriptionZh: '深色石板底 + 手写字体 + 粉笔黄强调色。教室 / 课堂讲解感。',
    mood: ['dark', 'handwritten', 'classroom', 'playful'],
    bestFor: ['科普讲解', '教学课堂', '知识分享'],
    preview: { shell: '#1a1a1a', surface: '#1e1e24', text: '#f4f4f5', accent: '#fde047' },
  },
  {
    id: 'terminal-green',
    name: 'Terminal Green',
    nameZh: '终端绿',
    description: 'True-black backdrop with phosphor-green accent. Matrix / hacker / 80s terminal vibe.',
    descriptionZh: '纯黑底 + 磷光绿强调色。Matrix 黑客 / 80 年代终端感。',
    mood: ['dark', 'terminal', 'hacker', 'monospace'],
    bestFor: ['CLI 工具教程', '技术演示', '复古技术致敬'],
    preview: { shell: '#050a05', surface: '#0a0f0a', text: '#d3f0d3', accent: '#00ff88' },
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    nameZh: '蓝图',
    description: 'Deep navy backdrop with cyan accent and IBM Plex Mono. Engineering blueprint vibe.',
    descriptionZh: '深藏青底 + 青色强调色 + IBM Plex Mono。工程蓝图 / 工业图纸气质。',
    mood: ['dark', 'engineering', 'technical', 'navy'],
    bestFor: ['技术架构', '系统拆解', 'API / SDK 介绍'],
    preview: { shell: '#0a121f', surface: '#0e1830', text: '#e6f0ff', accent: '#5fc7e8' },
  },
  {
    id: 'dark-botanical',
    name: 'Dark Botanical',
    nameZh: '暗夜植物',
    description: 'Premium editorial dark with elegant italic serif and warm terracotta / gold accents.',
    descriptionZh: '高级感暗底 + 斜体衬线 + 暖陶 / 鎏金叠层。时尚刊物封面感。',
    mood: ['dark', 'elegant', 'editorial', 'premium'],
    bestFor: ['品牌故事', '时尚 / 美妆', '文化 / 艺术评论'],
    preview: { shell: '#0a0a0a', surface: '#141312', text: '#e8e4df', accent: '#d4a574' },
  },
  {
    id: 'neon-cyber',
    name: 'Neon Cyber',
    nameZh: '霓虹赛博',
    description: 'Deep-navy canvas with electric cyan + magenta dual-neon glow. Futurist cyberpunk.',
    descriptionZh: '深海军底 + 电光青 + 玫红双霓虹。赛博朋克未来派审美。',
    mood: ['dark', 'cyberpunk', 'neon', 'futuristic'],
    bestFor: ['AI / 大模型评测', 'web3 / 区块链', '网络安全'],
    preview: { shell: '#04060f', surface: '#0a0f1c', text: '#e8f4ff', accent: '#00ffcc' },
  },
  {
    id: 'bold-signal',
    name: 'Bold Signal',
    nameZh: '焦点信号',
    description: 'Dark gradient backdrop with a hot orange focal card. Punchy pitch-deck energy.',
    descriptionZh: '暗渐变底 + 大橙色焦点色卡。Pitch deck / 宣言型气质。',
    mood: ['dark', 'bold', 'modern', 'pitch'],
    bestFor: ['Pitch deck', '产品发布', '营销片头'],
    preview: { shell: '#0c0c0c', surface: '#1a1a1a', text: '#f5f5f5', accent: '#ff5722' },
  },
  {
    id: 'creative-voltage',
    name: 'Creative Voltage',
    nameZh: '电压创意',
    description: 'Saturated electric-blue canvas with neon-yellow accent. Retro-punk creative studio.',
    descriptionZh: '饱和电光蓝底 + 霓虹黄强调色。复古朋克创意工作室感。',
    mood: ['dark', 'creative', 'energetic', 'punk'],
    bestFor: ['设计周', '创意分享', '视觉文化'],
    preview: { shell: '#001a4d', surface: '#0033b8', text: '#ffffff', accent: '#d4ff00' },
  },

  // ── Light themes ────────────────────────────────────────────────────
  {
    id: 'paper-press',
    name: 'Paper Press',
    nameZh: '亮色印刷',
    description: 'Warm cream backdrop with a single hot accent. Editorial magazine, daytime vibe.',
    descriptionZh: '暖色奶油底 + 单一热橙强调色。杂志气质、柔和日间审美。',
    mood: ['light', 'editorial', 'magazine', 'warm'],
    bestFor: ['杂志型内容', '生活方式', '日常工具评测'],
    preview: { shell: '#d8cfb8', surface: '#efe7d6', text: '#1a1714', accent: '#ff4a2b' },
  },
  {
    id: 'warm-keynote',
    name: 'Warm Keynote',
    nameZh: '暖色 Keynote',
    description: 'Cream paper backdrop with teal accent and soft warm grid. SaaS keynote vibe.',
    descriptionZh: '奶油纸底 + 青色强调色 + 舞台暖色网格。SaaS Keynote 气质。',
    mood: ['light', 'keynote', 'warm', 'saas'],
    bestFor: ['SaaS 产品 keynote', 'B 端产品发布', '工具产品讲解'],
    preview: { shell: '#FDFBF7', surface: '#FFFFFF', text: '#43302B', accent: '#14B8A6' },
  },
  {
    id: 'newsroom',
    name: 'Newsroom',
    nameZh: '报社',
    description: 'Newsprint cream backdrop with ink-black serif type and banner red. NYT feature feel.',
    descriptionZh: '报纸奶油底 + 墨黑 serif + 报头红强调色。老派大报 / 纪录片气质。',
    mood: ['light', 'newspaper', 'editorial', 'documentary'],
    bestFor: ['纪录片 / 报道', '深度评测', '时事评论'],
    preview: { shell: '#ebe5d6', surface: '#f4ede0', text: '#1a1a1a', accent: '#c9302c' },
  },
  {
    id: 'bauhaus-bold',
    name: 'Bauhaus Bold',
    nameZh: '包豪斯粗体',
    description: 'Pure off-white surface, primary-blue accent, chunky Archivo Black. Modernist manifesto.',
    descriptionZh: '净色底 + 主色蓝强调色 + Archivo Black。包豪斯 / 布鲁塔利风格。',
    mood: ['light', 'modernist', 'bauhaus', 'bold'],
    bestFor: ['产品发布', '观点宣言', '设计演讲'],
    preview: { shell: '#f0eee8', surface: '#fafaf7', text: '#0a0a0a', accent: '#1a4cdb' },
  },
  {
    id: 'sunset-zine',
    name: 'Sunset Zine',
    nameZh: '日落 Zine',
    description: 'Warm peach paper backdrop with magenta accent and chunky Fraunces serif. Indie zine.',
    descriptionZh: '暖桃纸底 + 玫红强调色 + 厚体 Fraunces serif。独立杂志 / 丝网 zine 感。',
    mood: ['light', 'magazine', 'zine', 'playful', 'warm'],
    bestFor: ['生活 vlog', '创意分享', '趣味评测'],
    preview: { shell: '#f7d8b5', surface: '#fbe8d3', text: '#2a1c12', accent: '#e6386b' },
  },
  {
    id: 'monochrome-print',
    name: 'Monochrome Print',
    nameZh: '黑白印刷',
    description: 'Off-white paper with ink-black serif text and ink-blue accent. Print magazine quiet elegance.',
    descriptionZh: '微暖白底 + 墨黑 serif + 墨蓝强调色。Monocle / Wallpaper 式沉静讲究。',
    mood: ['light', 'print', 'minimal', 'serif', 'sophisticated'],
    bestFor: ['深度阅读改编', '学术 / 思想型内容', '品牌故事'],
    preview: { shell: '#f5f3ee', surface: '#fbfaf6', text: '#0a0a0a', accent: '#1d4ed8' },
  },
  {
    id: 'vintage-editorial',
    name: 'Vintage Editorial',
    nameZh: '复古编辑',
    description: 'Witty editorial cream canvas with italic Fraunces and warm terracotta accent. Columnist energy.',
    descriptionZh: '奶油底 + 厚体 Fraunces 斜体 + 暖陶强调色。有性格、会说话的专栏作家感。',
    mood: ['light', 'vintage', 'editorial', 'opinionated', 'witty'],
    bestFor: ['个人见解 / 评论', '文化随笔', '有声音的博主'],
    preview: { shell: '#e8e0cf', surface: '#f5f3ee', text: '#1a1a1a', accent: '#c25e3a' },
  },
  {
    id: 'pastel-dream',
    name: 'Pastel Dream',
    nameZh: '柔光梦',
    description: 'Soft pastel canvas with cream card and sage-green accent. Friendly, approachable, warm.',
    descriptionZh: '柔粉蓝灰底 + 奶油卡 + 鼠尾草绿强调色。友好但不腻。',
    mood: ['light', 'pastel', 'friendly', 'soft', 'warm'],
    bestFor: ['产品 onboarding', '友好教学', '生活方式'],
    preview: { shell: '#c8d9e6', surface: '#faf9f7', text: '#1f2429', accent: '#5a7c6a' },
  },
  {
    id: 'split-canvas',
    name: 'Split Canvas',
    nameZh: '双拼画布',
    description: 'Two-tone canvas: warm peach + cool lavender as paired surfaces. Built for contrast & dialog.',
    descriptionZh: '双色画布：暖蜜桃 + 冷薰衣草成对底色。适合对照与对话型章节。',
    mood: ['light', 'playful', 'dual-tone', 'creative'],
    bestFor: ['双主题对照', '故事讲述', '创意分享'],
    preview: { shell: '#dcc7b8', surface: '#f5e6dc', text: '#1a1410', accent: '#d24a78' },
  },
  {
    id: 'electric-studio',
    name: 'Electric Studio',
    nameZh: '电光企业',
    description: 'Clean white canvas with single electric-blue accent. Corporate confidence without coldness.',
    descriptionZh: '净白底 + 单一电光蓝。企业感、清晰、自信。',
    mood: ['light', 'corporate', 'electric', 'clean'],
    bestFor: ['B2B 产品演讲', '投资人路演', '行业趋势报告'],
    preview: { shell: '#0a0a0a', surface: '#ffffff', text: '#0a0a0a', accent: '#4361ee' },
  },
  {
    id: 'indigo-porcelain',
    name: 'Indigo Porcelain',
    nameZh: '靛蓝瓷',
    description: 'Deep-indigo ink on porcelain white — the indigo IS the ink. Academic, scholarly.',
    descriptionZh: '深靛蓝当墨 + 瓷白纸。学术气质，像一本当代思想期刊。',
    mood: ['light', 'indigo', 'academic', 'editorial', 'scholarly'],
    bestFor: ['学术 / 研究', 'AI / 数据深度', '技术发布会'],
    preview: { shell: '#e4e8ec', surface: '#f1f3f5', text: '#0a1f3d', accent: '#1e3a8a' },
  },
  {
    id: 'forest-ink',
    name: 'Forest Ink',
    nameZh: '森林墨',
    description: 'Deep-forest-green ink on ivory cream — the green IS the ink. Vintage National Geographic feel.',
    descriptionZh: '深森林绿当墨 + 象牙暖纸。沉稳、有呼吸感，旧版《国家地理》气质。',
    mood: ['light', 'forest', 'nature', 'editorial', 'documentary'],
    bestFor: ['自然 / 可持续', '户外品牌', '纪录片'],
    preview: { shell: '#ece7da', surface: '#f5f1e8', text: '#1a2e1f', accent: '#4d7a4d' },
  },
  {
    id: 'kraft-paper',
    name: 'Kraft Paper',
    nameZh: '牛皮纸',
    description: 'Deep-brown ink on kraft beige. Old notebook / hand-stamped envelope warmth.',
    descriptionZh: '深棕当墨 + 牛皮米。老笔记本 / 手戳信封感，暖而怀旧。',
    mood: ['light', 'vintage', 'literary', 'warm'],
    bestFor: ['书评 / 文学随笔', '历史 / 怀旧', '手工艺'],
    preview: { shell: '#dccab0', surface: '#eedfc7', text: '#2a1e13', accent: '#a35b2a' },
  },
  {
    id: 'dune',
    name: 'Dune',
    nameZh: '沙丘',
    description: 'Charcoal-brown on desert sand — near-accent-less restraint. Architecture portfolio quiet.',
    descriptionZh: '炭褐当墨 + 沙底。几乎无 accent，克制画廊感。',
    mood: ['light', 'muted', 'architecture', 'gallery'],
    bestFor: ['建筑 / 空间', '艺术展览', '高端品牌'],
    preview: { shell: '#dcc8a5', surface: '#f0e6d2', text: '#1f1a14', accent: '#8c6a48' },
  },
  {
    id: 'swiss-ikb',
    name: 'Swiss IKB',
    nameZh: '瑞士克莱因蓝',
    description: 'Swiss International Style. Ultra-thin Inter, warm-white canvas, IKB accent. 1px hairline grid.',
    descriptionZh: '瑞士国际主义。极细 Inter + 净暖白底 + 克莱因蓝。克制冷静。',
    mood: ['light', 'swiss', 'modernist', 'grid'],
    bestFor: ['AI / 科技产品发布', '年度总结', '信息驱动设计'],
    preview: { shell: '#e8e8e6', surface: '#fafaf8', text: '#0a0a0a', accent: '#002fa7' },
  },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '12px',
  },
  sectionLabel: {
    fontFamily: 'var(--sans)',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    margin: '8px 0 4px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    color: 'var(--text)',
    position: 'relative' as const,
  },
  cardSelected: {
    borderColor: 'var(--accent)',
    boxShadow: '0 0 0 2px var(--accent-border)',
    background: 'var(--accent-bg)',
  },
  cardHover: {
    borderColor: 'var(--accent-border)',
    transform: 'translateY(-1px)',
  },
  previewBar: {
    display: 'flex',
    height: '40px',
    borderRadius: '6px',
    overflow: 'hidden',
    gap: '2px',
  },
  swatch: {
    flex: 1,
    minWidth: 0,
  },
  themeInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  themeNameRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  themeName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-h)',
    lineHeight: '1.3',
  },
  themeNameZh: {
    fontSize: '12px',
    color: 'var(--text)',
    lineHeight: '1.3',
  },
  themeDesc: {
    fontSize: '12px',
    color: 'var(--text)',
    lineHeight: '1.4',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    marginTop: '2px',
  },
  tag: {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '4px',
    background: 'var(--code-bg)',
    color: 'var(--text)',
    lineHeight: '1.4',
  },
  checkmark: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0,
  },
  darkModeNote: {
    fontSize: '11px',
    color: 'var(--text)',
    fontStyle: 'italic' as const,
    marginTop: '4px',
  },
} satisfies Record<string, React.CSSProperties>;

// ---------------------------------------------------------------------------
// ThemePicker component
// ---------------------------------------------------------------------------

export function ThemePicker({
  onSelect,
  selectedTheme,
  className,
}: ThemePickerProps) {
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);

  const darkThemes = ALL_THEMES.filter((t) => t.mood.includes('dark'));
  const lightThemes = ALL_THEMES.filter((t) => !t.mood.includes('dark'));

  const handleSelect = useCallback(
    (theme: Theme) => {
      onSelect(theme);
    },
    [onSelect],
  );

  const renderThemeCard = (theme: Theme) => {
    const isSelected = selectedTheme === theme.id;
    const isHovered = hoveredTheme === theme.id;
    const preview = theme.preview;

    return (
      <button
        key={theme.id}
        type="button"
        role="radio"
        aria-checked={isSelected}
        style={{
          ...styles.card,
          ...(isSelected ? styles.cardSelected : {}),
          ...(isHovered && !isSelected ? styles.cardHover : {}),
        }}
        onClick={() => handleSelect(theme)}
        onMouseEnter={() => setHoveredTheme(theme.id)}
        onMouseLeave={() => setHoveredTheme(null)}
      >
        {/* Color preview bar */}
        <div style={styles.previewBar} aria-hidden="true">
          <div style={{ ...styles.swatch, background: preview.shell }} />
          <div style={{ ...styles.swatch, background: preview.surface }} />
          <div style={{ ...styles.swatch, background: preview.text }} />
          <div style={{ ...styles.swatch, background: preview.accent }} />
        </div>

        {/* Theme info */}
        <div style={styles.themeInfo}>
          <div style={styles.themeNameRow}>
            <div>
              <div style={styles.themeName}>{theme.nameZh}</div>
              <div style={styles.themeNameZh}>{theme.name}</div>
            </div>
            {isSelected && (
              <div style={styles.checkmark} aria-label="已选择">
                ✓
              </div>
            )}
          </div>
          <div style={styles.themeDesc}>{theme.description}</div>
          <div style={styles.tags}>
            {theme.mood.map((m) => (
              <span key={m} style={{ ...styles.tag, background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                {m}
              </span>
            ))}
          </div>
          <div style={styles.tags}>
            {theme.bestFor.map((tag) => (
              <span key={tag} style={styles.tag}>{tag}</span>
            ))}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className={className} style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>选择主题风格</h3>
        <p style={styles.subtitle}>
          共 {ALL_THEMES.length} 种内置主题可选 · 深色 {darkThemes.length} / 浅色 {lightThemes.length}
        </p>
      </div>

      {/* Dark themes */}
      <div style={styles.sectionLabel}>深色主题</div>
      <div style={styles.grid} role="radiogroup" aria-label="深色主题">
        {darkThemes.map(renderThemeCard)}
      </div>

      {/* Light themes */}
      <div style={styles.sectionLabel}>浅色主题</div>
      <div style={styles.grid} role="radiogroup" aria-label="浅色主题">
        {lightThemes.map(renderThemeCard)}
      </div>

      <p style={styles.darkModeNote}>
        * 主题预览颜色为近似值，实际效果请在预览窗口中查看
      </p>
    </div>
  );
}

export default ThemePicker;