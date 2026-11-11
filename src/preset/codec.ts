import { DEFAULT_RIG, parseRig, serializeRig } from '../lighting/lightrig';
import type { LightRig } from '../lighting/lightrig';
import type { BonePose, Crop } from './presets';
import { DEFAULT_CROP, SLOT_KEYS } from './presets';
import type { BackdropSpec, Slot, StarSpec } from './variants';
import { DEFAULT_BACKDROP, DEFAULT_VARIANT } from './variants';

const VERSION = 'MC1';
const MAX_LENGTH = 260;
const HEX = /^#[0-9a-fA-F]{6}$/;

function formatNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Encode a slot as a one-line share code, e.g.
 * MC1|hd:0,0,3|cam:0,1.5,27|crop:29,2,42,42|bg:#090446|star:5,80,20,22,0,#FFFF00
 */
export function encodePreset(slot: Slot): string {
  const { preset, variant } = slot;
  const parts = [VERSION];
  for (const bone of preset.bones) {
    const x = bone.x ?? 0;
    const y = bone.y ?? 0;
    const z = bone.z ?? 0;
    if (x === 0 && y === 0 && z === 0) continue;
    parts.push(`${SLOT_KEYS[bone.slot]}:${x},${y},${z}`);
  }
  parts.push(`cam:${formatNumber(preset.theta)},${formatNumber(preset.phi)},${Math.round(preset.zoom)}`);
  parts.push(
    `crop:${Math.round(preset.crop.x * 100)},${Math.round(preset.crop.y * 100)},` +
      `${Math.round(preset.crop.w * 100)},${Math.round(preset.crop.h * 100)}`,
  );
  parts.push(`bg:${variant.bg.toLowerCase()}`);
  const star = variant.star;
  parts.push(
    `star:${star.points},${Math.round(star.x * 100)},${Math.round(star.y * 100)},` +
      `${Math.round(star.size * 100)},${Math.round(star.rotation)},${star.color.toLowerCase()}`,
  );
  parts.push(
    `bgl:${variant.backdrop.style === 'riso' ? 'r' : 'f'},` +
      `${Math.round(variant.backdrop.pitch * 1000)},` +
      // Third slot is a retired grain value, kept as 0 so older codes still parse.
      `0,${variant.backdrop.ink2 ? 1 : 0}`,
  );
  parts.push(`light:${serializeRig(preset.light)}`);
  return parts.join('|');
}

/** Parse a share code. Returns null for anything malformed. */
export function decodePreset(code: string): Slot | null {
  const raw = code.trim();
  if (raw.length === 0 || raw.length > MAX_LENGTH) return null;

  const parts = raw.split('|');
  if (parts.shift() !== VERSION) return null;

  const bones: BonePose[] = [];
  let theta = 0;
  let phi = 1.5;
  let zoom = 27;
  let crop: Crop = DEFAULT_CROP;
  let variant = DEFAULT_VARIANT;
  let light: LightRig = DEFAULT_RIG;

  for (const part of parts) {
    const split = part.indexOf(':');
    if (split < 1) return null;
    const key = part.slice(0, split);
    const body = part.slice(split + 1);

    if (key === 'light') {
      const parsed = parseRig(body);
      if (!parsed) return null;
      light = parsed;
      continue;
    }

    if (key === 'bg') {
      if (!HEX.test(body)) return null;
      variant = { ...variant, bg: body.toLowerCase() };
      continue;
    }

    if (key === 'star') {
      const chunks = body.split(',');
      if (chunks.length !== 6) return null;
      const numbers = chunks.slice(0, 5).map(Number);
      if (numbers.some((value) => !Number.isFinite(value))) return null;
      if (!HEX.test(chunks[5])) return null;
      const star: StarSpec = {
        points: Math.round(clamp(numbers[0], 3, 7)),
        x: clamp(numbers[1], 0, 100) / 100,
        y: clamp(numbers[2], 0, 100) / 100,
        size: clamp(numbers[3], 6, 45) / 100,
        rotation: clamp(numbers[4], -90, 90),
        color: chunks[5].toLowerCase(),
      };
      variant = { ...variant, star };
      continue;
    }

    if (key === 'bgl') {
      const chunks = body.split(',');
      const pitch = Number(chunks[1]);
      const backdrop: BackdropSpec = {
        style: chunks[0] === 'r' ? 'riso' : 'flat',
        pitch: Number.isFinite(pitch) ? clamp(pitch, 6, 30) / 1000 : DEFAULT_BACKDROP.pitch,
        ink2: chunks[3] !== '0',
      };
      variant = { ...variant, backdrop };
      continue;
    }

    const values = body.split(',').map(Number);
    if (values.some((value) => !Number.isFinite(value))) return null;

    if (key === 'cam') {
      if (values.length !== 3) return null;
      theta = clamp(values[0], -Math.PI * 2, Math.PI * 2);
      phi = clamp(values[1], 0.05, Math.PI - 0.05);
      zoom = clamp(values[2], 20, 150);
      continue;
    }

    if (key === 'crop') {
      if (values.length !== 4) return null;
      const [x, y, w, h] = values.map((value) => clamp(value, 0, 100));
      if (w < 10 || h < 10 || x + w > 100 || y + h > 100) return null;
      crop = { x: x / 100, y: y / 100, w: w / 100, h: h / 100 };
      continue;
    }

    const slot = SLOT_KEYS.indexOf(key as (typeof SLOT_KEYS)[number]);
    if (slot < 0 || values.length !== 3) return null;
    bones.push({
      slot,
      x: clamp(values[0], -180, 180),
      y: clamp(values[1], -180, 180),
      z: clamp(values[2], -180, 180),
    });
  }

  const id = `custom-${Date.now().toString(36)}`;
  const preset = { id, label: 'Shared', pose: `pose-${id}`, bones, theta, phi, zoom, crop, light };
  return { preset, variant };
}

