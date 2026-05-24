---
name: outline-generator
description: 从口播稿 + 原文生成开发计划 (outline.md)，包含章节切分、每步屏幕内容、信息池
parameters:
  - name: script
    type: string
    description: 口播稿内容 (script.md)
    required: true
  - name: article
    type: string
    description: 原始文章内容 (article.md)
    required: true
  - name: format
    type: string
    description: 输出格式 (markdown / json)
    default: markdown
output:
  type: string
  description: Markdown 格式的开发计划 (outline.md)
---
