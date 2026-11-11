import type { Animation, BoneIndex as Bone } from '@daidr/minecraft-skin-renderer';
import type { BonePose } from '../preset/presets';

let slotBones: Bone[] | null = null;
const registered = new Set<string>();

/**
 * Stable name for a bone set. `ensurePose` is idempotent per name, so an edited
 * pose needs a name that changes with its bones — otherwise the first registration
 * wins and every later edit renders the old pose.
 */
export function poseKey(bones: readonly BonePose[]): string {
  let hash = 2166136261;
  const text = bones
    .map((bone) => `${bone.slot}:${bone.x ?? 0},${bone.y ?? 0},${bone.z ?? 0};`)
    .join('|');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `pose-${(hash >>> 0).toString(36)}`;
}

/** Register one pose animation by name. Idempotent per name. */
export async function ensurePose(name: string, bones: readonly BonePose[]): Promise<void> {
  if (registered.has(name)) return;
  const core = await import('@daidr/minecraft-skin-renderer');
  slotBones ??= [
    core.BoneIndex.Head,
    core.BoneIndex.Body,
    core.BoneIndex.RightArm,
    core.BoneIndex.LeftArm,
    core.BoneIndex.RightLeg,
    core.BoneIndex.LeftLeg,
  ];

  const rot = (x: number, y: number, z: number) =>
    core.quatFromEuler(core.degToRad(x), core.degToRad(y), core.degToRad(z));

  const animation: Animation = {
    name,
    duration: 1,
    loop: true,
    tracks: bones.map((bone) => ({
      boneIndex: slotBones![bone.slot],
      keyframes: [{ time: 0, rotation: rot(bone.x ?? 0, bone.y ?? 0, bone.z ?? 0) }],
    })),
  };

  core.registerAnimation(animation);
  registered.add(name);
}
