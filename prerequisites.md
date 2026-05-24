# Prerequisites

Everything you need installed before running slide-narrator.

---

## 1. System Requirements

| Requirement | Minimum |
|---|---|
| **OS** | Windows 10+, macOS 12+, or Linux (Ubuntu 20.04+ / Debian 11+) |
| **Node.js** | 18.0.0 or later |
| **Disk Space** | ~2 GB (depends on generated MP4 output) |
| **RAM** | 4 GB minimum, 8 GB recommended |
| **Internet** | Required for llm API calls and tts synthesis |

The project is a Vite + React + TypeScript frontend app with an agentic backend. No database or server runtime is needed. All heavy lifting (TTS synthesis, video encoding) happens via external CLI tools.

---

## 2. Core Dependencies

### 2.1 Node.js 18+

**Why**: The project uses Vite 8, TypeScript 6, and React 19. All require Node 18+.

**Install on Windows** (recommended: nvm-windows):
```powershell
# Download nvm-windows from https://github.com/coreybutler/nvm-windows/releases
# Then:
nvm install 20
nvm use 20
node --version   # Should print v20.x.x
```

**Install on macOS/Linux** (recommended: nvm):
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# Restart your shell, then:
nvm install 20
nvm use 20
node --version   # Should print v20.x.x
```

**Verify npm**:
```bash
npm --version    # Should print 10.x.x or later
```

### 2.2 Project Dependencies

Once Node.js is installed, clone and install:
```bash
git clone <repo-url> slide-narrator
cd slide-narrator
npm install
```

This installs everything in `package.json`, including React, Vite, TypeScript, Zustand, and react-router-dom. No extra steps needed.

### 2.3 Verify Core Build

```bash
npm run build
# Expected: Build completes with no TypeScript errors.
# Output goes to dist/.
```

---

## 3. Agent Dependencies

The agent framework uses `langchain` and `openai` for llm orchestration. These are already listed in `package.json` and installed via `npm install`.

### 3.1 OpenAI API Key

The agent calls OpenAI-compatible llm endpoints. Set your key:

**Windows (PowerShell)**:
```powershell
[Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'sk-...', 'User')
# Restart your terminal after setting.
```

**macOS/Linux**:
```bash
export OPENAI_API_KEY="sk-..."
# Add this line to ~/.bashrc or ~/.zshrc to persist.
```

### 3.2 LangChain Setup

`langchain` is included as a dependency. No separate installation is needed. The agent core (`src/agent/core.ts`) uses langchain for skill orchestration and chain construction.

If you need to use a different llm provider (e.g., Anthropic, local Ollama), configure the base url and model in the agent initialization. See `AGENT.md` for configuration details.

---

## 4. TTS Dependencies

The project uses **MiniMax** for text-to-speech synthesis via the `mmx-cli` command-line tool. All TTS is done locally through this CLI (no direct API calls).

### 4.1 MiniMax Plus Plan Signup

1. Go to [https://platform.minimaxi.com](https://platform.minimaxi.com)
2. Sign up for an account.
3. Subscribe to the **Plus** plan (free tier gives 4,000 characters per day, which is enough for development and short videos).
4. Note: The Plus plan includes the voice cloning feature limit. For standard Chinese TTS voices, the free plan also works.

### 4.2 Install mmx-cli

**On all platforms** (Node.js required):
```bash
npm install -g mmx-cli
```

Verify installation:
```bash
mmx --version
# Expected: v0.x.x
```

### 4.3 Authentication

Authenticate mmx-cli with your MiniMax account:
```bash
mmx auth login
```

This opens a browser window. Log in with your MiniMax credentials. After login, verify:
```bash
mmx auth status
# Expected: Logged in as <your-email>

