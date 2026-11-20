import { LIGHT_TARGET } from '../lighting/lightrig';
import type { Vec3 } from '../lighting/lightrig';

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
export const tidy = (value: number): number => Math.round(value * 1000) / 1000;
export const toDeg = (rad: number): number => (rad * 180) / Math.PI;
export const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Direct angles are wrapped to −180…180 so the slider never reads 270. */
export function wrapDeg(rad: number): number {
  const deg = toDeg(rad);
  return Math.round((((deg + 180) % 360) + 360) % 360 - 180);
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
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
  const hue = ((raw * 60) % 360 + 360) % 360;
  return { h: hue, s, l };
}

export function hslToHex(hue: number, saturation: number, lightness: number): string {
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

export function spherical(pos: Vec3): { az: number; el: number; r: number } {
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
