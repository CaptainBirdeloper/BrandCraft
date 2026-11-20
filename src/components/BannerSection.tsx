import { useEffect, useMemo, useState } from 'react';
import { m } from 'motion/react';
import { bannerCards, type BannerCard } from '../banner/cards';
import { renderBannerPreview } from '../render/banner';
import {
  DEFAULT_BANNER_SPEC,
  clampBannerText,
  type BannerSpec,
} from '../preset/banner';
import { BOUNCY } from '../motion';
import { useAppStore } from '../store';
import { RefreshIcon, FullscreenIcon } from './icons';

/** Card previews are the strip itself at 1240 px wide: crisp on a 2x display. */
const CARD_WIDTH = 1240;
const DEBOUNCE_MS = 220;

interface TileProps {
  card: BannerCard;
  spec: BannerSpec;
  skinUrl: string;
}

/**
 * Minimalist banner card: edge-to-edge artwork in 1546x423 aspect ratio.
 * Clicking opens full download screen. Zero overlay clutter.
 */
function BannerTile({ card, spec, skinUrl }: TileProps) {
  const openBannerDownload = useAppStore((s) => s.openBannerDownload);

  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const timer = window.setTimeout(() => {
      renderBannerPreview(spec, card, skinUrl, CARD_WIDTH)
        .then((next) => {
          if (cancelled) {
            URL.revokeObjectURL(next);
            return;
          }
          setUrl(next);
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

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

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
      {error ? <span className="banner-card-error">{error}</span> : null}
    </div>
  );
}

export function BannerSection() {
  const skinUrl = useAppStore((s) => s.skinUrl);
  const slots = useAppStore((s) => s.slots);
  const customSlot = useAppStore((s) => s.customSlot);
  const banners = useAppStore((s) => s.banners);
  const rerollBanners = useAppStore((s) => s.rerollBanners);
  const setBanner = useAppStore((s) => s.setBanner);

  const [spins, setSpins] = useState(0);
  const channelName = banners[0]?.text ?? 'Subscribe';

  const handleNameChange = (val: string) => {
    const sanitized = clampBannerText(val);
    banners.forEach((_, idx) => {
      setBanner(idx, { text: sanitized });
    });
  };

  const shuffle = () => {
    setSpins((value) => value + 1);
    rerollBanners();
  };

  const pool = useMemo(() => (customSlot ? [...slots, customSlot] : slots), [slots, customSlot]);
  const pairOffsets = banners.map((banner) => banner.pairOffset);
  const cards = useMemo(
    () => bannerCards(pool, pairOffsets.map((pairOffset) => ({ pairOffset }))),
    [pool, pairOffsets.join(',')],
  );

  if (!skinUrl) return null;

  return (
    <section className="banners">
      <div className="stage-head banners-head">
        <h2 className="stage-title">Banners</h2>
        <div className="wordmark-pill">
          <input
            type="text"
            className="wordmark-input"
            value={channelName}
            maxLength={16}
            placeholder="Wordmark"
            aria-label="Custom banner wordmark"
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>
        <m.button
          type="button"
          className="refresh"
          aria-label="Randomize banners"
          title="Randomize all four banners: archetype, type, lighting, size, pairing"
          onClick={shuffle}
          animate={{ rotate: spins * 360 }}
          transition={BOUNCY}
        >
          <RefreshIcon />
        </m.button>
        <button
          type="button"
          className="refresh-open"
          aria-label="Open fullscreen banner feed"
          title="Fullscreen: endless randomised banners, Esc to leave"
          onClick={() => useAppStore.getState().openFeed('banner')}
        >
          <FullscreenIcon />
        </button>
      </div>

      <div className="banners-grid">
        {cards.map((card) => (
          <BannerTile
            key={card.index}
            card={card}
            spec={banners[card.index] ?? banners[0] ?? DEFAULT_BANNER_SPEC}
            skinUrl={skinUrl}
          />
        ))}
      </div>
    </section>
  );
}
