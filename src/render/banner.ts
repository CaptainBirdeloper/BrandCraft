import { setLightRig } from '../lighting/lighting';
import { resolveRigColors } from '../lighting/lightrig';
import { bannerFont, type BannerSpec } from '../preset/banner';
import type { Slot } from '../preset/variants';
import { ensurePose } from './poses';
import {
  enqueueCapture,
  getSkinViewer,
  prepareSkin,
  toImage,
  trimAlphaCanvas,
  waitFrames,
} from './render';
import { bannerRig } from '../banner/lighting';
import { BANNER_Z_ORDER, composeBanner, type BannerFigure } from '../banner/compose';
import type { BannerCard } from '../banner/cards';
import { bannerLayout, type BannerLayout } from '../banner/layout';
import { ensureBannerFonts } from '../banner/text';

export interface BannerResult {
  url: string;
  bytes: number;
  ms: number;
  layout: BannerLayout;
}

/** Card previews are drawn at strip shape, so this is the strip's own width. */
const CARD_WIDTH = 1240;
/** One banner render per side, at this size, before the bust crop. */
const MASTER = 2048;
const YOUTUBE_MAX_BYTES = 6_000_000;

/** The card bust: crop the render to the preset's box, then trim to the ink. */
function trimBust(raw: HTMLImageElement, slot: Slot): HTMLCanvasElement {
  const { crop } = slot.preset;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(crop.w * MASTER);
  canvas.height = Math.round(crop.h * MASTER);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.drawImage(
    raw,
    crop.x * MASTER,
    crop.y * MASTER,
    crop.w * MASTER,
    crop.h * MASTER,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return trimAlphaCanvas(canvas);
}

/** Approximate decoded byte length of a data URL, without a base64 round-trip. */
function dataUrlBytes(url: string): number {
  const start = url.indexOf(',') + 1;
  return Math.round(((url.length - start) * 3) / 4);
}

interface Shot {
  slot: Slot;
  side: 0 | 1;
  url: string;
}

/**
 * Every figure for this batch of banners, captured back to back in one viewer job.
 * The GL context handles one capture at a time, so N banners must not mean N
 * queued jobs.
 */
async function captureFigures(
  cards: readonly BannerCard[],
  spec: BannerSpec,
  skin: string,
): Promise<Array<[BannerFigure, BannerFigure]>> {
  const viewer = await getSkinViewer();
  viewer.resize(MASTER, MASTER);
  await prepareSkin(viewer, skin);
  viewer.startRenderLoop();

  const shots: Shot[] = [];
  try {
    await waitFrames(2);
    for (const card of cards) {
      for (const side of [0, 1] as const) {
        const slot = side === 0 ? card.left : card.right;
        await ensurePose(slot.preset.pose, slot.preset.bones);
        viewer.playAnimation(slot.preset.pose);
        // The pose reaches the skeleton on a loop tick, not on playAnimation.
        await waitFrames(1);
        viewer.setRotation(slot.preset.theta, slot.preset.phi);
        viewer.setZoom(slot.preset.zoom);
        setLightRig(bannerRig(spec.rig, slot, side), resolveRigColors(slot.variant));
        shots.push({ slot, side, url: viewer.screenshot('png') });
      }
    }
  } finally {
    viewer.stopRenderLoop();
  }

  const raws = await Promise.all(shots.map((shot) => toImage(shot.url)));
  const figures = await Promise.all(
    shots.map(async (shot, index) => {
      const raw = raws[index];
      if (!raw) throw new Error('Banner capture missing');
      const trimmed = trimBust(raw, shot.slot);
      return { image: await toImage(trimmed.toDataURL('image/png')) } satisfies BannerFigure;
    }),
  );

  return cards.map((_, index) => {
    const left = figures[index * 2];
    const right = figures[index * 2 + 1];
    if (!left || !right) throw new Error('Banner figures missing');
    return [left, right];
  });
}

/**
 * One banner card preview: the strip itself at `width`, which is exactly what a
 * phone shows, so the card never crops a figure. One card per call, because each
 * banner has its own randomizer.
 */
export async function renderBannerPreview(
  spec: BannerSpec,
  card: BannerCard,
  skin: string,
  width = CARD_WIDTH,
): Promise<string> {
  const pairs = await enqueueCapture(() => captureFigures([card], spec, skin));
  await ensureBannerFonts();
  const figures = pairs[0];
  if (!figures) throw new Error('Banner figures missing');
  return composeBanner({ card, spec, figures }, width, 'strip').toDataURL('image/png');
}

/** One banner, full 16:9 frame, for the download screen and the export. */
export async function renderBanner(
  spec: BannerSpec,
  card: BannerCard,
  skin: string,
  width: number,
): Promise<BannerResult> {
  const started = performance.now();
  const pairs = await enqueueCapture(() => captureFigures([card], spec, skin));
  await ensureBannerFonts();
  const figures = pairs[0];
  if (!figures) throw new Error('Banner figures missing');
  const canvas = composeBanner({ card, spec, figures }, width);

  let url = canvas.toDataURL('image/png');
  // YouTube refuses anything over 6 MB; flat colour compresses well, but not always.
  if (dataUrlBytes(url) > YOUTUBE_MAX_BYTES) url = canvas.toDataURL('image/jpeg', 0.92);
  const bytes = dataUrlBytes(url);
  const layout = bannerLayout(width);
  const ms = Math.round(performance.now() - started);

  const probe = window as Window & {
    __bcBannerMs?: number;
    __bcBannerBytes?: number;
    __bcBannerLayout?: unknown;
  };
  probe.__bcBannerMs = ms;
  probe.__bcBannerBytes = bytes;
  probe.__bcBannerLayout = {
    width: layout.width,
    height: layout.height,
    strip: layout.strip,
    left: layout.left,
    right: layout.right,
    text: layout.text,
    order: BANNER_Z_ORDER,
    bg: card.bg,
    font: bannerFont(spec.fontId).id,
    rig: spec.rig,
    pair: [card.left.preset.label, card.right.preset.label],
    bytes,
    ms,
  };
  return { url, bytes, ms, layout };
}
