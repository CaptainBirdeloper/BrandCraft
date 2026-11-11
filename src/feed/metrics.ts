/**
 * Layout maths for the fullscreen feed. Pure numbers, no DOM: the component feeds
 * it a viewport and gets back the grid, the batch size and the id window.
 *
 * Cards are placed from their id (`row = floor(id / cols)`), never from their
 * position in a mounted array. That is what makes retiring the top cards
 * seamless: removing an item above the viewport changes no offset below it.
 */

export interface Metrics {
  /** Columns across the viewport. */
  cols: number;
  /** Card edge in CSS px (square feeds) or card width (banner feeds). */
  cellW: number;
  cellH: number;
  gap: number;
  pad: number;
  /** Column pitch and row pitch: cell plus gap. */
  pitchX: number;
  pitchY: number;
  /** How many cards one batch adds. */
  batch: number;
}

export interface Window {
  /** First id worth mounting. */
  from: number;
  /** Last id worth mounting. */
  to: number;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * `aspect` is width / height of one card: 1 for a profile square, ~3.66 for the
 * banner strip. Wide cards get fewer columns and a taller minimum, so a phone
 * still shows a readable strip instead of a stamp.
 */
export function layoutFor(width: number, height: number, aspect: number): Metrics {
  const wide = aspect > 2;
  const gap = width >= 1100 ? 16 : width >= 700 ? 12 : 8;
  const pad = width >= 1100 ? 26 : 14;
  const cols = wide
    ? width >= 1400
      ? 2
      : 1
    : width >= 1600
      ? 5
      : width >= 1100
        ? 4
        : width >= 700
          ? 3
          : 2;
  const usable = width - 2 * pad - (cols - 1) * gap;
  const cellW = Math.round(
    clamp(usable / cols, wide ? 320 : 150, wide ? 1500 : 440),
  );
  const cellH = Math.round(cellW / aspect);
  const rows = Math.max(2, Math.ceil(height / (cellH + gap)));
  // One row more than the viewport holds ≈ 25% of view height of scroll room.
  const batch = clamp(cols * (rows + 1), 4, 32);
  return {
    cols,
    cellW,
    cellH,
    gap,
    pad,
    pitchX: cellW + gap,
    pitchY: cellH + gap,
    batch,
  };
}

/** Ids to keep mounted for a given scroll offset: the visible rows plus one row each side. */
export function windowFor(scrollTop: number, height: number, metrics: Metrics): Window {
  const firstRow = Math.max(0, Math.floor((scrollTop - metrics.pad) / metrics.pitchY));
  const lastRow = Math.floor((scrollTop + height - metrics.pad) / metrics.pitchY);
  return {
    from: Math.max(0, firstRow - 1) * metrics.cols,
    to: (lastRow + 2) * metrics.cols - 1,
  };
}

/** Full height of the scrolled content for `tail` (highest id created so far). */
export function contentHeight(tail: number, metrics: Metrics): number {
  const rows = Math.ceil((tail + 1) / metrics.cols);
  return metrics.pad * 2 + rows * metrics.pitchY;
}

/** Top-left corner of a card, in content coordinates. */
export function offsetOf(id: number, metrics: Metrics): { left: number; top: number } {
  return {
    left: metrics.pad + (id % metrics.cols) * metrics.pitchX,
    top: metrics.pad + Math.floor(id / metrics.cols) * metrics.pitchY,
  };
}

/** Preview resolution: crisp on a 2x display, capped so a phone does not hold 4K data URLs. */
export function renderWidth(metrics: Metrics, aspect: number): number {
  const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2);
  return Math.round(clamp(metrics.cellW * dpr, 320, aspect > 2 ? 1600 : 768));
}
