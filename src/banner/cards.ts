import type { Slot } from '../preset/variants';

/** One banner: the two slots that flank the wordmark, and the flat backdrop. */
export interface BannerCard {
  index: number;
  left: Slot;
  right: Slot;
  /** Flat backdrop: the left slot's background, no star. */
  bg: string;
}

/** How many banners the section shows. Four fit one row and stay readable. */
export const BANNER_COUNT = 4;

/**
 * Card `index`: slot `index` on the left, the slot `pairOffset` further along on
 * the right. Each banner owns its offset, so re-rolling one card reshuffles that
 * card's pair without disturbing its neighbours.
 */
export function bannerCard(
  slots: readonly Slot[],
  index: number,
  pairOffset = 4,
): BannerCard | null {
  const count = slots.length;
  if (count < 2 || index < 0 || index >= BANNER_COUNT) return null;
  const offset = ((pairOffset % count) + count) % count || 1;
  const left = slots[index % count];
  if (!left) return null;
  const right = slots[(index + offset) % count] ?? left;
  return { index, left, right, bg: left.variant.bg };
}

/** One card per spec, in spec order. */
export function bannerCards(
  slots: readonly Slot[],
  specs: readonly { pairOffset: number }[],
): BannerCard[] {
  return specs
    .map((spec, index) => bannerCard(slots, index, spec.pairOffset))
    .filter((card): card is BannerCard => card !== null);
}
