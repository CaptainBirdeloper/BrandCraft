import { bannerFont, type BannerFont } from '../preset/banner';
import type { Rect } from './layout';

/** Cap-height as a fraction of the font size, used to fit text inside its box. */
const CAP_RATIO = 0.72;
const MIN_SIZE = 10;

function cssFamily(font: BannerFont): string {
  return font.family === 'Inter Italic' ? '"Inter Italic"' : font.family;
}

function fontString(font: BannerFont, size: number): string {
  return `${font.italic ? 'italic ' : ''}${font.weight} ${size}px ${cssFamily(font)}`;
}

/**
 * Canvas silently falls back to a local serif when the webfont is missing, and
 * the first `fillText` would then be measured against the wrong face. Load the
 * exact weight/style strings before anything is drawn.
 */
export async function ensureBannerFonts(): Promise<void> {
  const specs = [
    '700 200px serif',
    '400 200px serif',
    'italic 700 200px serif',
    'italic 700 200px "Inter Italic"',
    '700 200px Advercase',
  ];
  await Promise.all(specs.map((spec) => document.fonts.load(spec)));
  await document.fonts.ready;
}

function glyphsOf(text: string, font: BannerFont): string[] {
  return Array.from(font.upper ? text.toUpperCase() : text);
}

/** Width of the tracked run at a given size. Tracking is em-based, so it scales. */
export function measureBannerText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: BannerFont,
  tracking: number,
  size: number,
): number {
  const glyphs = glyphsOf(text, font);
  if (glyphs.length === 0) return 0;
  ctx.font = fontString(font, size);
  const gap = tracking * size;
  let width = 0;
  for (const glyph of glyphs) width += ctx.measureText(glyph).width + gap;
  return width - gap;
}

export interface TextFit {
  w: number;
  h: number;
  size: number;
}

/**
 * Fit `text` into `rect` and centre the run. The rect is already in target pixels,
 * so the result is the same fraction of the artwork at any output width.
 * `ctx.letterSpacing` is Chromium-only, so glyphs are placed one at a time.
 */
export function drawBannerText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: BannerFont,
  rect: Rect,
  ink: string,
): TextFit {
  const glyphs = glyphsOf(text, font);
  if (glyphs.length === 0 || rect.w <= 0 || rect.h <= 0) return { w: 0, h: 0, size: 0 };

  const heightCeiling = (rect.h * 0.94) / CAP_RATIO;
  let size = heightCeiling;
  const initialWidth = measureBannerText(ctx, text, font, font.tracking, size);
  if (initialWidth > rect.w && initialWidth > 0) {
    size = Math.max(MIN_SIZE, Math.floor(heightCeiling * (rect.w / initialWidth)));
    // Final check for fractional glyph rounding
    if (measureBannerText(ctx, text, font, font.tracking, size) > rect.w && size > MIN_SIZE) {
      size = Math.max(MIN_SIZE, size - 1);
    }
  }
  size = Math.max(MIN_SIZE, size);

  ctx.font = fontString(font, size);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ink;

  const gap = font.tracking * size;
  const widths = glyphs.map((glyph) => ctx.measureText(glyph).width);
  const total = widths.reduce((sum, width) => sum + width + gap, 0) - gap;
  let x = rect.x + (rect.w - total) / 2;
  const y = rect.y + rect.h / 2;
  glyphs.forEach((glyph, index) => {
    ctx.fillText(glyph, x, y);
    x += widths[index] + gap;
  });

  return { w: total, h: size * CAP_RATIO, size };
}

/**
 * Draws multi-line identity hierarchy: Tagline above, Main Wordmark centered, Handle below.
 */
export function drawBannerIdentity(
  ctx: CanvasRenderingContext2D,
  spec: { text: string; tagline?: string; handle?: string },
  font: BannerFont,
  rect: Rect,
  ink: string,
): TextFit {
  const hasTagline = Boolean(spec.tagline && spec.tagline.trim().length > 0);
  const hasHandle = Boolean(spec.handle && spec.handle.trim().length > 0);

  if (!hasTagline && !hasHandle) {
    return drawBannerText(ctx, spec.text, font, rect, ink);
  }

  const tagH = hasTagline ? rect.h * 0.2 : 0;
  const handleH = hasHandle ? rect.h * 0.18 : 0;
  const mainH = rect.h - tagH - handleH;

  const tagRect: Rect = { x: rect.x, y: rect.y, w: rect.w, h: tagH };
  const mainRect: Rect = { x: rect.x, y: rect.y + tagH, w: rect.w, h: mainH };
  const handleRect: Rect = { x: rect.x, y: rect.y + tagH + mainH, w: rect.w, h: handleH };

  if (hasTagline && spec.tagline) {
    drawBannerText(ctx, spec.tagline, bannerFont('caps'), tagRect, 'rgba(255, 255, 255, 0.72)');
  }

  const mainFit = drawBannerText(ctx, spec.text, font, mainRect, ink);

  if (hasHandle && spec.handle) {
    drawBannerText(ctx, spec.handle, bannerFont('inter'), handleRect, 'rgba(234, 179, 8, 0.85)');
  }

  return mainFit;
}
