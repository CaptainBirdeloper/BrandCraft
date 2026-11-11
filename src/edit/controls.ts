import { clampRig, LIGHT_TARGET } from '../lighting/lightrig';
import type { LightRig, Vec3 } from '../lighting/lightrig';
import { poseKey } from '../render/poses';
import { SLOT_KEYS } from '../preset/presets';
import type { BonePose } from '../preset/presets';
import type { Slot, StarSpec } from '../preset/variants';

export type GroupId = 'camera' | 'framing' | 'pose' | 'backdrop' | 'star' | 'light';

export interface ParamGroup {
  id: GroupId;
  title: string;
  hint: string;
}

/**
 * One slider. `get` returns the value the user sees (already rounded to the step), so
 * the label, the code and a decode/encode round trip always agree.
 */
export interface Param {
  id: string;
  label: string;
  group: GroupId;
  /** A function when the bound depends on another value, like the crop offset. */
  min: number | ((slot: Slot) => number);
  max: number | ((slot: Slot) => number);
  step: number;
  unit: string;
  get: (slot: Slot) => number;
  set: (slot: Slot, value: number) => Slot;
}

type LampKey = 'key' | 'fill' | 'rim';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const tidy = (value: number) => Math.round(value * 1000) / 1000;
const toDeg = (rad: number) => (rad * 180) / Math.PI;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Direct angles are wrapped to −180…180 so the slider never reads 270. */
function wrapDeg(rad: number): number {
  const deg = toDeg(rad);
  return Math.round((((deg + 180) % 360) + 360) % 360 - 180);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const delta = max - min;
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const raw = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: raw * 60, s, l };
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 1);
  const l = clamp(lightness, 0, 1);
  const channel = (offset: number): number => {
    const k = (offset + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255);
  };
  const byte = (value: number) => value.toString(16).padStart(2, '0');
  return `#${byte(channel(0))}${byte(channel(8))}${byte(channel(4))}`;
}

/** Hue / saturation / lightness sliders over one hex, without a palette anywhere. */
function colourParams(
  group: GroupId,
  idPrefix: string,
  name: string,
  read: (slot: Slot) => string,
  write: (slot: Slot, hex: string) => Slot,
): Param[] {
  const setter = (channel: 'h' | 's' | 'l') => (slot: Slot, value: number): Slot => {
    const current = hexToHsl(read(slot));
    const h = channel === 'h' ? value : current.h;
    const s = channel === 's' ? value / 100 : current.s;
    const l = channel === 'l' ? value / 100 : current.l;
    return write(slot, hslToHex(h, s, l));
  };
  return [
    {
      id: `${idPrefix}-h`,
      label: `${name} hue`,
      group,
      min: 0,
      max: 360,
      step: 1,
      unit: '°',
      get: (slot) => Math.round(hexToHsl(read(slot)).h),
      set: setter('h'),
    },
    {
      id: `${idPrefix}-s`,
      label: `${name} saturation`,
      group,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
      get: (slot) => Math.round(hexToHsl(read(slot)).s * 100),
      set: setter('s'),
    },
    {
      id: `${idPrefix}-l`,
      label: `${name} lightness`,
      group,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
      get: (slot) => Math.round(hexToHsl(read(slot)).l * 100),
      set: setter('l'),
    },
  ];
}

const BONE_NAMES = ['Head', 'Body', 'Right arm', 'Left arm', 'Right leg', 'Left leg'];
const AXES = ['x', 'y', 'z'] as const;
const AXIS_NAMES = ['pitch', 'turn', 'tilt'];

function boneOf(slot: Slot, index: number): BonePose {
  return slot.preset.bones.find((bone) => bone.slot === index) ?? { slot: index };
}

