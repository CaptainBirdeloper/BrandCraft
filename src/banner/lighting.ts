import type { LightRig } from '../lighting/lightrig';
import type { RigFamily } from '../preset/banner';
import type { Slot } from '../preset/variants';

/**
 * The profile card rig points every light at one centred bust. A banner lights two
 * figures that face away from each other, so the families keep the slot's own hue
 * and pose but push the key outward and trade ambient for rim. The middle of the
 * strip stays a valley, which is where the wordmark sits.
 */
interface FamilyStyle {
  ambient: number;
  contrast: number;
  key: number;
  fill: number;
  rim: number;
  /** Multiplier on the key light's x. Above 1 hangs the key off the outer edge. */
  keyOut: number;
}

const FAMILIES: Record<RigFamily, FamilyStyle> = {
  flat: { ambient: 0.62, contrast: 0.1, key: 1.15, fill: 0.75, rim: 0.45, keyOut: 0.8 },
  editorial: { ambient: 0.34, contrast: 0.32, key: 1.6, fill: 0.42, rim: 1.05, keyOut: 1.8 },
  rim: { ambient: 0.26, contrast: 0.3, key: 0.6, fill: 0.3, rim: 2.2, keyOut: 1.2 },
};

/** Same rig, lit from the other side. Keeps the centre between the two a valley. */
export function mirrorRig(rig: LightRig): LightRig {
  const flip = (light: LightRig['key']): LightRig['key'] => ({
    pos: [-light.pos[0], light.pos[1], light.pos[2]],
    intensity: light.intensity,
  });
  return {
    key: flip(rig.key),
    fill: flip(rig.fill),
    rim: flip(rig.rim),
    ambient: rig.ambient,
    contrast: rig.contrast,
  };
}

export function bannerRig(family: RigFamily, slot: Slot, side: 0 | 1): LightRig {
  const style = FAMILIES[family];
  const base = slot.preset.light;
  const rig: LightRig = {
    key: {
      pos: [base.key.pos[0] * style.keyOut, base.key.pos[1], base.key.pos[2]],
      intensity: style.key,
    },
    fill: { pos: base.fill.pos, intensity: style.fill },
    rim: { pos: base.rim.pos, intensity: style.rim },
    ambient: style.ambient,
    contrast: style.contrast,
  };
  return side === 1 ? mirrorRig(rig) : rig;
}
