import { clampRig, LIGHT_TARGET } from '../lighting/lightrig';
import type { LightRig, LightSource, Vec3 } from '../lighting/lightrig';
import type { Slot, StarSpec, Variant } from './variants';

/**
 * Backdrop + star + light rig, grown from a seed. Nothing here reads a colour
 * list: every colour is hue arithmetic on a random base hue, so the randomizer
 * can never fall back onto the eight hand-tuned looks in slots.txt.
 */

/** Star centres snap to an 8-point ring, so the silhouette always clears the bust. */
const ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0.2, 0.2],
  [0.5, 0.15],
  [0.8, 0.2],
  [0.15, 0.5],
  [0.85, 0.5],
  [0.22, 0.82],
  [0.5, 0.86],
  [0.78, 0.8],
];

/** mulberry32 — 32-bit PRNG. Same seed rebuilds the same grid, which verify relies on. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function range(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

function hslHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360;
  const channel = (offset: number): string => {
    const k = (offset + h / 30) % 12;
    const a = saturation * Math.min(lightness, 1 - lightness);
    const value = lightness - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** Complementary backdrop/star pair plus a fresh star silhouette. */
export function randomVariant(rand: () => number): Variant {
  const bgHue = range(rand, 0, 360);
  const starHue = bgHue + 180 + range(rand, -40, 40);
  const [anchorX, anchorY] = ANCHORS[Math.floor(rand() * ANCHORS.length) % ANCHORS.length];
  const star: StarSpec = {
    points: 3 + Math.floor(rand() * 4),
    x: Math.min(0.9, Math.max(0.1, anchorX + range(rand, -0.04, 0.04))),
    y: Math.min(0.9, Math.max(0.1, anchorY + range(rand, -0.04, 0.04))),
    size: range(rand, 0.16, 0.3),
    rotation: Math.round(range(rand, -25, 25)),
    color: hslHex(starHue, range(rand, 0.68, 0.96), range(rand, 0.55, 0.8)),
  };
  return {
    bg: hslHex(bgHue, range(rand, 0.45, 0.85), range(rand, 0.1, 0.26)),
    star,
    backdrop: {
      style: 'riso',
      pitch: Math.round(range(rand, 0.009, 0.017) * 1000) / 1000,
      ink2: rand() < 0.7,
      grain: Math.round(range(rand, 0.3, 0.55) * 100) / 100,
    },
  };
}

/** One lamp on a sphere around the torso centre; the distance only sets the angle. */
function lightAt(
  rand: () => number,
  azimuth: readonly [number, number],
  elevation: readonly [number, number],
  distance: readonly [number, number],
  intensity: readonly [number, number],
): LightSource {
  const az = (range(rand, azimuth[0], azimuth[1]) * Math.PI) / 180;
  const el = (range(rand, elevation[0], elevation[1]) * Math.PI) / 180;
  const radius = range(rand, distance[0], distance[1]);
  const pos: Vec3 = [
    Math.round(LIGHT_TARGET[0] + Math.cos(el) * Math.sin(az) * radius),
    Math.round(LIGHT_TARGET[1] + Math.sin(el) * radius),
    Math.round(LIGHT_TARGET[2] + Math.cos(el) * Math.cos(az) * radius),
  ];
  return { pos, intensity: Math.round(range(rand, intensity[0], intensity[1]) * 100) / 100 };
}

/** Key from the front, fill from the far side, rim from behind: a legible bust every roll. */
export function randomRig(rand: () => number): LightRig {
  return clampRig({
    key: lightAt(rand, [-72, 72], [18, 62], [44, 72], [0.95, 1.5]),
    fill: lightAt(rand, [140, 220], [-12, 24], [40, 64], [0.3, 0.8]),
    rim: lightAt(rand, [130, 230], [8, 50], [40, 66], [0.6, 1.3]),
    ambient: Math.round(range(rand, 0.36, 0.62) * 100) / 100,
    contrast: Math.round(range(rand, 0.1, 0.3) * 100) / 100,
  });
}

/** Keep every pose, camera and crop from the base card; re-roll only look. */
export function randomizeSlots(base: readonly Slot[], seed: number): Slot[] {
  const rand = prng(seed);
  return base.map((slot) => ({
    preset: { ...slot.preset, light: randomRig(rand) },
    variant: randomVariant(rand),
  }));
}

/** LCG step: the next roll is unrelated to the last but reproducible from the same seed. */
export function nextSeed(seed: number): number {
  return (Math.imul(seed, 1103515245) + 12345) >>> 0;
}

/** `?r=1234` pins the grid so verification and screenshots are repeatable. */
export function seedFromSearch(search: string): number {
  const raw = new URLSearchParams(search).get('r');
  const parsed = Number(raw);
  if (raw !== null && Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed) >>> 0;
  return (Math.random() * 4294967296) >>> 0;
}
