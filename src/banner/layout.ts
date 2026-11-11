/**
 * Banner geometry. One source of truth for the frame, the phone strip inside it
 * and the two figures flanking the wordmark. Everything scales off the frame
 * width, so a 900 px card preview and a 2560 px export use the same numbers.
 */

export const BANNER_W = 2560;
export const BANNER_H = 1440;

/** The part every device shows. Everything outside it is one flat colour. */
export const STRIP_W = 1546;
export const STRIP_H = 423;

export const BANNER_ASPECT = BANNER_W / BANNER_H;
export const STRIP_ASPECT = STRIP_W / STRIP_H;

const STRIP_X = (BANNER_W - STRIP_W) / 2;
const STRIP_Y = (BANNER_H - STRIP_H) / 2;

/** Bust box: full strip height, wide enough to hold a head and shoulders. */
const FIG_W = 470;
const FIG_H = STRIP_H;
/**
 * Breathing room between a figure and its strip edge. The whole silhouette has to
 * stay inside the strip: a bust sliced flat down the outside reads as a mistake,
 * so nothing here is allowed to bleed.
 */
const PAD = 26;

/**
 * The wordmark box is exactly the clear gap between the two busts, minus a small
 * gutter. Deriving it means the type can never crowd a pose, and because every
 * value is a fraction of the frame the preview and the export agree pixel for pixel.
 */
const TEXT_GUTTER = 16;
const TEXT_W = STRIP_W - 2 * (PAD + FIG_W + TEXT_GUTTER);
const TEXT_H = STRIP_H * 0.58;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BannerLayout {
  width: number;
  height: number;
  /** Frame px per layout unit at this width. */
  scale: number;
  frame: Rect;
  strip: Rect;
  left: Rect;
  right: Rect;
  text: Rect;
}

export function bannerLayout(width: number): BannerLayout {
  const scale = width / BANNER_W;
  const px = (value: number) => value * scale;

  return {
    width: Math.round(BANNER_W * scale),
    height: Math.round(BANNER_H * scale),
    scale,
    frame: { x: 0, y: 0, w: px(BANNER_W), h: px(BANNER_H) },
    strip: { x: px(STRIP_X), y: px(STRIP_Y), w: px(STRIP_W), h: px(STRIP_H) },
    // Bottom-anchored on the strip floor, fully inside the strip edge.
    left: { x: px(STRIP_X + PAD), y: px(STRIP_Y + STRIP_H - FIG_H), w: px(FIG_W), h: px(FIG_H) },
    right: {
      x: px(STRIP_X + STRIP_W - PAD - FIG_W),
      y: px(STRIP_Y + STRIP_H - FIG_H),
      w: px(FIG_W),
      h: px(FIG_H),
    },
    text: {
      x: px(STRIP_X + (STRIP_W - TEXT_W) / 2),
      y: px(STRIP_Y + (STRIP_H - TEXT_H) / 2),
      w: px(TEXT_W),
      h: px(TEXT_H),
    },
  };
}

/** Shrink a rect around its own centre. Used to make the wordmark size a dial. */
export function scaleRect(rect: Rect, factor: number): Rect {
  const w = rect.w * factor;
  const h = rect.h * factor;
  return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h };
}
