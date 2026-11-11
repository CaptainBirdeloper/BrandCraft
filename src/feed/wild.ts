import type { BannerCard } from '../banner/cards';
import { BANNER_FONTS, DEFAULT_BANNER_TEXT, PAIR_OFFSETS, RIG_FAMILIES, TEXT_SCALES } from '../preset/banner';
import type { BannerSpec } from '../preset/banner';
import type { Preset } from '../preset/presets';
import { randomRig } from '../preset/randomize';
import { SLOTS } from '../preset/slots';
import type { Slot, StarSpec, Variant } from '../preset/variants';

/**
 * The fullscreen feed's own randomizer. `randomizeSlots` deliberately keeps the
 * pose and the camera of the base card; the feed does the opposite: every value
 * a card can hold is rolled from the seed, including the on/off state of each
 * backdrop layer. Same slot in, different slot out, no two rolls alike.
 */

/** Star centres snap to an 8-point ring, so the silhouette clears the bust. */
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

/** Elements are on 75% of the time, off 25%: the ratio the feed was asked for. */
const ON = 0.75;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function range(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

function round(value: number, places = 0): number {
  const step = Math.pow(10, places);
  return Math.round(value * step) / step;
}

/** mulberry32 — same generator the grid uses, seeded per card instead of per roll. */
export function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seed for card `id` of a feed. Deterministic: scrolling past a card and back
 * rebuilds the identical picture instead of a new one in the same hole.
 */
export function seedAt(base: number, id: number): number {
  let hash = (base ^ Math.imul(id + 1, 0x9e3779b1)) >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
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

/** Green is off the palette; anything that lands there steps a third of the wheel. */
function jailedHue(hue: number): number {
  const h = ((hue % 360) + 360) % 360;
  return h >= 70 && h <= 170 ? h + 130 : h;
}

/** Backdrop + star + layer switches, all rolled. */
export function wildVariant(rand: () => number): Variant {
  const bgHue = jailedHue(range(rand, 0, 360));
  const starHue = jailedHue(bgHue + 180 + range(rand, -40, 40));
  const [anchorX, anchorY] = ANCHORS[Math.floor(rand() * ANCHORS.length) % ANCHORS.length]!;
  const star: StarSpec = {
    points: 3 + Math.floor(rand() * 5),
    x: round(clamp(anchorX + range(rand, -0.05, 0.05), 0.08, 0.92), 3),
    y: round(clamp(anchorY + range(rand, -0.05, 0.05), 0.08, 0.92), 3),
    size: round(range(rand, 0.16, 0.34), 3),
    rotation: round(range(rand, -30, 30), 1),
    color: hslHex(starHue, range(rand, 0.55, 0.9), range(rand, 0.62, 0.86)),
  };
  return {
    bg: hslHex(bgHue, range(rand, 0.45, 0.8), range(rand, 0.1, 0.22)),
    star,
    backdrop: {
      style: rand() < ON ? 'riso' : 'flat',
      pitch: round(range(rand, 0.013, 0.024), 4),
      ink2: rand() < ON,
    },
    elements: {
      star: rand() < ON,
      glow: rand() < ON,
      vignette: rand() < ON,
    },
  };
}

/**
 * One wild card: a curated pose from the menu, re-dressed. Pose, bones and the
 * camera window come straight from `slots.txt`, so every card reads as a head and
 * shoulders instead of a random limb close-up; the backdrop, the star, the layer
 * switches, the lighting and a small crop/zoom nudge are what the seed rolls.
 */
export function wildSlot(rand: () => number, id: string, label: string): Slot {
  const base = pick(SLOTS, rand);
  const source = base.preset;
  // Verbatim pose, bones, camera and crop: the preset that was framed in slots.txt is
  // the picture, and only the dressing is rolled.
  const preset: Preset = {
    ...source,
    id,
    label,
    bones: source.bones.map((bone) => ({ ...bone })),
    light: randomRig(rand),
  };
  return { preset, variant: wildVariant(rand) };
}

export interface WildBanner {
  /** Left figure: the one a click opens for editing. */
  slot: Slot;
  spec: BannerSpec;
  card: BannerCard;
}

function pick<T>(list: readonly T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length) % list.length]!;
}

/** Two wild figures, a random wordmark dressing, one banner. */
export function wildBanner(
  rand: () => number,
  id: string,
  index: number,
  text: string,
): WildBanner {
  const left = wildSlot(rand, `${id}-l`, `Banner ${index + 1} · left`);
  const right = wildSlot(rand, `${id}-r`, `Banner ${index + 1} · right`);
  const spec: BannerSpec = {
    text: text.slice(0, 16) || DEFAULT_BANNER_TEXT,
    fontId: pick(BANNER_FONTS, rand).id,
    rig: pick(RIG_FAMILIES, rand),
    textScale: pick(TEXT_SCALES, rand),
    pairOffset: pick(PAIR_OFFSETS, rand),
  };
  return { slot: left, spec, card: { index, left, right, bg: left.variant.bg } };
}
