---
name: subtitle-generator
description: 把口播稿文本转换成 SRT 格式字幕文件，支持时间戳同步
parameters:
  - name: script
    type: string
    description: 原始口播稿文本（Markdown格式，用 `---` 分隔每段）
    required: true
  - name: baseTime
    type: number
    description: 起始时间偏移（毫秒），用于多段字幕拼接
    default: 0
output:
  type: object
  description: 包含 srtPath 和 segments 的对象
  properties:
    - name: srtPath
      type: string
      description: 生成的 SRT 文件路径
    - name: segments
      type: array
      description: 各段字幕的时间戳信息
---

subtitle-generator 根据口播稿自动生成 SRT 格式字幕文件。

## 工作流程

1. **解析口播稿**：按 `---` 分隔符拆分成独立段落
2. **估算时长**：中文字符约 4 字符/秒，英文约 150 词/分钟
3. **生成时间戳**：按顺序累加计算每段字幕的入出点
4. **输出 SRT**：标准 SRT 格式，文件名 `subtitle_${index}.srt`

## 约束

- 每段字幕不超过 80 字符（超出自动拆分成多句）
- 时间戳格式：`HH:MM:SS,mmm --> HH:MM:SS,mmm`
- 字体样式通过 FFmpeg force_style 指定，不写在 SRT 里
- 多语言支持（检测语言后选择合适的语速）