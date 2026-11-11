/**
 * Banner data model. A banner is two preset slots either side of a wordmark, so
 * this file only holds the dressing (text, typeface, lighting family, wordmark
 * size, which slots pair up) plus the constants the composer and the UI share.
 */

export const BANNER_SIZES = [1280, 2048, 2560] as const;
export type BannerSize = (typeof BANNER_SIZES)[number];

export const BANNER_TEXT_MAX = 16;
export const DEFAULT_BANNER_TEXT = 'Subscribe';

/** Font variations. `tracking` is extra letter space in em, on top of the fitted size. */
export const BANNER_FONTS = [
  { id: 'caps', label: 'Serif Caps', family: 'serif', weight: 700, italic: false, upper: true, tracking: 0.02 },
  { id: 'roman', label: 'Serif', family: 'serif', weight: 400, italic: false, upper: false, tracking: 0.005 },
  { id: 'italic', label: 'Serif Italic', family: 'serif', weight: 700, italic: true, upper: false, tracking: 0 },
  { id: 'inter', label: 'Inter Italic', family: 'Inter Italic', weight: 700, italic: true, upper: false, tracking: -0.01 },
  { id: 'advercase', label: 'Advercase', family: 'Advercase', weight: 700, italic: false, upper: true, tracking: 0.01 },
] as const;

export type BannerFontId = (typeof BANNER_FONTS)[number]['id'];
export type BannerFont = (typeof BANNER_FONTS)[number];

export function bannerFont(id: BannerFontId): BannerFont {
  return BANNER_FONTS.find((font) => font.id === id) ?? BANNER_FONTS[0];
}

/**
 * Lighting families. `editorial` is the default: the key sits outside each figure
 * and the middle of the strip stays dark, so the wordmark keeps its valley.
 * Hue always comes from the slot's own rig, same as the profile cards.
 */
export const RIG_FAMILIES = ['flat', 'editorial', 'rim'] as const;
export type RigFamily = (typeof RIG_FAMILIES)[number];

export const RIG_FAMILY_LABELS: Record<RigFamily, string> = {
  flat: 'Flat',
  editorial: 'Editorial',
  rim: 'Rim',
};

/** Wordmark sizes, as a fraction of the fitted box. */
export const TEXT_SCALES: readonly number[] = [1, 0.86, 0.74];

/** Distances between the two slots a banner pairs. 8 presets, so 2..6 are all distinct pairs. */
export const PAIR_OFFSETS: readonly number[] = [2, 3, 4, 5, 6];

export interface BannerSpec {
  text: string;
  fontId: BannerFontId;
  rig: RigFamily;
  /** Wordmark size dial, applied around the box centre. */
  textScale: number;
  /** Which slot the right-hand figure comes from: `left` is slot k, right is k + pairOffset. */
  pairOffset: number;
}

export const DEFAULT_BANNER_SPEC: BannerSpec = {
  text: DEFAULT_BANNER_TEXT,
  fontId: 'caps',
  rig: 'editorial',
  textScale: 1,
  pairOffset: 4,
};

/**
 * One spec per banner. Four banners means four independent randomizers, so the
 * first paint already shows four different looks instead of four copies.
 */
export const BANNER_SPEC_DEFAULTS: readonly BannerSpec[] = [
  DEFAULT_BANNER_SPEC,
  { text: DEFAULT_BANNER_TEXT, fontId: 'advercase', rig: 'rim', textScale: 0.86, pairOffset: 3 },
  { text: DEFAULT_BANNER_TEXT, fontId: 'italic', rig: 'flat', textScale: 1, pairOffset: 5 },
  { text: DEFAULT_BANNER_TEXT, fontId: 'inter', rig: 'editorial', textScale: 0.74, pairOffset: 2 },
];

/** Pipes and control characters would break a one-line share format; 16 glyphs fit the strip. */
export function clampBannerText(raw: string): string {
  return raw
    .replace(/[|\u0000-\u001f\u007f]/g, '')
    .slice(0, BANNER_TEXT_MAX)
    .trim();
}
