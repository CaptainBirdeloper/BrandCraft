import { create } from 'zustand';
import {
  BANNER_SPEC_DEFAULTS,
  BANNER_FONTS,
  RIG_FAMILIES,
  TEXT_SCALES,
  PAIR_OFFSETS,
  type BannerSpec,
} from './preset/banner';
import type { Slot } from './preset/variants';
import type { BannerCard } from './banner/cards';
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
  returnTo: 'editor' | 'edit' | 'feed';
  /** Fullscreen feed on screen; tracked apart from `screen` so it survives a detour into the editor. */
  feedKind: 'pfp' | 'banner' | null;
  /** Last slot written by the editor, so the feed can refresh the cell it came from. */
  lastCommit: Slot | null;
  /** A banner opened from the feed: it is not one of the four in `banners`. */
  downloadBanner: { spec: BannerSpec; card: BannerCard } | null;
  /** One spec per banner: wordmark, typeface, lighting, size and pairing are per card. */
  banners: BannerSpec[];
  /** Banner card the download page is showing; null means the profile photo. */
  bannerIndex: number | null;
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
  openBannerDownload: (index: number) => void;
  closeDownload: () => void;
  openFeed: (kind: 'pfp' | 'banner') => void;
  closeFeed: () => void;
  openFeedDownload: (slot: Slot) => void;
  openFeedBannerDownload: (spec: BannerSpec, card: BannerCard) => void;
  setBanner: (index: number, patch: Partial<BannerSpec>) => void;
  rerollBanners: () => void;
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
  feedKind: null,
  lastCommit: null,
  downloadBanner: null,
  banners: BANNER_SPEC_DEFAULTS.map((spec) => ({ ...spec })),
  bannerIndex: null,
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
        lastCommit: draft,
        screen: 'editor' as Screen,
      };
    }),
  openDownload: () =>
    set((state) => ({
      screen: 'download',
      bannerIndex: null,
      downloadBanner: null,
      returnTo: state.screen === 'edit' ? 'edit' : state.feedKind ? 'feed' : 'editor',
    })),
  openBannerDownload: (index) =>
    set({ screen: 'download', bannerIndex: index, downloadBanner: null, returnTo: 'editor' }),
  closeDownload: () =>
    set((state) => ({
      screen: state.returnTo === 'edit' ? 'edit' : 'editor',
      returnTo: 'editor',
      downloadBanner: null,
    })),
  openFeed: (feedKind) => set({ feedKind }),
  closeFeed: () => set({ feedKind: null }),
  openFeedDownload: (slot) =>
    set({ slot, screen: 'download', bannerIndex: null, downloadBanner: null, returnTo: 'feed' }),
  openFeedBannerDownload: (spec, card) =>
    set({ screen: 'download', bannerIndex: null, downloadBanner: { spec, card }, returnTo: 'feed' }),
  setBanner: (index, patch) =>
    set((state) => ({
      banners: state.banners.map((spec, at) => (at === index ? { ...spec, ...patch } : spec)),
    })),
  /**
   * Re-rolls the whole banner section in one press, exactly like the profile
   * picture randomizer: every card steps to a fresh look and they change together,
   * so the four banners still give 5 x 3 x 3 x 5 combinations per press. A card
   * never lands on the look it already had, because that reads as a dead button.
   */
  rerollBanners: () =>
    set((state) => ({
      banners: state.banners.map((spec) => {
        const step = <T,>(list: readonly T[], current: T): T => {
          const from = list.indexOf(current);
          const next = (from + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
          return list[next] ?? current;
        };
        const font = step(BANNER_FONTS, BANNER_FONTS.find((item) => item.id === spec.fontId)!);
        return {
          ...spec,
          fontId: font.id,
          rig: step(RIG_FAMILIES, spec.rig),
          textScale: step<number>(TEXT_SCALES, spec.textScale),
          pairOffset: step<number>(PAIR_OFFSETS, spec.pairOffset),
        };
      }),
    })),
  showToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
}));
