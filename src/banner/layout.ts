/**
 * Banner geometry. One source of truth for the frame, the phone strip inside it
 * and the two figures flanking the wordmark. Everything scales off the frame
 * width, so a card preview and a 2560 px export use the same fractions.
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

/**
 * A bust box is the figure's own aspect at full strip height, pinned to its strip
 * edge. No fixed width, no padding: the image is already trimmed to the ink, so
 * the image bound is the silhouette bound. Pinning it to the edge therefore puts
 * the outer contour exactly on the edge — extreme in the strip, and uncut, because
 * there is no box edge left to slice it with.
 */
const MIN_ASPECT = 0.3;
const MAX_ASPECT = 1.9;
/** A square bust, used for the geometry probe before a capture lands. */
const PLACEHOLDER_ASPECT = 1;
/** Narrower than this and the wordmark stops reading, so the pair scales down. */
const TEXT_MIN_W = STRIP_W * 0.16;
const TEXT_GUTTER = 16;
const TEXT_H_RATIO = 0.58;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BannerRects {
  left: Rect;
  right: Rect;
  text: Rect;
}

export interface BannerLayout extends BannerRects {
  width: number;
  height: number;
  /** Frame px per layout unit at this width. */
  scale: number;
  frame: Rect;
  strip: Rect;
}

/** Width over height of a trimmed bust, clamped so one odd capture cannot eat the wordmark. */
export function bustAspect(image: { width: number; height: number }): number {
  if (!image.width || !image.height) return PLACEHOLDER_ASPECT;
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, image.width / image.height));
}

/**
 * Figure and wordmark boxes at `width`. Bottom-anchored on the strip floor, outer
 * edges on the strip edges, wordmark exactly centred in whatever clearance the two
 * silhouettes leave. Mismatched bust widths do not push the type off centre: the
 * box is symmetric about the strip centre and only its width reacts.
 */
export function bannerRects(
  width: number,
  leftAspect: number | null,
  rightAspect: number | null,
): BannerRects {
  const scale = width / BANNER_W;
  const px = (value: number) => value * scale;

  const left = leftAspect ?? PLACEHOLDER_ASPECT;
  const right = rightAspect ?? PLACEHOLDER_ASPECT;

  // Both figures stay extreme for as long as they fit; if the pair is too wide the
  // only honest correction is to scale both down. Cropping is what we are avoiding.
  let h = STRIP_H;
  let wl = left * h;
  let wr = right * h;
  const room = (STRIP_W - TEXT_MIN_W) / 2 - TEXT_GUTTER;
  const widest = Math.max(wl, wr);
  if (widest > room) {
    const shrink = room / widest;
    h *= shrink;
    wl *= shrink;
    wr *= shrink;
  }

  const floorY = STRIP_Y + STRIP_H - h;
  const textW = Math.max(0, 2 * (STRIP_W / 2 - Math.max(wl, wr)) - 2 * TEXT_GUTTER);
  const textH = STRIP_H * TEXT_H_RATIO;

  return {
    left: { x: px(STRIP_X), y: px(floorY), w: px(wl), h: px(h) },
    right: { x: px(STRIP_X + STRIP_W - wr), y: px(floorY), w: px(wr), h: px(h) },
    text: {
      x: px(STRIP_X + STRIP_W / 2 - textW / 2),
      y: px(STRIP_Y + (STRIP_H - textH) / 2),
      w: px(textW),
      h: px(textH),
    },
  };
}

export function bannerLayout(width: number): BannerLayout {
  const scale = width / BANNER_W;
  const px = (value: number) => value * scale;

  return {
    ...bannerRects(width, null, null),
    width: Math.round(BANNER_W * scale),
    height: Math.round(BANNER_H * scale),
    scale,
    frame: { x: 0, y: 0, w: px(BANNER_W), h: px(BANNER_H) },
    strip: { x: px(STRIP_X), y: px(STRIP_Y), w: px(STRIP_W), h: px(STRIP_H) },
  };
}

/** Shrink a rect around its own centre. Used to make the wordmark size a dial. */
export function scaleRect(rect: Rect, factor: number): Rect {
  const w = rect.w * factor;
  const h = rect.h * factor;
  return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h };
}