function withBone(slot: Slot, index: number, axis: number, value: number): Slot {
  const bones = slot.preset.bones.map((bone) => ({ ...bone }));
  let target = bones.find((bone) => bone.slot === index);
  if (!target) {
    target = { slot: index };
    bones.push(target);
  }
  target[AXES[axis]] = clamp(Math.round(value), -180, 180);
  bones.sort((a, b) => a.slot - b.slot);
  // New bones mean a new pose name, or ensurePose would keep serving the old pose.
  return { ...slot, preset: { ...slot.preset, bones, pose: poseKey(bones) } };
}

function withStar(slot: Slot, patch: Partial<StarSpec>): Slot {
  return { ...slot, variant: { ...slot.variant, star: { ...slot.variant.star, ...patch } } };
}

function withCrop(slot: Slot, patch: { size?: number; x?: number; y?: number }): Slot {
  const crop = { ...slot.preset.crop };
  if (patch.size !== undefined) {
    const size = clamp(patch.size, 10, 100) / 100;
    crop.w = size;
    crop.h = size;
  }
  if (patch.x !== undefined) crop.x = patch.x / 100;
  if (patch.y !== undefined) crop.y = patch.y / 100;
  // One invariant for every crop write: the square stays inside the render.
  crop.x = tidy(clamp(crop.x, 0, 1 - crop.w));
  crop.y = tidy(clamp(crop.y, 0, 1 - crop.h));
  return { ...slot, preset: { ...slot.preset, crop } };
}

function spherical(pos: Vec3): { az: number; el: number; r: number } {
  const dx = pos[0] - LIGHT_TARGET[0];
  const dy = pos[1] - LIGHT_TARGET[1];
  const dz = pos[2] - LIGHT_TARGET[2];
  const r = Math.hypot(dx, dy, dz) || 1;
  return {
    az: toDeg(Math.atan2(dx, dz)),
    el: toDeg(Math.asin(clamp(dy / r, -1, 1))),
    r,
  };
}

function setLamp(
  slot: Slot,
  which: LampKey,
  patch: { az?: number; el?: number; intensity?: number },
): Slot {
  const light = slot.preset.light[which];
  const current = spherical(light.pos);
  const moves = patch.az !== undefined || patch.el !== undefined;
  const az = toRad(patch.az ?? current.az);
  const el = toRad(clamp(patch.el ?? current.el, -85, 85));
  const pos: Vec3 = moves
    ? [
        Math.round((LIGHT_TARGET[0] + current.r * Math.cos(el) * Math.sin(az)) * 10) / 10,
        Math.round((LIGHT_TARGET[1] + current.r * Math.sin(el)) * 10) / 10,
        Math.round((LIGHT_TARGET[2] + current.r * Math.cos(el) * Math.cos(az)) * 10) / 10,
      ]
    : light.pos;
  const rig: LightRig = {
    ...slot.preset.light,
    [which]: { pos, intensity: tidy(clamp(patch.intensity ?? light.intensity, 0, 2)) },
  };
  return { ...slot, preset: { ...slot.preset, light: clampRig(rig) } };
}

const cameraParams: Param[] = [
  {
    id: 'cam-theta',
    label: 'Orbit',
    group: 'camera',
    min: -180,
    max: 180,
    step: 1,
    unit: '°',
    get: (slot) => wrapDeg(slot.preset.theta),
    set: (slot, value) => ({ ...slot, preset: { ...slot.preset, theta: tidy(toRad(value)) } }),
  },
  {
    id: 'cam-phi',
    label: 'Height',
    group: 'camera',
    min: 3,
    max: 177,
    step: 1,
    unit: '°',
    get: (slot) => Math.round(toDeg(slot.preset.phi)),
    set: (slot, value) => ({
      ...slot,
      preset: { ...slot.preset, phi: tidy(toRad(clamp(value, 3, 177))) },
    }),
  },
  {
    id: 'cam-zoom',
    label: 'Distance',
    group: 'camera',
    min: 20,
    max: 150,
    step: 1,
    unit: '',
    get: (slot) => Math.round(slot.preset.zoom),
    set: (slot, value) => ({
      ...slot,
      preset: { ...slot.preset, zoom: Math.round(clamp(value, 20, 150)) },
    }),
  },
];

