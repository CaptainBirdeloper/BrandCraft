import type { LightRig } from '../lighting/lightrig';

export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bone slot order used by preset codes. Fixed: do not reorder. */
export const SLOT_KEYS = ['hd', 'bd', 'ra', 'la', 'rl', 'll'] as const;

export interface BonePose {
  /** Index into SLOT_KEYS: 0 Head, 1 Body, 2 RightArm, 3 LeftArm, 4 RightLeg, 5 LeftLeg. */
  slot: number;
  x?: number;
  y?: number;
  z?: number;
}

export interface Preset {
  id: string;
  label: string;
  pose: string;
  bones: readonly BonePose[];
  theta: number;
  phi: number;
  zoom: number;
  crop: Crop;
  light: LightRig;
}

// Profile-picture busts: head fills ~55-60% of the crop. Camera target is fixed at
// model center [0,16,0] and zoom clamps at 20, so head framing comes from a 2D crop
// of the full render, not from the camera. zoom 27 keeps the whole head inside the
// render (zoom 24 cuts the hair at the top edge).
export const DEFAULT_CROP: Crop = { x: 0.29, y: 0.02, w: 0.42, h: 0.42 };

export const EXPORT_SIZES = [1024, 2048, 4096] as const;

export type ExportSize = (typeof EXPORT_SIZES)[number];
