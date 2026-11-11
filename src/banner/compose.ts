import { bannerFont, type BannerSpec } from '../preset/banner';
import type { BannerCard } from './cards';
import { BANNER_W, STRIP_W, bannerLayout, scaleRect, type Rect } from './layout';
import { drawBannerText } from './text';

/** Canvas paint order. The verify probe asserts it, so it lives next to the painter. */
export const BANNER_Z_ORDER = ['bg', 'left', 'right', 'text'] as const;

export interface BannerFigure {
  /** Alpha-trimmed render, transparent background. */
  image: HTMLImageElement;
}

export interface BannerCompose {
  card: BannerCard;
  spec: BannerSpec;
  /** Left and right character, in that order. Missing means "not captured yet". */
  figures: readonly [BannerFigure | null, BannerFigure | null];
}

/**
 * `frame` draws the whole 2560Ã—1440 upload, flat colour either side of the strip.
 * `strip` draws only what a phone shows, which is what a banner card in the grid
 * has to look like: no crop of the figures, no letterbox.
 */
export type BannerCrop = 'frame' | 'strip';

function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Object-fit contain, anchored to the bottom so both figures share a floor. */
function drawFigure(ctx: CanvasRenderingContext2D, rect: Rect, image: HTMLImageElement): void {
  const scale = Math.min(rect.w / image.width, rect.h / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.imageSmoothingEnabled = scale < 1;
  ctx.drawImage(image, rect.x + (rect.w - w) / 2, rect.y + rect.h - h, w, h);
}

export function composeBanner(
  input: BannerCompose,
  width: number,
  crop: BannerCrop = 'frame',
): HTMLCanvasElement {
  // `width` is the output width; the strip canvas needs a wider virtual frame.
  const frameWidth = crop === 'strip' ? Math.round((width / STRIP_W) * BANNER_W) : width;
  const layout = bannerLayout(frameWidth);
  const canvas = document.createElement('canvas');
  canvas.width = crop === 'strip' ? Math.round(layout.strip.w) : layout.width;
  canvas.height = crop === 'strip' ? Math.round(layout.strip.h) : layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  if (crop === 'strip') ctx.translate(-layout.strip.x, -layout.strip.y);

  // Outside the strip there is exactly one colour and nothing else.
  ctx.fillStyle = input.card.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  ctx.beginPath();
  ctx.rect(layout.strip.x, layout.strip.y, layout.strip.w, layout.strip.h);
  ctx.clip();

  const [left, right] = input.figures;
  if (left) drawFigure(ctx, layout.left, left.image);
  if (right) drawFigure(ctx, layout.right, right.image);
  drawBannerText(
    ctx,
    input.spec.text,
    bannerFont(input.spec.fontId),
    scaleRect(layout.text, input.spec.textScale),
    token('--accent', '#ffff00'),
  );
  ctx.restore();

  return canvas;
}
