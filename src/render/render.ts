import { registerLighting, setLightRig } from '../lighting/lighting';
import { DEFAULT_RIG, darkenRgba, resolveRigColors, serializeRig } from '../lighting/lightrig';
import type { Crop } from '../preset/presets';
import { ensurePose } from './poses';
import type { Slot, Variant } from '../preset/variants';
import { DEFAULT_VARIANT, drawLayers, drawGrainRect } from '../preset/variants';

type Core = typeof import('@daidr/minecraft-skin-renderer');
type Viewer = Awaited<ReturnType<Core['createSkinViewer']>>;

let viewerPromise: Promise<Viewer> | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function createViewer(): Promise<Viewer> {
  const [core, webgl] = await Promise.all([
    import('@daidr/minecraft-skin-renderer'),
    import('@daidr/minecraft-skin-renderer/webgl'),
  ]);
  core.use(webgl.WebGLRendererPlugin);
  // Replaces the stock WebGL plugin with the lighting shader. No-op fallback.
  registerLighting(core, webgl.WebGLRendererPlugin);
  const canvas = document.createElement('canvas');
  return core.createSkinViewer({
    canvas,
    preferredBackend: 'webgl',
    antialias: true,
    pixelRatio: 1,
    preserveDrawingBuffer: false,
    enableRotate: false,
    enableZoom: false,
  });
}

function getViewer(): Promise<Viewer> {
  viewerPromise ??= createViewer();
  return viewerPromise;
}

// One texture for the whole session: every card shares the same skin, and
// re-uploading it per render burns GPU memory until the context dies.
let currentSkin: string | null = null;

async function ensureSkin(viewer: Viewer, skin: string): Promise<void> {
  if (currentSkin === skin) return;
  await viewer.setSkin(skin);
  currentSkin = skin;
}

function nextFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let left = count;
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
function decodeImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode render'));
    img.src = dataUrl;
  });
}

/** Soft contact shadow of the bust silhouette, painted under the character. */
function drawContactShadow(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  crop: Crop,
  master: number,
  size: number,
  variant: Variant,
): void {
  const work = Math.min(size, 1024);
  const silhouette = document.createElement('canvas');
  silhouette.width = work;
  silhouette.height = work;
  const sctx = silhouette.getContext('2d');
  if (!sctx) return;
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(
    img,
    crop.x * master,
    crop.y * master,
    crop.w * master,
    crop.h * master,
    0,
    0,
    work,
    work,
  );
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = darkenRgba(variant.bg, 0.62, 1);
  sctx.fillRect(0, 0, work, work);

  ctx.save();
  ctx.filter = `blur(${Math.round(size * 0.04)}px)`;
  ctx.globalAlpha = 0.55;
  ctx.drawImage(silhouette, size * 0.012, size * 0.02, size, size);
  ctx.restore();
}

/** Crop the render to the preset's bust box, over the variant backdrop, at the output size. */
function cropSquare(
  img: HTMLImageElement,
  crop: Crop,
  master: number,
  size: number,
  variant: Variant,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  drawLayers(ctx, size, variant);
  drawContactShadow(ctx, img, crop, master, size, variant);
  const source = crop.w * master;
  // Downscale smooth; upscale nearest keeps the Minecraft pixel grid crisp.
  ctx.imageSmoothingEnabled = source > size;
  ctx.drawImage(
    img,
    crop.x * master,
    crop.y * master,
    source,
    crop.h * master,
    0,
    0,
    size,
    size,
  );
  drawGrainRect(ctx, size, size, variant);
  return canvas.toDataURL('image/png');
}

/**
 * Capture a whole card set in one pass. `screenshot()` redraws synchronously, but the
 * animation controller writes the skeleton inside the render loop's update tick, so a
 * pose needs one loop frame before it can be captured. Cards are grouped by pose: the
 * pose is the only thing that needs a frame, so a batch costs one frame per pose, not
 * one per card.
 */
async function doRenderBatch(
  slots: readonly Slot[],
  skin: string,
  size: number,
): Promise<string[]> {
  const viewer = await getViewer();
  const master = Math.min(4096, Math.max(1024, size * 2));

  const groups = new Map<string, { bones: Slot['preset']['bones']; indexes: number[] }>();
  slots.forEach((slot, index) => {
    const group = groups.get(slot.preset.pose);
    if (group) group.indexes.push(index);
    else groups.set(slot.preset.pose, { bones: slot.preset.bones, indexes: [index] });
  });

  viewer.resize(master, master);
  await ensureSkin(viewer, skin);

  const frames: HTMLImageElement[] = new Array(slots.length);
  viewer.startRenderLoop();
  try {
    await nextFrames(2);
    for (const [pose, group] of groups) {
      await ensurePose(pose, group.bones);
      viewer.playAnimation(pose);
      // The loop's next tick applies the pose to the skeleton; the loop re-registers
      // its own frame before this continuation runs, so one frame is enough.
      await nextFrames(1);
      for (const index of group.indexes) {
        const { preset, variant } = slots[index];
        setLightRig(preset.light, resolveRigColors(variant));
        viewer.setRotation(preset.theta, preset.phi);
        viewer.setZoom(preset.zoom);
        frames[index] = await decodeImage(viewer.screenshot('png'));
      }
    }
  } finally {
    viewer.stopRenderLoop();
  }

  return frames.map((img, index) =>
    cropSquare(img, slots[index].preset.crop, master, size, slots[index].variant),
  );
}

/**
 * Crop `img` to its ink box at 1:1. The banner needs the untrimmed scale, so it
 * gets the box; the square cutout path rescales it afterwards.
 */
