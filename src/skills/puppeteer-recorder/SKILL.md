---
name: puppeteer-recorder
description: Headless Chrome captures canvas at 1920×1080, outputs raw video data for FFmpeg encoding
parameters:
  - name: url
    type: string
    description: Presentation URL (default: http://localhost:5173)
    required: false
    default: "http://localhost:5173"
  - name: output
    type: string
    description: Output directory for raw video chunks (default: out/frames)
    required: false
    default: "out/frames"
  - name: autoAdvance
    type: boolean
    description: Auto-advance through scenes driven by TTS timing (default: true)
    required: false
    default: true
output:
  type: object
  description: Recording result with videoPath, frameCount, and duration
---

# puppeteer-recorder

Captures a web-based slide presentation via headless Chromium at 1920×1080.

Uses `canvas.captureStream()` at 30fps to record raw video chunks that FFmpeg later encodes to H.264 MP4.

**Constraints:**
- Canvas-only capture (no screen recording)
- No real-time streaming — raw chunks written for offline FFmpeg encoding
- No audio recording (audio handled by TTS phase)
- Full browser lifecycle managed: launch → navigate → capture → cleanup