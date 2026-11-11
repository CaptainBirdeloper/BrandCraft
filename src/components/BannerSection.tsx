import { useEffect, useMemo, useState } from 'react';
import { m } from 'motion/react';
import { bannerCards, type BannerCard } from '../banner/cards';
import { renderBannerPreview } from '../render/banner';
import type { BannerSpec } from '../preset/banner';
import { BOUNCY, TAP } from '../motion';
import { useAppStore } from '../store';
import { RefreshIcon } from './icons';

/** Card previews are the strip itself at 1240 px wide: crisp on a 2x display. */
const CARD_WIDTH = 1240;
const DEBOUNCE_MS = 220;

interface TileProps {
  card: BannerCard;
  spec: BannerSpec;
  skinUrl: string;
}

/**
 * One banner. Its own render, its own randomizer: pressing refresh on card 3
 * re-rolls card 3 only, and the other three keep their look.
 */
function BannerTile({ card, spec, skinUrl }: TileProps) {
  const rerollBanner = useAppStore((s) => s.rerollBanner);
  const openBannerDownload = useAppStore((s) => s.openBannerDownload);

  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spins, setSpins] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const timer = window.setTimeout(() => {
      renderBannerPreview(spec, card, skinUrl, CARD_WIDTH)
        .then((next) => {
          if (!cancelled) setUrl(next);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          console.error('banner render failed:', err);
          setError(err instanceof Error ? err.message : String(err));
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [spec, card, skinUrl]);

  const shuffle = () => {
    setSpins((value) => value + 1);
    rerollBanner(card.index);
  };

  return (
    <div className="banner-card">
      <button
        type="button"
        className="banner-card-open"
        onClick={() => openBannerDownload(card.index)}
        aria-label={`Open banner ${card.index + 1}: ${card.left.preset.label} and ${card.right.preset.label}`}
      >
        {url ? (
          <img className="banner-card-img" src={url} alt="" />
        ) : (
          <span className="preset-placeholder">Rendering</span>
        )}
      </button>
      <m.button
        type="button"
        className="banner-card-reroll"
        aria-label={`Randomize banner ${card.index + 1}`}
        title="Randomize this banner: type, lighting, size, pairing"
        onClick={shuffle}
        whileTap={TAP}
        animate={{ rotate: spins * 360 }}
        transition={BOUNCY}
      >
        <RefreshIcon />
      </m.button>
      {error ? <span className="banner-card-error">{error}</span> : null}
    </div>
  );
}

export function BannerSection() {
  const skinUrl = useAppStore((s) => s.skinUrl);
  const slots = useAppStore((s) => s.slots);
  const customSlot = useAppStore((s) => s.customSlot);
  const banners = useAppStore((s) => s.banners);

  const pool = useMemo(() => (customSlot ? [...slots, customSlot] : slots), [slots, customSlot]);
  /** Only the pairings matter to the cards; re-rolling one must not re-render the rest. */
  const pairKey = banners.map((banner) => banner.pairOffset).join('-');
  const cards = useMemo(
    () => bannerCards(pool, pairKey.split('-').map((pairOffset) => ({ pairOffset: Number(pairOffset) }))),
    [pool, pairKey],
  );

  if (!skinUrl) return null;

  return (
    <section className="banners">
      <div className="banners-head">
        <h2 className="banners-title">Banners</h2>
      </div>
      <div className="banners-grid">
        {cards.map((card) => (
          <BannerTile
            key={card.index}
            card={card}
            spec={banners[card.index] ?? banners[0]}
            skinUrl={skinUrl}
          />
        ))}
      </div>
    </section>
  );
}