mmx quota
# Expected: Shows remaining character quota (e.g., 4000/4000)
```

If the browser doesn't open automatically, copy the printed URL and open it manually. Some environments (headless servers, WSL) may need an alternative flow. See [Troubleshooting](#7-troubleshooting) below.

### 4.4 Available Chinese Voices

List supported voices:
```bash
mmx speech voices --language zh-CN
```

For slide-narrator v1, only Chinese voices are used. Common voice IDs:
- `male-qn-qingse` — Male, Qingse style (clear, professional)
- `female-shaonv` — Female, youthful
- `presenter_male` — Male presenter tone
- `presenter_female` — Female presenter tone

Voice IDs may change. Always run `mmx speech voices --language zh-CN` to see the current list.

### 4.5 Test TTS with Subtitles

```bash
mmx speech synthesize \
  --text "你好，这是测试语音。" \
  --voice presenter_male \
  --subtitles \
  --output test-audio.mp3
```

This generates two files:
- `test-audio.mp3` — The audio file.
- `test-audio.srt` — The subtitle file with word-level timestamps.

Open the SRT file to verify it contains valid timestamps:
```bash
# On Windows:
type test-audio.srt
# On macOS/Linux:
cat test-audio.srt
```

---

## 5. Recording Dependencies

### 5.1 FFmpeg

**Why**: The recording pipeline uses FFmpeg to encode raw H.264 MP4 video at 1920x1080 and to mux SRT subtitles.

**Install on Windows** (recommended: winget):
```powershell
winget install Gyan.FFmpeg
# Restart your terminal.
```

Alternative: Download from [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html), extract, and add `bin/` to your `PATH`.

**Install on macOS** (recommended: Homebrew):
```bash
brew install ffmpeg
```

**Install on Linux** (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install ffmpeg
```

**Verify installation**:
```bash
ffmpeg -version
# Expected: ffmpeg version x.x.x...

ffprobe -version
# Expected: ffprobe version x.x.x...
```

### 5.2 H.264 Encoder Check

Verify that the `libx264` encoder is available:
```bash
ffmpeg -encoders 2>&1 | Select-String -Pattern "libx264"
# On macOS/Linux: ffmpeg -encoders 2>/dev/null | grep libx264
# Expected output: V..... libx264  libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part10
```

If libx264 is missing, install it:
- **Windows**: Re-install ffmpeg from Gyan (the "full" build includes it).
- **macOS**: `brew reinstall ffmpeg` (Homebrew builds include it).
- **Linux**: `sudo apt install libx264-dev` then reinstall ffmpeg.

### 5.3 ffprobe Validation

The project uses ffprobe to validate output files. Test that it works:
```bash
# Create a test MP4 (will fail if no input, but verifies the tool runs)
ffprobe -version

# Full validation command used by the project:
ffprobe -v error -show_entries stream=codec_name,width,height -of default=noprint_wrappers=1 output.mp4
# Expected on valid output: codec_name=h264  width=1920  height=1080
```

### 5.4 Puppeteer (Chromium)

The recording pipeline uses Puppeteer to control a headless Chromium browser for canvas capture. Puppeteer downloads its own Chromium binary on first `npm install`. No separate Chrome installation is needed.