const framingParams: Param[] = [
  {
    id: 'crop-size',
    label: 'Bust size',
    group: 'framing',
    min: 10,
    max: 100,
    step: 1,
    unit: '%',
    get: (slot) => Math.round(slot.preset.crop.w * 100),
    set: (slot, value) => withCrop(slot, { size: Math.round(value) }),
  },
  {
    id: 'crop-x',
    label: 'Horizontal',
    group: 'framing',
    min: 0,
    max: (slot) => Math.round((1 - slot.preset.crop.w) * 100),
    step: 1,
    unit: '%',
    get: (slot) => Math.round(slot.preset.crop.x * 100),
    set: (slot, value) => withCrop(slot, { x: Math.round(value) }),
  },
  {
    id: 'crop-y',
    label: 'Vertical',
    group: 'framing',
    min: 0,
    max: (slot) => Math.round((1 - slot.preset.crop.h) * 100),
    step: 1,
    unit: '%',
    get: (slot) => Math.round(slot.preset.crop.y * 100),
    set: (slot, value) => withCrop(slot, { y: Math.round(value) }),
  },
];

const poseParams: Param[] = [];
for (let bone = 0; bone < SLOT_KEYS.length; bone += 1) {
  for (let axis = 0; axis < AXES.length; axis += 1) {
    poseParams.push({
      id: `bone-${SLOT_KEYS[bone]}-${AXES[axis]}`,
      label: `${BONE_NAMES[bone]} ${AXIS_NAMES[axis]}`,
      group: 'pose',
      min: -180,
      max: 180,
      step: 1,
      unit: '°',
      get: (slot) => Math.round(boneOf(slot, bone)[AXES[axis]] ?? 0),
      set: (slot, value) => withBone(slot, bone, axis, value),
    });
  }
}

const backdropParams = colourParams(
  'backdrop',
  'bg',
  'Backdrop',
  (slot) => slot.variant.bg,
  (slot, hex) => ({ ...slot, variant: { ...slot.variant, bg: hex } }),
);

const starParams: Param[] = [
  {
    id: 'star-points',
    label: 'Points',
    group: 'star',
    min: 3,
    max: 7,
    step: 1,
    unit: '',
    get: (slot) => slot.variant.star.points,
    set: (slot, value) => withStar(slot, { points: Math.round(clamp(value, 3, 7)) }),
  },
  {
    id: 'star-x',
    label: 'Across',
    group: 'star',
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    get: (slot) => Math.round(slot.variant.star.x * 100),
    set: (slot, value) => withStar(slot, { x: clamp(Math.round(value), 0, 100) / 100 }),
  },
  {
    id: 'star-y',
    label: 'Down',
    group: 'star',
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    get: (slot) => Math.round(slot.variant.star.y * 100),
    set: (slot, value) => withStar(slot, { y: clamp(Math.round(value), 0, 100) / 100 }),
  },
  {
    id: 'star-size',
    label: 'Size',
    group: 'star',
    min: 6,
    max: 45,
    step: 1,
    unit: '%',
    get: (slot) => Math.round(slot.variant.star.size * 100),
    set: (slot, value) => withStar(slot, { size: clamp(Math.round(value), 6, 45) / 100 }),
  },
  {
    id: 'star-rotation',
    label: 'Rotation',
    group: 'star',
    min: -90,
    max: 90,
    step: 1,
    unit: '°',
    get: (slot) => Math.round(slot.variant.star.rotation),
    set: (slot, value) => withStar(slot, { rotation: clamp(Math.round(value), -90, 90) }),
  },
  ...colourParams(
    'star',
    'star-color',
    'Star',
    (slot) => slot.variant.star.color,
    (slot, hex) => withStar(slot, { color: hex }),
  ),
];

