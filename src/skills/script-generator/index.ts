import type { SkillResult } from '../types';
import { OpenAI } from 'openai';

/**
 * script-generator: 把原始文章转成口语化口播稿
 *
 * Produces script.md — the oral narration script that drives video pacing.
 *
 * Follows SCRIPT-STYLE.md rules:
 * - 口语化, 第二人称, 短句
 * - 信息保留度 ≥60%
 * - 去AI味 (无假共情/假深刻/模板堆砌)
 * - 保持原文语言
 * - Cold open hook 开头
 * - `---` 分隔每个完整想法
 */

const SYSTEM_PROMPT = `你是一个口播稿写作专家，负责把书面文章转成"说出来不别扭"的口播稿。

## 核心原则

### 最高原则：信息保留度 ≥ 60%
- 口播稿是"换说法"，不是"摘要"
- 删冗余/修饰可以，删事实/数据/案例/论证链不行
- 关键数字、名称、时间、论断必须保留
- 论证链（前提→结论/因果/对比）必须保留，可以换说法但不能跳步

### 去AI味（最重要）
口播比文字更怕AI味。逐条检查：
1. **假共情**：禁止"我知道你/你是不是也有这种感觉/你的感受是被看见的"——直接抛事实/钩子
2. **假深刻**：禁止"恰恰/反而/正是/你以为…恰恰相反"——去掉转折包装直接说结论
3. **自我标榜**：禁止"我必须认真说/我得展开讲/可能会颠覆你的认知"——直接说
4. **万能模板**：禁止"说白了/本质上/底层逻辑/一句话总结/归根结底"——直接说结论
5. **排比堆砌**：禁止连续3句结构一样——保留最有信息量的一两个

### 形式规则
1. **口语化**：书面语换成"说出来不会别扭"的句子（"综上所述"→"所以你看"）
2. **短句**：每句 ≤ 20 字
3. **第二人称**：多用"你/我们"，少用"用户/读者"
4. **开头有钩子**：第一句必须抓住人（悬念/反差/利益），3秒内砸到观众
5. **节奏停顿**：用 \`---\` 分隔每个完整想法，一行一个 idea
6. **数字翻译成感受**：具体百分比和大数字翻译成感受（"提升了47%"→"几乎快了一倍"），但核心冲击数字必须保留原值
7. **不堆结构词**：禁止"首先/其次/最后/总结一下"——融进自然过渡或砍掉
8. **具体例子优先**：从"我"出发（"我做了一个测试"比"用户可以"亲切100倍）

### 平台风格
默认B站风格：≤20字/句，3秒钩子，中等信息密度（5秒/idea）

### 禁止
- emoji（除非用户明确要求）
- 括号补充（括号里的话讲不出来，要么并入正文要么删）
- "哈哈哈哈"等口头语堆砌
- 罗列书名号/引文格式

## 输出格式
直接输出口播稿内容，用 \`---\` 分隔每个完整想法段。不需要额外解释。

## 语言规则
保持原文语言——中文文章生成中文口播稿，英文文章生成英文口播稿。`;

const USER_PROMPT_TEMPLATE = `把下面这篇文章转成口播稿，严格遵循上述规则：

---
{article}
---

## 要求
1. 直接输出口播稿内容，用 \`---\` 分隔每个完整想法段
2. 不要有任何"以下是口播稿"之类的开场白，直接开始
3. 开头第一句必须有钩子（悬念/反差/利益），3秒内砸到观众
4. 每句话 ≤ 20 字
5. 保持原文语言
6. 关键信息不丢失（数字、案例、论证链）

口播稿：`;

/**
 * Detect the primary language of the input text.
 */
function detectLanguage(text: string): 'zh-CN' | 'en' {
  if (!text || !text.trim()) return 'zh-CN';
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const asciiChars = (text.match(/[a-zA-Z]/g) || []).length;
  if (chineseChars > asciiChars * 0.3) return 'zh-CN';
  return 'en';
}

/**
 * Estimate reading time in minutes based on Chinese character count.
 * Assumes ~400 chars/min for Chinese, ~150 words/min for English.
 */
function estimateReadingTime(text: string, language: 'zh-CN' | 'en'): number {
  if (language === 'zh-CN') {
    return Math.ceil(text.length / 400);
  } else {
    const words = text.split(/\s+/).length;
    return Math.ceil(words / 150);
  }
}

export async function execute(
  params: Record<string, unknown>,
  _context?: Record<string, unknown>,
): Promise<SkillResult> {
  const article = params.article as string | undefined;

  if (!article) {
    return {
      success: false,
      error: 'Missing required parameter: article',
    };
  }

  const language = (params.language as 'zh-CN' | 'en') ?? detectLanguage(article);
  const estimatedMinutes = estimateReadingTime(article, language);

  try {
    const openai = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
      baseURL: import.meta.env.VITE_OPENAI_BASE_URL,
      dangerouslyAllowBrowser: true,
    });

    const userPrompt = USER_PROMPT_TEMPLATE.replace('{article}', article);

    const response = await openai.chat.completions.create({
      model: import.meta.env.VITE_LLM_MODEL ?? 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 8192,
    });

    const script = response.choices[0]?.message?.content?.trim();

    if (!script) {
      return {
        success: false,
        error: 'LLM returned empty response',
      };
    }

    return {
      success: true,
      data: {
        script,
        format: 'markdown',
      },
      metadata: {
        skill: 'script-generator',
        articleLength: article.length,
        scriptLength: script.length,
        language,
        estimatedMinutes,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Script generation failed: ${message}`,
    };
  }
}