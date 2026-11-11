import raw from './slots.txt?raw';
import { decodePreset } from './codec';
import type { Slot } from './variants';

/** `Label: MC1|...` — label is any word characters, spaces or dashes. */
const LINE = /^([A-Za-z0-9][\w -]*):\s*(MC1\|.*)$/;

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Menu cards, parsed from slots.txt at boot. The text file is the single source of
 * truth: same format as a share code, so an external LLM can write a card directly.
 */
function parse(text: string): Slot[] {
  const slots: Slot[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;

    const match = LINE.exec(trimmed);
    if (!match) {
      console.warn(`slots.txt: bad line "${trimmed}"`);
      continue;
    }

    const decoded = decodePreset(match[2]);
    if (!decoded) {
      console.warn(`slots.txt: invalid code for "${match[1]}"`);
      continue;
    }

    const id = slug(match[1]);
    slots.push({
      preset: { ...decoded.preset, id, label: match[1], pose: `pose-${id}` },
      variant: decoded.variant,
    });
  }

  if (slots.length === 0) throw new Error('slots.txt: no valid preset codes');
  return slots;
}

export const SLOTS: Slot[] = parse(raw);