const LAMPS: { key: LampKey; label: string }[] = [
  { key: 'key', label: 'Key' },
  { key: 'fill', label: 'Fill' },
  { key: 'rim', label: 'Rim' },
];

const lightParams: Param[] = [];
for (const lamp of LAMPS) {
  lightParams.push(
    {
      id: `light-${lamp.key}-az`,
      label: `${lamp.label} azimuth`,
      group: 'light',
      min: -180,
      max: 180,
      step: 1,
      unit: '°',
      get: (slot) => Math.round(spherical(slot.preset.light[lamp.key].pos).az),
      set: (slot, value) =>
        setLamp(slot, lamp.key, { az: clamp(Math.round(value), -180, 180) }),
    },
    {
      id: `light-${lamp.key}-el`,
      label: `${lamp.label} elevation`,
      group: 'light',
      min: -85,
      max: 85,
      step: 1,
      unit: '°',
      get: (slot) => Math.round(spherical(slot.preset.light[lamp.key].pos).el),
      set: (slot, value) => setLamp(slot, lamp.key, { el: clamp(Math.round(value), -85, 85) }),
    },
    {
      id: `light-${lamp.key}-i`,
      label: `${lamp.label} intensity`,
      group: 'light',
      min: 0,
      max: 2,
      step: 0.05,
      unit: '',
      get: (slot) => tidy(slot.preset.light[lamp.key].intensity),
      set: (slot, value) => setLamp(slot, lamp.key, { intensity: tidy(clamp(value, 0, 2)) }),
    },
  );
}
lightParams.push(
  {
    id: 'light-ambient',
    label: 'Ambient',
    group: 'light',
    min: 0,
    max: 1,
    step: 0.01,
    unit: '',
    get: (slot) => tidy(slot.preset.light.ambient),
    set: (slot, value) => ({
      ...slot,
      preset: {
        ...slot.preset,
        light: clampRig({ ...slot.preset.light, ambient: tidy(clamp(value, 0, 1)) }),
      },
    }),
  },
  {
    id: 'light-contrast',
    label: 'Contrast',
    group: 'light',
    min: 0,
    max: 1,
    step: 0.01,
    unit: '',
    get: (slot) => tidy(slot.preset.light.contrast),
    set: (slot, value) => ({
      ...slot,
      preset: {
        ...slot.preset,
        light: clampRig({ ...slot.preset.light, contrast: tidy(clamp(value, 0, 1)) }),
      },
    }),
  },
);

export const GROUPS: ParamGroup[] = [
  { id: 'camera', title: 'Camera', hint: 'Where the viewer stands' },
  { id: 'framing', title: 'Framing', hint: 'Square crop over the render' },
  { id: 'pose', title: 'Pose', hint: 'Degrees per bone' },
  { id: 'backdrop', title: 'Backdrop', hint: 'Flat background fill' },
  { id: 'star', title: 'Star', hint: 'Shape and colour' },
  { id: 'light', title: 'Lighting', hint: 'Aim at the torso centre' },
];

export const PARAMS: Param[] = [
  ...cameraParams,
  ...framingParams,
  ...poseParams,
  ...backdropParams,
  ...starParams,
  ...lightParams,
];

export function paramsOf(group: GroupId): Param[] {
  return PARAMS.filter((param) => param.group === group);
}

function resolve(bound: number | ((slot: Slot) => number), slot: Slot): number {
  return typeof bound === 'number' ? bound : bound(slot);
}

export function boundsOf(param: Param, slot: Slot): { min: number; max: number } {
  return { min: resolve(param.min, slot), max: resolve(param.max, slot) };
}

/** Single entry point: clamps against live bounds, then applies. */
export function applyParam(slot: Slot, param: Param, value: number): Slot {
  const { min, max } = boundsOf(param, slot);
  return param.set(slot, clamp(value, min, max));
}
