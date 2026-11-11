import { create } from 'zustand';
import type { Slot } from './preset/variants';
import { nextSeed, randomizeSlots, seedFromSearch } from './preset/randomize';
import { SLOTS } from './preset/slots';

type Screen = 'editor' | 'edit' | 'download';

interface AppState {
  skinUrl: string | null;
  skinName: string;
  /** Seed behind the current grid, so a roll can be repeated or shared. */
  seed: number;
  /** Menu cards: the eight base presets, re-rolled from `seed`. */
  slots: Slot[];
  slot: Slot;
  customSlot: Slot | null;
  codeError: boolean;
  screen: Screen;
  /** The editor works on a draft; the grid only changes when the draft is committed. */
  editDraft: Slot | null;
  /** Where closing the download page returns to. */
  returnTo: 'editor' | 'edit';
  toast: string | null;
  setSkin: (url: string, name: string) => void;
  selectPreset: (slot: Slot) => void;
  setCustomPreset: (slot: Slot) => void;
  setCodeError: (error: boolean) => void;
  reroll: () => void;
  openEdit: (slot: Slot) => void;
  updateDraft: (slot: Slot) => void;
  commitEdit: () => void;
  openDownload: () => void;
  closeDownload: () => void;
  showToast: (message: string) => void;
  clearToast: () => void;
}

/** Built before first paint: the grid never flashes the slots.txt looks first. */
const initialSeed = seedFromSearch(window.location.search);
const initialSlots = randomizeSlots(SLOTS, initialSeed);

export const useAppStore = create<AppState>((set) => ({
  skinUrl: null,
  skinName: '',
  seed: initialSeed,
  slots: initialSlots,
  slot: initialSlots[0],
  customSlot: null,
  codeError: false,
  screen: 'editor',
  editDraft: null,
  returnTo: 'editor',
  toast: null,
  setSkin: (url, name) => set({ skinUrl: url, skinName: name, screen: 'editor' }),
  selectPreset: (slot) => set({ slot }),
  setCustomPreset: (slot) => set({ customSlot: slot, slot, codeError: false }),
  setCodeError: (codeError) => set({ codeError }),
  reroll: () =>
    set((state) => {
      const seed = nextSeed(state.seed);
      const slots = randomizeSlots(SLOTS, seed);
      const selected = slots.find((item) => item.preset.id === state.slot.preset.id) ?? slots[0];
      return { seed, slots, slot: selected };
    }),
  openEdit: (slot) => set({ editDraft: slot, slot, screen: 'edit' }),
  updateDraft: (slot) => set({ editDraft: slot, slot }),
  commitEdit: () =>
    set((state) => {
      const draft = state.editDraft;
      if (!draft) return { screen: 'editor' as Screen };
      const id = draft.preset.id;
      return {
        slots: state.slots.map((item) => (item.preset.id === id ? draft : item)),
        customSlot: state.customSlot?.preset.id === id ? draft : state.customSlot,
        slot: draft,
        editDraft: null,
        screen: 'editor' as Screen,
      };
    }),
  openDownload: () =>
    set((state) => ({ screen: 'download', returnTo: state.screen === 'edit' ? 'edit' : 'editor' })),
  closeDownload: () => set((state) => ({ screen: state.returnTo, returnTo: 'editor' })),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
}));
