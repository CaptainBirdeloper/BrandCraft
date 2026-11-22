export interface ColorgradeSpec {
  style?: string;
  contrast?: number; // 0.8 - 1.8
  saturation?: number; // 0.0 - 2.0
  tint?: readonly [number, number, number]; // RGB multipliers e.g. [1.2, 0.9, 1.1]
  intensity?: number; // 0.0 - 1.0 (blend with original)
}

export const COLORGRADE_PRESETS: Record<string, ColorgradeSpec> = {
  vibrant: { contrast: 1.35, saturation: 1.45, tint: [1.05, 1.0, 1.08] },
  noir: { contrast: 1.6, saturation: 0.0, tint: [1.0, 1.0, 1.0] },
  cyberpunk: { contrast: 1.4, saturation: 1.6, tint: [0.75, 1.15, 1.4] },
  matrix: { contrast: 1.5, saturation: 1.2, tint: [0.65, 1.45, 0.65] },
  sunset: { contrast: 1.3, saturation: 1.4, tint: [1.35, 0.9, 0.75] },
  cold_teal: { contrast: 1.35, saturation: 1.3, tint: [0.75, 1.2, 1.3] },
  crimson: { contrast: 1.45, saturation: 1.5, tint: [1.45, 0.7, 0.8] },
  golden: { contrast: 1.25, saturation: 1.35, tint: [1.3, 1.15, 0.75] },
};

const PRESET_KEYS = Object.keys(COLORGRADE_PRESETS);

export function randomColorgrade(rand: () => number): ColorgradeSpec {
  const key = PRESET_KEYS[Math.floor(rand() * PRESET_KEYS.length)];
  const base = COLORGRADE_PRESETS[key];
  return {
    style: key,
    contrast: Math.round((base.contrast! + (rand() - 0.5) * 0.4) * 100) / 100,
    saturation: Math.round((base.saturation! + (rand() - 0.5) * 0.5) * 100) / 100,
    tint: [
      Math.round((base.tint![0] + (rand() - 0.5) * 0.25) * 100) / 100,
      Math.round((base.tint![1] + (rand() - 0.5) * 0.25) * 100) / 100,
      Math.round((base.tint![2] + (rand() - 0.5) * 0.25) * 100) / 100,
    ],
    intensity: Math.round((0.75 + rand() * 0.25) * 100) / 100,
  };
}

export function applyColorgrade(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spec: ColorgradeSpec,
): void {
  if (width <= 0 || height <= 0) return;

  const contrast = spec.contrast ?? 1.0;
  const saturation = spec.saturation ?? 1.0;
  const [tR, tG, tB] = spec.tint ?? [1.0, 1.0, 1.0];
  const intensity = spec.intensity ?? 1.0;

  if (contrast === 1.0 && saturation === 1.0 && tR === 1.0 && tG === 1.0 && tB === 1.0) {
    return;
  }

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    const origR = data[i];
    const origG = data[i + 1];
    const origB = data[i + 2];

    // 1. Contrast expansion centered at 128
    let r = (origR - 128) * contrast + 128;
    let g = (origG - 128) * contrast + 128;
    let b = (origB - 128) * contrast + 128;

    // 2. Tint multiplication
    r *= tR;
    g *= tG;
    b *= tB;

    // 3. Saturation adjustment via luminance
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    r = luma + (r - luma) * saturation;
    g = luma + (g - luma) * saturation;
    b = luma + (b - luma) * saturation;

    // 4. Intensity blend with original
    if (intensity < 1.0) {
      r = origR * (1 - intensity) + r * intensity;
      g = origG * (1 - intensity) + g * intensity;
      b = origB * (1 - intensity) + b * intensity;
    }

    data[i] = r < 0 ? 0 : r > 255 ? 255 : r | 0;
    data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g | 0;
    data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b | 0;
  }

  ctx.putImageData(imgData, 0, 0);
}
