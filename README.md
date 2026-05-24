# 🎙️ Slide Narrator

**Turn any article into a narrated video with AI-powered slide generation, TTS, and screen recording.**

Slide Narrator is a fully automated pipeline that takes a raw article (or script) and produces a 1920×1080 MP4 video complete with AI-narrated voiceover, synchronized subtitles (SRT), and beautifully themed slides. It operates as a 4-phase agent-driven workflow controlled by an AI agent (see [`AGENT.md`](./AGENT.md) for behavior constraints).

---

## ✨ Features

- **📝 Article Input** — Paste any article, blog post, or script. The agent converts it into a conversational narration script.
- **📜 Script Generation** — Automatically rewrites written content into a natural, spoken-word script with proper pacing.
- **📋 Outline Planning** — Smart chapter / step segmentation with information extraction for slide content.
- **📽️ PPT Generation** — Renders themed HTML slides at 1920×1080 using 23 built-in themes optimized for different genres (science, tech, explainer, etc.).
- **🔊 TTS + SRT** — Optional text-to-speech audio synthesis with automatic subtitle (.srt) generation.
- **🎬 Video Recording** — Headless browser screen capture + FFmpeg encoding to produce H.264 MP4 with embedded subtitles.

---

## 🔄 Workflow

```
Article (raw text / script)
       │
       ▼
Phase 1 ─── Content Authoring ───→ script.md + outline.md
       │
       ▼
  [Checkpoint Plan] ← user selects theme & reviews outline
       │
       ▼
Phase 2 ─── Web Development ─────→ Themed HTML slides (per chapter)
       │
       ▼
  [Checkpoint Audio] ← user decides whether to generate audio
       │
       ▼
Phase 3 ─── Audio Synthesis ─────→ TTS audio + SRT subtitles
       │
       ▼
Phase 4 ─── Recording ───────────→ MP4 video (H.264 + subtitles)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + TypeScript + Vite 8 |
| **State** | Zustand 5 |
| **Routing** | React Router 7 |
| **AI / LLM** | LangChain, OpenAI SDK |
| **Slide Rendering** | HTML/CSS (headless Chromium via Puppeteer) |
| **Audio / Video** | FFmpeg (H.264 encoding, subtitle burning) |
| **CSV Parsing** | PapaParse |
| **Styling** | CSS Modules + clsx |

---

## 📁 Project Structure

```
slide-narrator/
├── index.html                # App entry point
├── vite.config.ts            # Vite configuration
├── package.json
├── tsconfig.json
├── eslint.config.js
├── AGENT.md                  # Agent behavior specification (REQUIRED reading)
├── prerequisites.md          # Environment setup guide
├── public/                   # Static assets
├── references/               # Agent reference files (style guides, formats)
├── templates/                # HTML/theme templates for slides
├── themes/                   # 23 built-in color themes (theme.json per theme)
└── src/
    ├── main.tsx              # React mount
    ├── App.tsx               # Root component with routing
    ├── index.css             # Global styles
    ├── App.css
    ├── agent/                # Agent orchestration logic
    ├── components/           # Reusable UI components
    ├── lib/                  # Utility libraries
    ├── assets/               # Images, fonts, etc.
    └── skills/               # AI sub-agent skill definitions
```

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server (with HMR)
npm run dev

# Type-check and build for production
npm run build

# Preview production build
npm run preview

# Lint the codebase
npm run lint
```

> **Note:** Full pipeline execution (audio synthesis, video recording) requires additional system dependencies like FFmpeg and a headless Chromium browser. See [`prerequisites.md`](./prerequisites.md) for setup details.

---

## 🤖 Agent Behavior

This project is designed to be operated by an AI coding agent following strict guardrails defined in [`AGENT.md`](./AGENT.md). The agent handles the entire 4-phase pipeline autonomously, with hard checkpoints at **Plan Selection** and **Audio Confirmation** for user alignment.

Key agent constraints:
- Strict sequential execution: Phase 1 → Phase 2 → Phase 3 → Phase 4
- No cross-phase parallelism
- Mandatory re-reading of reference files at each phase transition
- First chapter always rendered on the main thread for user validation

---

## 📄 License

MIT — see LICENSE for details.
