import type { BannerCard } from '../banner/cards';
import type { BannerSpec } from '../preset/banner';
import type { Slot } from '../preset/variants';
import type { CardRecipe } from '../card/procedural';

export interface FeedItem {
  id: number;
  status: 'queued' | 'rendering' | 'ready' | 'error';
  slot: Slot;
  url: string | null;
  spec?: BannerSpec;
  card?: BannerCard;
  cardRecipe?: CardRecipe;
}

export type FeedKind = 'pfp' | 'banner' | 'card';
