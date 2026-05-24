---
name: web-video-presentation
description: 基于 garden-skills/web-video-presentation 的 PPT/网页演示技能。把口播稿 + 开发计划转成 1920×1080 的 Vite + React + TS 网页演示
parameters:
  - name: script
    type: string
    description: 口播稿内容 (script.md)
    required: true
  - name: outline
    type: string
    description: 开发计划 (outline.md)
    required: true
  - name: theme
    type: string
    description: 主题 ID (例如 paper-press, midnight-press)
    default: paper-press
output:
  type: string
  description: 生成的演示项目路径
---
