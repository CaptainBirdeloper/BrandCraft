import { darkenRgba } from '../lighting/lightrig';
import type { Preset } from './presets';

export interface StarSpec {
  points: number;
  /** Centre and radius as fractions of the square side. */
  x: number;
  y: number;
  size: number;
  /** Degrees. */
  rotation: number;
  color: string;
}

export interface Variant {
  bg: string;
  star: StarSpec;
}

export interface Slot {
  preset: Preset;
  variant: Variant;
}

/** Fallback used when a share code omits `bg:`/`star:`. */
export const DEFAULT_VARIANT: Variant = {
  bg: '#090446',
  star: { points: 5, x: 0.8, y: 0.2, size: 0.22, rotation: 0, color: '#FFFF00' },
};

/** Fill the square with the variant background. */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  size: number,
  variant: Variant,
): void {
  ctx.fillStyle = variant.bg;
  ctx.fillRect(0, 0, size, size);
}

/** Draw the star silhouette. Sharp points, no stroke. */
export function drawStar(ctx: CanvasRenderingContext2D, size: number, star: StarSpec): void {
  const cx = star.x * size;
  const cy = star.y * size;
  const outer = star.size * size;
  const inner = outer * (star.points === 4 ? 0.34 : 0.42);
  const start = (star.rotation * Math.PI) / 180 - Math.PI / 2;

  ctx.beginPath();
  for (let step = 0; step < star.points * 2; step += 1) {
    const radius = step % 2 === 0 ? outer : inner;
    const angle = start + (step * Math.PI) / star.points;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (step === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = star.color;
  ctx.fill();
}

/** Soft halo in the star's own colour, so the star sits in the backdrop. */
export function drawGlow(ctx: CanvasRenderingContext2D, size: number, star: StarSpec): void {
  const cx = star.x * size;
  const cy = star.y * size;
  const radius = Math.max(star.size * size * 2.4, 1);
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
  gradient.addColorStop(0, `${star.color}55`);
  gradient.addColorStop(0.55, `${star.color}22`);
  gradient.addColorStop(1, `${star.color}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
}

/** Corner falloff tinted from the background, so the bust reads as the subject. */
export function drawVignette(
  ctx: CanvasRenderingContext2D,
  size: number,
  variant: Variant,
): void {
  const gradient = ctx.createRadialGradient(
    size * 0.5,
    size * 0.46,
    size * 0.42,
    size * 0.5,
    size * 0.5,
    size * 0.85,
  );
  gradient.addColorStop(0, darkenRgba(variant.bg, 0.5, 0));
  gradient.addColorStop(1, darkenRgba(variant.bg, 0.5, 0.26));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
}

/**
 * Background + glow + star + vignette, in that order. Kept as separate
 * functions so a future "download layers" export can render the backdrop, the
 * star and the skin as three independent PNGs without touching the compositor.
 */
export function drawLayers(
  ctx: CanvasRenderingContext2D,
  size: number,
  variant: Variant,
): void {
  drawBackdrop(ctx, size, variant);
  drawGlow(ctx, size, variant.star);
  drawStar(ctx, size, variant.star);
  drawVignette(ctx, size, variant);
}