If you encounter Puppeteer download issues (e.g., behind a proxy or on Linux without desktop libraries), see [Troubleshooting](#7-troubleshooting).

---

## 6. Optional Tools

### 6.1 Claude Code or Cursor

For local development and agent testing, either editor works well:

- **Claude Code**: Terminal-based AI coding assistant. Install via `npm install -g @anthropic-ai/claude-code`.
- **Cursor**: GUI editor with built-in AI features. Download from [https://cursor.com](https://cursor.com).

Not required for the project to run. These are development convenience tools.

### 6.2 Tmax (Agent Teams Visualization)

If you want to visualize the agent team coordination during pipeline execution, install Tmax:
```bash
npm install -g tmax
```

Tmax renders agent team graphs showing which agent is working on which task. Useful for debugging parallel phase execution (Wave 4-5). Not required for production use.

### 6.3 bun (Alternative Runtime)

The test suite supports bun as an alternative to Node.js:
```bash
# Install bun:
# Windows: download from https://bun.sh
# macOS/Linux:
curl -fsSL https://bun.sh/install | bash

# Run tests:
bun test
```

The project works with both Node.js and bun. Use whichever you prefer.

---

## 7. Troubleshooting

### 7.1 Node.js Version Too Old

**Symptom**: `npm install` fails with engine compatibility errors.
**Fix**: Upgrade to Node 20.x LTS using nvm (see section 2.1). Node 16 and earlier are not supported.

### 7.2 mmx-cli: Authentication Fails

**Symptom**: `mmx auth login` opens a browser but login doesn't register.
**Fix**:
1. Ensure you're using the same email for both the browser login and mmx-cli.
2. Try `mmx auth logout` then `mmx auth login` again.
3. If behind a corporate proxy, set `HTTP_PROXY` and `HTTPS_PROXY` environment variables first.
4. For headless environments (WSL, remote SSH), use `mmx auth login --no-browser` to get a manual code-based flow.

### 7.3 mmx-cli: Quota Exhausted

**Symptom**: `mmx speech synthesize` fails with a quota error.
**Fix**:
- Check quota: `mmx quota`. If 0/4000, wait until the next UTC day for the daily reset.
- Upgrade to a paid MiniMax plan for higher limits.
- For development, split long scripts into smaller segments processed across multiple days.

### 7.4 FFmpeg Not Found

**Symptom**: `ffmpeg` command not recognized in terminal.
**Fix**:
- **Windows**: After installing via winget, restart your terminal. If it still doesn't work, add the ffmpeg `bin/` directory to your system `PATH` manually (System Properties > Environment Variables).
- **macOS/Linux**: Run `which ffmpeg`. If empty, reinstall with your package manager.
- Verify with `ffmpeg -version` in a new terminal window.

### 7.5 Puppeteer: Chromium Download Fails

**Symptom**: `npm install` hangs or fails during Puppeteer's Chromium download.
**Fix**:
1. Set `PUPPETEER_SKIP_DOWNLOAD=true` environment variable before `npm install`.
2. Install Chromium manually via your system package manager.
3. Set `PUPPETEER_EXECUTABLE_PATH` to the path of your Chromium/Chrome binary.
4. On Linux without a desktop: install required libraries with `sudo apt install libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2`.

### 7.6 Build Fails with TypeScript Errors

**Symptom**: `npm run build` reports TS errors.
**Fix**:
1. Run `npm install` to ensure all type packages are installed.
2. Check `tsconfig.json` and `tsconfig.app.json` for correct settings.
3. Clear the TypeScript build cache: delete `*.tsbuildinfo` files and retry.
4. Verify you're on Node 18+ (TypeScript 6 requires it).

### 7.7 Openai API Key Not Found

**Symptom**: Agent fails to call llm, throws authentication error.
**Fix**:
- Verify `OPENAI_API_KEY` is set: `echo $env:OPENAI_API_KEY` (Windows) or `echo $OPENAI_API_KEY` (macOS/Linux).
- If empty, set it (see section 3.1) and restart your terminal.
- Verify the key is valid by calling the API directly: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $env:OPENAI_API_KEY"`.

### 7.8 Out of Memory During Recording

**Symptom**: FFmpeg or Puppeteer crashes with OOM errors.
**Fix**:
- Close other applications to free memory.
- Split the recording into shorter segments.
- Reduce the source video quality (lower bitrate in ffmpeg settings).
- Ensure you have at least 4 GB of free RAM before starting a recording.

---

## Quick Start Checklist

Copy this section and check each item after completing it.

```
[ ] Node.js 20.x installed (node --version)
[ ] npm installed (npm --version)
[ ] npm install completed without errors
[ ] npm run build succeeds
[ ] OPENAI_API_KEY environment variable set
[ ] mmx-cli installed (mmx --version)
[ ] mmx auth login successful (mmx auth status)
[ ] mmx quota shows remaining characters
[ ] At least one Chinese TTS voice available (mmx speech voices --language zh-CN)
[ ] FFmpeg installed (ffmpeg -version)
[ ] ffprobe installed (ffprobe -version)
[ ] libx264 encoder available (ffmpeg -encoders | grep libx264)
```

All items checked? You're ready to use slide-narrator. Start the dev server with `npm run dev`.
