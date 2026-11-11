import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { encodePreset } from '../preset/codec';
import { BOUNCY, FAST, gridVariants, screenVariants } from '../motion';
import { renderCutout, renderPresets } from '../render/render';
import { useAppStore } from '../store';
import type { Slot } from '../preset/variants';
import { PastePill } from './PastePill';
import { PresetCard } from './PresetCard';
import { SkinDrop } from './SkinDrop';
import { RefreshIcon } from './icons';

const CARD_SIZE = 512;
const CUTOUT_SIZE = 384;

/** Timing hook read by the verify probes; harmless in production. */
type TimedWindow = Window & {
  __bcRollMs?: number;
  __bcDrawn?: number;
};

export function Editor() {
  const skinUrl = useAppStore((s) => s.skinUrl);
  const skinName = useAppStore((s) => s.skinName);
  const slots = useAppStore((s) => s.slots);
  const slot = useAppStore((s) => s.slot);
  const customSlot = useAppStore((s) => s.customSlot);
  const toast = useAppStore((s) => s.toast);
  const selectPreset = useAppStore((s) => s.selectPreset);
  const reroll = useAppStore((s) => s.reroll);
  const openDownload = useAppStore((s) => s.openDownload);
  const openEdit = useAppStore((s) => s.openEdit);
  const showToast = useAppStore((s) => s.showToast);
  const clearToast = useAppStore((s) => s.clearToast);

  const [cutout, setCutout] = useState<string | null>(null);
  const [cards, setCards] = useState<Record<string, string>>({});
  const [cardError, setCardError] = useState<string | null>(null);
  /** One turn per roll, so the icon always spins the same amount. */
  const [spins, setSpins] = useState(0);

  const list = useMemo<Slot[]>(
    () => (customSlot ? [...slots, customSlot] : slots),
    [slots, customSlot],
  );

  useEffect(() => {
    if (!skinUrl) return;
    let cancelled = false;
    setCardError(null);
    const started = performance.now();
    renderPresets(list, skinUrl, CARD_SIZE)
      .then((urls) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        list.forEach((item, index) => {
          next[item.preset.id] = urls[index];
        });
        // Merge, never clear: a re-roll keeps the old square until the new one lands.
        setCards((previous) => ({ ...previous, ...next }));
        const perf = window as TimedWindow;
        perf.__bcRollMs = Math.round(performance.now() - started);
        perf.__bcDrawn = Math.round(performance.now());
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('preset batch failed:', err);
        setCardError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [list, skinUrl]);

  useEffect(() => {
    if (!skinUrl) return;
    let cancelled = false;
    renderCutout(skinUrl, CUTOUT_SIZE)
      .then((url) => {
        if (!cancelled) setCutout(url);
      })
      .catch(() => {
        if (!cancelled) setCutout(null);
      });
    return () => {
      cancelled = true;
    };
  }, [skinUrl]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(clearToast, 1600);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  if (!skinUrl) return null;

  const copyCode = (target: Slot) => {
    navigator.clipboard
      .writeText(encodePreset(target))
      .then(() => showToast('copied'))
      .catch(() => showToast('copy failed'));
  };

  const shuffle = () => {
    setSpins((value) => value + 1);
    reroll();
  };

  return (
    <m.main
      className="editor"
      variants={screenVariants}
      initial="hidden"
      animate="show"
      exit="out"
    >
      <section className="stage">
        <div className="stage-head">
          <h1 className="stage-title">Profile Picture</h1>
          <m.button
            type="button"
            className="refresh"
            aria-label="Randomize presets"
            title="Randomize presets"
            onClick={shuffle}
            animate={{ rotate: spins * 360 }}
            transition={BOUNCY}
          >
            <RefreshIcon />
          </m.button>
        </div>
        <m.div className="grid" variants={gridVariants} initial="hidden" animate="show">
          {list.map((item, index) => (
            <PresetCard
              key={`${item.preset.id}-${index}`}
              slot={item}
              src={cards[item.preset.id] ?? null}
              error={cardError}
              selected={item.preset.id === slot.preset.id}
              onSelect={() => selectPreset(item)}
              onCopy={() => copyCode(item)}
              onEdit={() => openEdit(item)}
              onDownload={() => {
                selectPreset(item);
                openDownload();
              }}
            />
          ))}
        </m.div>
      </section>

      <aside className="rail">
        <SkinDrop variant="pill" />

        <div className="cutout">
          {cutout ? (
            <m.img
              className="cutout-img"
              src={cutout}
              alt={`${skinName || 'Skin'} preview`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={FAST}
            />
          ) : (
            <span className="preset-placeholder">Rendering</span>
          )}
        </div>

        <PastePill variant="rail" />

        <AnimatePresence>
          {toast ? (
            <m.span
              key={toast}
              className="toast"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={FAST}
            >
              {toast}
            </m.span>
          ) : null}
        </AnimatePresence>

        <img className="rail-logo" src="/logo.png" alt="BrandCraft" />
      </aside>
    </m.main>
  );
}
