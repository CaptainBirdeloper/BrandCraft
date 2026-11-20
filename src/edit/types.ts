import type { Slot } from '../preset/variants';

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

/**
 * A switch, not a slider: one press flips it. The screen is either printed or flat —
 * a two-stop range would say the same thing with more chrome.
 */
export interface Toggle {
  id: string;
  label: string;
  group: GroupId;
  get: (slot: Slot) => boolean;
  set: (slot: Slot, on: boolean) => Slot;
}

export type LampKey = 'key' | 'fill' | 'rim';
