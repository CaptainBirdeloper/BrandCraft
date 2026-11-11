import type { Variant } from '../preset/variants';

export type Vec3 = [number, number, number];

export interface LightSource {
  /** Model space: feet y = 0, head top y ~= 32, torso centre y ~= 24, facing +z. */
  pos: Vec3;
  /** 0 = off, 1 = neutral, up to INTENSITY_MAX for a hot key light. */
  intensity: number;
}

export interface LightRig {
  key: LightSource;
  fill: LightSource;
  rim: LightSource;
  /** Hemisphere ambient strength, 0..1. */
  ambient: number;
  /** S-curve amount applied to the lit colour, 0..1. */
  contrast: number;
}

/** Per-light colours in linear 0..1 RGB, derived from the card's own bg/star hexes. */
export interface RigColors {
  key: Vec3;
  fill: Vec3;
  rim: Vec3;
  sky: Vec3;
  ground: Vec3;
}

/** All light positions aim at the torso centre in model units. */
export const LIGHT_TARGET: Vec3 = [0, 24, 0];

export const POS_LIMIT = 200;
export const INTENSITY_MAX = 2;

export const DEFAULT_RIG: LightRig = {
  key: { pos: [-34, 46, 40], intensity: 1.25 },
  fill: { pos: [36, 12, 22], intensity: 0.45 },
  rim: { pos: [10, 34, -44], intensity: 0.7 },
  ambient: 0.42,
  contrast: 0.18,
};

function clampPos(value: number): number {
  return Math.min(POS_LIMIT, Math.max(-POS_LIMIT, value));
}

function clampIntensity(value: number): number {
  return Math.min(INTENSITY_MAX, Math.max(0, value));
}

export function clampRig(rig: LightRig): LightRig {
  const source = (light: LightSource): LightSource => ({
    pos: [clampPos(light.pos[0]), clampPos(light.pos[1]), clampPos(light.pos[2])],
    intensity: clampIntensity(light.intensity),
  });
  return {
    key: source(rig.key),
    fill: source(rig.fill),
    rim: source(rig.rim),
    ambient: Math.min(1, Math.max(0, rig.ambient)),
    contrast: Math.min(1, Math.max(0, rig.contrast)),
  };
}

export function hexToRgb(hex: string): Vec3 {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function mixRgb(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgbToHue(rgb: Vec3): number {
  const max = Math.max(rgb[0], rgb[1], rgb[2]);
  const min = Math.min(rgb[0], rgb[1], rgb[2]);
  if (max === min) return 0;
  const delta = max - min;
  if (max === rgb[0]) return (((rgb[1] - rgb[2]) / delta) % 6) / 6;
  if (max === rgb[1]) return ((rgb[2] - rgb[0]) / delta + 2) / 6;
  return ((rgb[0] - rgb[1]) / delta + 4) / 6;
}

function hslToRgb(hue: number, saturation: number, lightness: number): Vec3 {
  const h = ((hue % 1) + 1) % 1;
  const channel = (offset: number): number => {
    const k = (offset + h * 12) % 12;
    const a = saturation * Math.min(lightness, 1 - lightness);
    return lightness - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1));
  };
  return [channel(0), channel(8), channel(4)];
}

/**
 * Light colours come from the card's own star and background hexes: the star
 * hue tints the key, its complement cools the fill, and the background hue
 * bounces back as the ground term. No colour is picked from a fixed palette.
 */
export function resolveRigColors(variant: Variant): RigColors {
  const starHue = rgbToHue(hexToRgb(variant.star.color));
  const bgHue = rgbToHue(hexToRgb(variant.bg));
  return {
    key: mixRgb(hslToRgb(starHue, 0.5, 0.72), [1, 1, 1], 0.4),
    fill: mixRgb(hslToRgb(starHue + 0.5, 0.35, 0.62), [1, 1, 1], 0.25),
    rim: hslToRgb(starHue + 0.04, 0.65, 0.86),
    sky: mixRgb(hslToRgb(starHue, 0.22, 0.82), [1, 1, 1], 0.3),
    ground: mixRgb(hslToRgb(bgHue, 0.45, 0.4), [0, 0, 0], 0.1),
  };
}

/** Multiply a `#rrggbb` colour towards black. Used for baked shadow and vignette. */
export function darkenRgba(hex: string, amount: number, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  const scale = Math.min(1, Math.max(0, 1 - amount));
  const toByte = (channel: number) => Math.round(channel * scale * 255);
  return `rgba(${toByte(r)}, ${toByte(g)}, ${toByte(b)}, ${alpha})`;
}

function formatNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function formatLight(light: LightSource): string {
  const [x, y, z] = light.pos;
  return `${formatNumber(x)},${formatNumber(y)},${formatNumber(z)},${formatNumber(light.intensity)}`;
}

/** `k=x,y,z,i;f=x,y,z,i;r=x,y,z,i;a=0..1;c=0..1` */
export function serializeRig(rig: LightRig): string {
  return [
    `k=${formatLight(rig.key)}`,
    `f=${formatLight(rig.fill)}`,
    `r=${formatLight(rig.rim)}`,
    `a=${formatNumber(rig.ambient)}`,
    `c=${formatNumber(rig.contrast)}`,
  ].join(';');
}

function parseLight(body: string | undefined): LightSource | null {
  if (!body) return null;
  const values = body.split(',').map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return null;
  return { pos: [values[0], values[1], values[2]], intensity: values[3] };
}

/**
 * Parse the `light:` body. Unknown keys are ignored so the format can grow,
 * but a malformed value invalidates the whole rig.
 */
export function parseRig(body: string): LightRig | null {
  const rig: LightRig = {
    key: DEFAULT_RIG.key,
    fill: DEFAULT_RIG.fill,
    rim: DEFAULT_RIG.rim,
    ambient: DEFAULT_RIG.ambient,
    contrast: DEFAULT_RIG.contrast,
  };
  for (const chunk of body.split(';')) {
    const split = chunk.indexOf('=');
    if (split < 1) return null;
    const key = chunk.slice(0, split);
    const value = chunk.slice(split + 1);
    if (key === 'k' || key === 'f' || key === 'r') {
      const light = parseLight(value);
      if (!light) return null;
      rig[key === 'k' ? 'key' : key === 'f' ? 'fill' : 'rim'] = light;
      continue;
    }
    if (key === 'a' || key === 'c') {
      const number = Number(value);
      if (!Number.isFinite(number)) return null;
      rig[key === 'a' ? 'ambient' : 'contrast'] = number;
      continue;
    }
    continue;
  }
  return clampRig(rig);
}
