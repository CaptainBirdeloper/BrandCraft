import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { SMOOTH, TAP, TAP_TRANSITION, screenVariants } from '../motion';
import { EXPORT_SIZES, type ExportSize } from '../preset/presets';
import { BANNER_SIZES } from '../preset/banner';
import { bannerCards } from '../banner/cards';
import { renderBanner } from '../render/banner';
import { renderPreset } from '../render/render';
import { useAppStore } from '../store';

const PREVIEW_SIZE = 1024;
const BANNER_PREVIEW_SIZE = 1600;

export function DownloadScreen() {
  const skinUrl = useAppStore((s) => s.skinUrl);
  const slot = useAppStore((s) => s.slot);
  const slots = useAppStore((s) => s.slots);
  const customSlot = useAppStore((s) => s.customSlot);
  const banners = useAppStore((s) => s.banners);
  const bannerIndex = useAppStore((s) => s.bannerIndex);
  const feedBanner = useAppStore((s) => s.downloadBanner);
  const closeDownload = useAppStore((s) => s.closeDownload);

  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pool = useMemo(() => (customSlot ? [...slots, customSlot] : slots), [slots, customSlot]);
  const cards = useMemo(() => bannerCards(pool, banners), [pool, banners]);
  /** A banner opened from the feed carries its own pair: it was never one of the four. */
  const card = feedBanner?.card ?? (bannerIndex === null ? null : cards[bannerIndex] ?? null);
  /** Each banner carries its own dressing; the download page renders exactly what the card showed. */
  const spec = feedBanner?.spec ?? (bannerIndex === null ? undefined : banners[bannerIndex]) ?? banners[0]!;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDownload();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeDownload]);

  useEffect(() => {
    if (!skinUrl) return;
    let cancelled = false;
    setPreview(null);
    const pending = card
      ? renderBanner(spec, card, skinUrl, BANNER_PREVIEW_SIZE).then((result) => result.url)
      : renderPreset(slot, skinUrl, PREVIEW_SIZE);
    pending
      .then((url) => {
        if (!cancelled) setPreview(url);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [card, spec, slot, skinUrl]);

  if (!skinUrl) return null;

  const sizes: readonly number[] = card ? BANNER_SIZES : EXPORT_SIZES;

  const download = async (size: number) => {
    setBusy(true);
    try {
      const url = card
        ? (await renderBanner(spec, card, skinUrl, size)).url
        : await renderPreset(slot, skinUrl, size as ExportSize);
      const link = document.createElement('a');
      link.href = url;
      link.download = card
        ? `brandcraft-banner-${card.index + 1}-${size}.png`
        : `brandcraft-${slot.preset.id}-${size}.png`;
      link.click();
      closeDownload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <m.main
      className="download"
      variants={screenVariants}
      initial="hidden"
      animate="show"
      exit="out"
    >
      <m.button
        type="button"
        className="download-back"
        onClick={closeDownload}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SMOOTH}
        whileTap={TAP}
      >
        press ESC to go back
      </m.button>
      <div className={card ? 'download-preview is-banner' : 'download-preview'}>
        <AnimatePresence initial={false}>
          {preview ? (
            <m.img
              key={preview}
              className="download-img"
              src={preview}
              alt={card ? `Banner ${card.index + 1} preview` : `${slot.preset.label} preview`}
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={SMOOTH}
            />
          ) : null}
        </AnimatePresence>
        {preview ? null : <span className="preset-placeholder">Rendering</span>}
      </div>
      <div className="sizes">
        {sizes.map((size) => (
          <m.button
            key={size}
            type="button"
            className="size-pill"
            disabled={busy}
            onClick={() => void download(size)}
            whileTap={TAP}
            transition={TAP_TRANSITION}
            animate={{ opacity: busy ? 0.5 : 1 }}
          >
            {size / 1024}k
          </m.button>
        ))}
      </div>
    </m.main>
  );
}