export function trimAlphaCanvas(img: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const source = document.createElement('canvas');
  source.width = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  source.height = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const sctx = source.getContext('2d');
  if (!sctx) throw new Error('2D canvas unavailable');
  sctx.drawImage(img, 0, 0);
  const { data, width, height } = sctx.getImageData(0, 0, source.width, source.height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('Empty render');

  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('2D canvas unavailable');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(source, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** Alpha-trim the render to its ink box, then scale the long edge to `size`. */
function trimAlpha(img: HTMLImageElement, size: number): string {
  const box = trimAlphaCanvas(img);
  const scale = size / Math.max(box.width, box.height);
  const out = document.createElement('canvas');
  out.width = Math.round(box.width * scale);
  out.height = Math.round(box.height * scale);
  const octx = out.getContext('2d');
  if (!octx) throw new Error('2D canvas unavailable');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(box, 0, 0, box.width, box.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

const CUTOUT_MASTER = 1024;
const CUTOUT_ZOOM = 40;

async function doCutout(skin: string, size: number): Promise<string> {
  const viewer = await getViewer();
  setLightRig(DEFAULT_RIG, resolveRigColors(DEFAULT_VARIANT));
  viewer.resize(CUTOUT_MASTER, CUTOUT_MASTER);
  await ensureSkin(viewer, skin);
  viewer.setRotation(0, Math.PI / 2);
  viewer.setZoom(CUTOUT_ZOOM);
  // No animation: bind pose, upright full body.
  viewer.stopAnimation();

  viewer.startRenderLoop();
  let raw: string;
  try {
    await nextFrames(2);
    raw = viewer.screenshot('png');
  } finally {
    viewer.stopRenderLoop();
  }

  return trimAlpha(await decodeImage(raw), size);
}

/** Render the upright full-body skin, alpha-trimmed, for the sidebar preview. */
export function renderCutout(skin: string, size: number): Promise<string> {
  const run = queue.then(
    () => doCutout(skin, size),
    () => doCutout(skin, size),
  );
  queue = run.catch(() => undefined);
  return run;
}

/** Render a card set (preset + backdrop/star) to PNG data URLs. Serialized: one shared viewer. */
export function renderPresets(
  slots: readonly Slot[],
  skin: string,
  size: number,
): Promise<string[]> {
  const run = queue.then(
    () => doRenderBatch(slots, skin, size),
    () => doRenderBatch(slots, skin, size),
  );
  queue = run.catch(() => undefined);
  return run;
}

/** Render one slot (preset + backdrop/star) to a PNG data URL. Serialized: one shared viewer. */
export function renderPreset(slot: Slot, skin: string, size: number): Promise<string> {
  return renderPresets([slot], skin, size).then((urls) => urls[0]);
}

/**
 * Editor preview. The character is the expensive half — camera, pose and light are
 * baked into it — so it is cached under exactly those inputs, and a backdrop/star/crop
 * edit recomposes from the cache without touching the GL viewer (a few milliseconds).
 */
const PREVIEW_MASTER = 2048;
let characterCache: { key: string; img: HTMLImageElement } | null = null;

function characterKey(slot: Slot, skin: string): string {
  const { preset } = slot;
  return [
    skin,
    preset.pose,
    preset.theta,
    preset.phi,
    preset.zoom,
    serializeRig(preset.light),
  ].join('|');
}

async function doCharacter(slot: Slot, skin: string): Promise<HTMLImageElement> {
  const viewer = await getViewer();
  const { preset, variant } = slot;
  viewer.resize(PREVIEW_MASTER, PREVIEW_MASTER);
  await ensureSkin(viewer, skin);
  viewer.startRenderLoop();
  try {
    await nextFrames(2);
    await ensurePose(preset.pose, preset.bones);
    viewer.playAnimation(preset.pose);
    // Same rule as the batch: the pose only reaches the skeleton on a loop tick.
    await nextFrames(1);
    setLightRig(preset.light, resolveRigColors(variant));
    viewer.setRotation(preset.theta, preset.phi);
    viewer.setZoom(preset.zoom);
    return decodeImage(viewer.screenshot('png'));
  } finally {
    viewer.stopRenderLoop();
  }
}

/** One editor frame at `size`, reusing the cached character when only 2D values moved. */
export async function renderPreview(slot: Slot, skin: string, size: number): Promise<string> {
  const key = characterKey(slot, skin);
  let img = characterCache?.key === key ? characterCache.img : null;
  if (!img) {
    const run = queue.then(
      () => doCharacter(slot, skin),
      () => doCharacter(slot, skin),
    );
    queue = run.catch(() => undefined);
    img = await run;
    characterCache = { key, img };
  }
  return cropSquare(img, slot.preset.crop, PREVIEW_MASTER, size, slot.variant);
}

/** Drop the cached character, e.g. when the editor closes. */
export function clearPreviewCache(): void {
  characterCache = null;
}

/**
 * Run one extra capture job on the shared viewer queue. The banner renders six
 * figures in a single job; jobs never overlap, so the GL context stays intact.
 */
export function enqueueCapture<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export function getSkinViewer(): Promise<Viewer> {
  return getViewer();
}

export function prepareSkin(viewer: Viewer, skin: string): Promise<void> {
  return ensureSkin(viewer, skin);
}

export function waitFrames(count: number): Promise<void> {
  return nextFrames(count);
}

export function toImage(dataUrl: string): Promise<HTMLImageElement> {
  return decodeImage(dataUrl);
}