---
name: ffmpeg-encoder
description: 将录制好的视频帧和音频文件编码为最终 MP4，支持 H.264 + 烧入 SRT 字幕
parameters:
  - name: frames
    type: string
    description: 原始视频帧目录路径
    required: true
  - name: audio
    type: string
    description: 音频文件目录路径（用于混音）
    required: false
  - name: subtitles
    type: string
    description: SRT 字幕文件路径
    required: false
  - name: output
    type: string
    description: 最终 MP4 输出路径
    required: false
    default: out/video.mp4
output:
  type: object
  description: 编码结果，包含 outputPath、duration、probeInfo
---

ffmpeg-encoder 是最终视频编码环节，将 Puppeteer 录制的原始帧和 TTS 音频合成为完整 MP4。

## 工作流程

1. **扫描帧目录**：查找所有 `.mp4` 或 `.raw` 帧文件
2. **混音音频**：将 TTS 音频与视频帧合成
3. **烧入字幕**：将 SRT 字幕通过 FFmpeg subtitles filter 烧入视频流
4. **输出 MP4**：H.264 编码，1920×1080@30fps

## 约束

- 默认 1920×1080、30fps、H.264 (libx264)
- 字幕字体样式通过 FFmpeg force_style 指定（不在 SRT 里硬编码）
- 进程超时：10 分钟（600 秒）
- Windows 路径特殊字符需要转义