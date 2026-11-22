export interface CardDimensions {
  width: number;
  height: number;
}

export interface CardExportSize extends CardDimensions {
  label: string;
}

export interface CardSpec {
  username: string;
  quote: string;
  seed: number;
  textColor?: string;
}

export type CardLayoutVariation =
  | 'poster-split'
  | 'editorial-cover'
  | 'swiss-asymmetric'
  | 'minimalist-dark';

export interface CardStyleInfo {
  id: CardLayoutVariation;
  label: string;
  badge: string;
}

export const CARD_STYLES: CardStyleInfo[] = [
  { id: 'poster-split', label: 'Poster Split', badge: 'HERO' },
  { id: 'editorial-cover', label: 'Editorial Cover', badge: 'CLASSIC' },
  { id: 'swiss-asymmetric', label: 'Swiss Modern', badge: 'MINIMAL' },
  { id: 'minimalist-dark', label: 'Obsidian Noir', badge: 'DARK' },
];

export interface ComposeCardOptions {
  spec: CardSpec;
  style?: CardLayoutVariation;
  presetImage?: HTMLImageElement | HTMLCanvasElement;
  targetWidth?: number;
  targetHeight?: number;
}

export const CARD_BASE_W = 720;
export const CARD_BASE_H = 960; // 3:4 aspect ratio

export const CARD_EXPORT_SIZES: CardExportSize[] = [
  { label: '1K', width: 720, height: 960 },
  { label: '2K', width: 1440, height: 1920 },
  { label: '4K', width: 2880, height: 3840 },
];

export const DEFAULT_CARD_SPEC: CardSpec = {
  username: 'BUILDER',
  quote: 'built with stone and fire',
  seed: 1337,
  textColor: '#FFFF00',
};
