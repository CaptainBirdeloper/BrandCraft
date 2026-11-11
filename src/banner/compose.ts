import { bannerFont, type BannerSpec } from '../preset/banner';
import { drawLayersRect } from '../preset/variants';
import type { BannerCard } from './cards';
import {
  BANNER_W,
  STRIP_W,
  bannerLayout,
  bannerRects,
  bustAspect,
  scaleRect,
  type BannerRects,
  type Rect,
} from './layout';
import { drawBannerText } from './text';

/** Canvas paint order. The verify probe asserts it, so it lives next to the painter. */
export const BANNER_Z_ORDER = ['bg', 'left', 'right', 'text'] as const;

export interface BannerFigure {
  /** Alpha-trimmed render, transparent background. */
  image: HTMLImageElement;
  /** Opaque fraction of the figure's top row; near 1 means the head is cut flat. */
  topRun: number;
}

export interface BannerCompose {
  card: BannerCard;
  spec: BannerSpec;
  /** Left and right character, in that order. Missing means "not captured yet". */
  figures: readonly [BannerFigure | null, BannerFigure | null];
}

/**
 * `frame` draws the whole 2560×1440 upload, flat colour either side of the strip.
 * `strip` draws only what a phone shows, which is what a banner card in the grid
 * has to look like: no crop of the figures, no letterbox.
 */
export type BannerCrop = 'frame' | 'strip';

function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * The rect already is the figure's own aspect at strip height, pinned to its edge,
 * so this is a straight fill: no re-fit, no centring, nothing that could reintroduce
 * a gap between the silhouette and the strip edge. The drop shadow rides on the
 * same draw — the silhouette's own alpha is the mask, so the bust still lands on
 * the edge while the printed field behind it darkens into a contact shadow.
 */
function drawFigure(ctx: CanvasRenderingContext2D, rect: Rect, image: HTMLImageElement): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = Math.max(6, rect.w * 0.035);
  ctx.shadowOffsetY = Math.max(2, rect.h * 0.022);
  ctx.imageSmoothingEnabled = rect.w < image.width;
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

export interface ComposedBanner {
  canvas: HTMLCanvasElement;
  /** Where the figures and the wordmark actually landed at this width. */
  rects: BannerRects;
}

export function composeBanner(
  input: BannerCompose,
  width: number,
  crop: BannerCrop = 'frame',
): ComposedBanner {
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

  // The backdrop is the same print system the profile cards use, painted over the
  // whole frame — the phone shows the strip, a desktop shows the rest of it too.
  const area =
    crop === 'strip'
      ? { x: layout.strip.x, y: layout.strip.y, w: layout.strip.w, h: layout.strip.h }
      : { x: 0, y: 0, w: layout.width, h: layout.height };
  drawLayersRect(ctx, layout.width, layout.height, input.card.left.variant, area);

  ctx.beginPath();
  ctx.rect(layout.strip.x, layout.strip.y, layout.strip.w, layout.strip.h);
  ctx.clip();

  const [left, right] = input.figures;
  const rects = bannerRects(
    frameWidth,
    left ? bustAspect(left.image) : null,
    right ? bustAspect(right.image) : null,
  );
  if (left) drawFigure(ctx, rects.left, left.image);
  if (right) drawFigure(ctx, rects.right, right.image);
  drawBannerText(
    ctx,
    input.spec.text,
    bannerFont(input.spec.fontId),
    scaleRect(rects.text, input.spec.textScale),
    token('--accent', '#ffff00'),
  );
  ctx.restore();

  return { canvas, rects };
}
