import type { SkillImplementation, SkillResult } from '../types';
import { recordPresentation } from '../../lib/recorder/puppeteer-recorder';

/**
 * puppeteer-recorder: Headless Chrome canvas capture skill
 *
 * Captures a web-based slide presentation via headless Chromium:
 *   - Launches Chromium at 1920×1080
 *   - Navigates to the presentation URL
 *   - Captures the canvas via canvas.captureStream() @ 30fps
 *   - Auto-advances through scenes driven by TTS timing
 *   - Outputs raw video chunks ready for FFmpeg H.264 encoding
 */
const puppeteerRecorderSkill: SkillImplementation = {
  async execute(params: Record<string, unknown>): Promise<SkillResult> {
    const url = params.url as string | undefined;
    const output = params.output as string | undefined;
    const autoAdvance = params.autoAdvance as boolean | undefined;

    try {
      const result = await recordPresentation({
        url: url ?? 'http://localhost:5173',
        outputDir: output ?? 'out/frames',
        autoAdvance: autoAdvance ?? true,
      });

      if (result.success) {
        return {
          success: true,
          data: {
            videoPath: result.videoPath,
            frameCount: result.frameCount,
            duration: result.duration,
          },
          metadata: {
            skill: 'puppeteer-recorder',
            url: url ?? 'http://localhost:5173',
            outputDir: output ?? 'out/frames',
          },
        };
      } else {
        return {
          success: false,
          error: result.error ?? 'Recording failed',
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `puppeteer-recorder skill failed: ${message}`,
      };
    }
  },
};

export default puppeteerRecorderSkill;