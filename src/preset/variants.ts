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

/**
 * What the field behind the bust is made of. `flat` is the original single-colour
 * backdrop and stays the default for any share code written before this existed.
 */
export interface BackdropSpec {
  style: 'flat' | 'riso';
  /** Halftone pitch as a fraction of the canvas width. */
  pitch: number;
  /** Second, sparser screen in the star hue, at 15° against the first. */
  ink2: boolean;
  /** Speckle strength 0..1. Drawn last, so the figures are printed too. */
  grain: number;
}

export interface Variant {
  bg: string;
  star: StarSpec;
  backdrop: BackdropSpec;
}

export interface Slot {
  preset: Preset;
  variant: Variant;
}

export const DEFAULT_BACKDROP: BackdropSpec = {
  style: 'riso',
  pitch: 0.017,
  ink2: true,
  grain: 0.45,
};

/** Fallback used when a share code omits `bg:`/`star:`. */
export const DEFAULT_VARIANT: Variant = {
  bg: '#090446',
  star: { points: 5, x: 0.8, y: 0.2, size: 0.22, rotation: 0, color: '#FFFF00' },
  backdrop: DEFAULT_BACKDROP,
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

/** Star outline at an explicit centre and radius, so square and banner share one shape. */
function starPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  star: StarSpec,
): void {
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

/** Draw the star silhouette. Sharp points, no stroke. */
export function drawStar(ctx: CanvasRenderingContext2D, size: number, star: StarSpec): void {
  starPath(ctx, star.x * size, star.y * size, star.size * size, star);
}

/** Soft halo in the star's own colour, so the star sits in the backdrop. */
export function drawGlow(ctx: CanvasRenderingContext2D, size: number, star: StarSpec): void {
  glowRect(ctx, size, size, star);
}

/** Corner falloff tinted from the background, so the bust reads as the subject. */
export function drawVignette(
  ctx: CanvasRenderingContext2D,
  size: number,
  variant: Variant,
): void {
  vignetteRect(ctx, size, size, variant);
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
  drawLayersRect(ctx, size, size, variant);
}

/**
 * The same four backdrop layers on a non-square canvas. The star and its glow
 * stay circular (radius from the short edge) instead of stretching with the
 * canvas; the vignette is drawn in a unit space that is scaled to the canvas, so
 * a 16:9 banner gets an elliptical falloff rather than a pinned circle.
 */
function glowRect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  star: StarSpec,
): void {
  const cx = star.x * width;
  const cy = star.y * height;
  const radius = Math.max(star.size * Math.min(width, height) * 2.4, 1);
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
  gradient.addColorStop(0, `${star.color}55`);
  gradient.addColorStop(0.55, `${star.color}22`);
  gradient.addColorStop(1, `${star.color}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function vignetteRect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: Variant,
): void {
  ctx.save();
  ctx.translate(width * 0.5, height * 0.5);
  ctx.scale(width, height);
  const gradient = ctx.createRadialGradient(0, -0.04, 0.42, 0, 0, 0.85);
  gradient.addColorStop(0, darkenRgba(variant.bg, 0.5, 0));
  gradient.addColorStop(1, darkenRgba(variant.bg, 0.5, 0.26));
  ctx.fillStyle = gradient;
  ctx.fillRect(-0.5, -0.5, 1, 1);
  ctx.restore();
}

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Halftone coverage at a point: dense around the star, thinning outwards, with a
 * vertical sweep so the field reads as printed ink rather than a radial blob.
 */
function coverage(
  x: number,
  y: number,
  width: number,
  height: number,
  star: StarSpec,
): number {
  const radius = Math.max(star.size * Math.min(width, height) * 1.9, 1);
  const distance = Math.hypot(x - star.x * width, y - star.y * height) / radius;
  const halo = Math.max(0, 1 - distance);
  const sweep = 0.3 + 0.7 * (1 - Math.min(1, Math.max(0, y / height)));
  return Math.min(1, halo * 0.8 + sweep * 0.5);
}

/**
 * Riso screens. Two rotated grids of dots whose radius follows the coverage
 * field, painted only inside `area` — a strip crop therefore costs a strip, not
 * a whole 16:9 frame. Pitch is a fraction of the canvas width, so the card
 * preview and the 2560 px export carry the same number of dots.
 */
function halftoneScreen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: Variant,
  area: Region,
): void {
  const spec = variant.backdrop;
  if (spec.style !== 'riso') return;
  const pitch = Math.max(5, spec.pitch * width);
  const radius = pitch * 0.52;
  const centreX = area.x + area.w / 2;
  const centreY = area.y + area.h / 2;
  const reach = Math.hypot(area.w, area.h) / 2 + pitch;

  const inks: Array<{ color: string; angle: number; floor: number; scale: number }> = [
    { color: darkenRgba(variant.bg, 0.45, 0.7), angle: Math.PI / 4, floor: 0, scale: 1 },
  ];
  if (spec.ink2) {
    inks.push({
      color: `${variant.star.color}55`,
      angle: Math.PI / 12,
      floor: 0.62,
      scale: 0.72,
    });
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.w, area.h);
  ctx.clip();
  for (const ink of inks) {
    const cos = Math.cos(ink.angle);
    const sin = Math.sin(ink.angle);
    ctx.fillStyle = ink.color;
    for (let row = -reach; row <= reach; row += pitch) {
      for (let col = -reach; col <= reach; col += pitch) {
        const x = centreX + col * cos - row * sin;
        const y = centreY + col * sin + row * cos;
        if (x < area.x - pitch || x > area.x + area.w + pitch) continue;
        if (y < area.y - pitch || y > area.y + area.h + pitch) continue;
        const value = coverage(x, y, width, height, variant.star);
        if (value <= ink.floor) continue;
        ctx.beginPath();
        ctx.arc(x, y, radius * ink.scale * (0.28 + 0.72 * value), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

let grainTile: HTMLCanvasElement | null = null;

/** One 128 px speckle tile, built once, drawn as a repeating pattern. */
function grainCanvas(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const image = ctx.createImageData(size, size);
  let state = 0x9e3779b9;
  for (let index = 0; index < size * size; index += 1) {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const dark = value < 0.5;
    const level = Math.round(Math.abs(value - 0.5) * 4) / 4;
    const offset = index * 4;
    image.data[offset] = dark ? 0 : 255;
    image.data[offset + 1] = dark ? 0 : 255;
    image.data[offset + 2] = dark ? 0 : 255;
    image.data[offset + 3] = Math.round(level * 255);
  }
  ctx.putImageData(image, 0, 0);
  grainTile = canvas;
  return canvas;
}

/**
 * Speckle over everything already painted, figures included: a tiled pattern, so
 * size stays proportional to canvas area and never to noise entropy.
 */
export function drawGrainRect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: Variant,
  region?: Region,
): void {
  const strength = variant.backdrop.grain;
  if (strength <= 0.01) return;
  const pattern = ctx.createPattern(grainCanvas(), 'repeat');
  if (!pattern) return;
  const area = region ?? { x: 0, y: 0, w: width, h: height };
  ctx.save();
  ctx.globalAlpha = Math.min(0.6, strength * 0.7);
  ctx.fillStyle = pattern;
  ctx.fillRect(area.x, area.y, area.w, area.h);
  ctx.restore();
}

export function drawLayersRect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  variant: Variant,
  region?: Region,
): void {
  const area = region ?? { x: 0, y: 0, w: width, h: height };
  ctx.fillStyle = variant.bg;
  ctx.fillRect(area.x, area.y, area.w, area.h);
  halftoneScreen(ctx, width, height, variant, area);
  glowRect(ctx, width, height, variant.star);
  starPath(
    ctx,
    variant.star.x * width,
    variant.star.y * height,
    variant.star.size * Math.min(width, height),
    variant.star,
  );
  vignetteRect(ctx, width, height, variant);
}
