---
name: script-generator
description: 把原始文章转成口语化口播稿，遵循 SCRIPT-STYLE.md 约束。产出 script.md（口播稿），决定视频节拍
parameters:
  - name: article
    type: string
    description: 原始文章内容 (Markdown 格式)
    required: true
  - name: language
    type: string
    description: 输出语言 (zh / en)
    default: zh
output:
  type: string
  description: Markdown 格式的口播稿 (script.md)
---
