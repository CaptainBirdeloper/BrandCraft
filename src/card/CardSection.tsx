import { FC, useEffect, useState, useMemo, useRef } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { renderPreset } from '../render/render';
import { generateCardRecipe, renderCardRecipe } from './procedural';
import {
  CardSpec,
  DEFAULT_CARD_SPEC,
  CARD_EXPORT_SIZES,
  CardExportSize,
} from './types';
import { BOUNCY, TAP, TAP_TRANSITION } from '../motion';
import { RefreshIcon, FullscreenIcon, DownloadIcon } from '../components/icons';
import type { Slot } from '../preset/variants';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

interface TileProps {
  slot: Slot;
  skinUrl: string;
  skinName: string | null;
  spec: CardSpec;
}

function CardTile({ slot, skinUrl, skinName, spec }: TileProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bustImg, setBustImg] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exportingSize, setExportingSize] = useState<string | null>(null);
  const [showSizes, setShowSizes] = useState<boolean>(false);

  // 1. Separate 3D bust generation: only re-render when slot or skinUrl changes
  useEffect(() => {
    if (!skinUrl || !slot) return;

    let cancelled = false;
    let currentBustUrl: string | null = null;
    setLoading(true);
    setBustImg(null);

    (async () => {
      try {
        const bustUrl = await renderPreset(slot, skinUrl, 512);
        currentBustUrl = bustUrl;
        if (cancelled) return;

        const img = await loadImage(bustUrl);
        if (cancelled) return;

        setBustImg(img);
      } catch (err) {
        console.error('Failed to render card bust:', err);
      } finally {
        if (currentBustUrl && currentBustUrl.startsWith('blob:')) {
          URL.revokeObjectURL(currentBustUrl);
        }
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (currentBustUrl && currentBustUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentBustUrl);
      }
    };
  }, [slot, skinUrl]);

  // 2. Realtime 2D procedural composition directly to canvas
  useEffect(() => {
    if (!bustImg || !canvasRef.current) return;

    const recipe = generateCardRecipe(spec.seed, spec);
    renderCardRecipe(
      recipe,
      bustImg,
      canvasRef.current,
      720,
      960,
    );
  }, [bustImg, spec.username, spec.quote, spec.seed, spec.textColor]);

  const handleExport = async (size: CardExportSize) => {
    if (!skinUrl || !slot || exportingSize) return;
    setExportingSize(size.label);

    let exportBustUrl: string | null = null;
    let exportObjUrl: string | null = null;

    try {
      const renderSize = Math.max(512, Math.min(2048, Math.round(size.width * 0.75)));
      exportBustUrl = await renderPreset(slot, skinUrl, renderSize);
      const bust = await loadImage(exportBustUrl);

      const recipe = generateCardRecipe(spec.seed, spec);
      const canvas = renderCardRecipe(
        recipe,
        bust,
        undefined,
        size.width,
        size.height,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png'),
      );

      canvas.width = 0;
      canvas.height = 0;

      if (!blob) throw new Error('Blob creation failed');

      exportObjUrl = URL.createObjectURL(blob);
      const cleanName = (spec.username || skinName || 'player').replace(/[^a-zA-Z0-9_-]/g, '_');
      const link = document.createElement('a');
      link.download = `${cleanName}-card-${recipe.archetype}-${size.label}.png`;
      link.href = exportObjUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export card:', err);
    } finally {
      if (exportBustUrl && exportBustUrl.startsWith('blob:')) {
        URL.revokeObjectURL(exportBustUrl);
      }
      if (exportObjUrl) {
        const toRevoke = exportObjUrl;
        setTimeout(() => URL.revokeObjectURL(toRevoke), 1000);
      }
      setExportingSize(null);
    }
  };

  return (
    <div
      className="card-item"
      onMouseLeave={() => setShowSizes(false)}
    >
      <canvas
        ref={canvasRef}
        width={720}
        height={960}
        className="card-img"
        style={{ display: bustImg ? 'block' : 'none' }}
      />
      {!bustImg && (
        <div className="card-placeholder">
          {loading ? 'Rendering' : 'Unavailable'}
        </div>
      )}

      <div
        className="card-actions"
        onMouseEnter={() => setShowSizes(true)}
      >
        <AnimatePresence mode="wait">
          {showSizes ? (
            <m.div
              key="sizes"
              className="card-sizes-group"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {CARD_EXPORT_SIZES.map((size, i) => (
                <m.button
                  key={size.label}
                  type="button"
                  className="card-size-pill"
                  disabled={exportingSize !== null}
                  onClick={() => {
                    handleExport(size);
                    setShowSizes(false);
                  }}
                  initial={{ scale: 0.5, opacity: 0, x: 10 }}
                  animate={{ scale: 1, opacity: 1, x: 0 }}
                  exit={{ scale: 0.5, opacity: 0, x: 10 }}
                  transition={{ ...BOUNCY, delay: i * 0.04 }}
                  whileTap={TAP}
                >
                  {exportingSize === size.label ? '...' : size.label.toLowerCase()}
                </m.button>
              ))}
            </m.div>
          ) : (
            <m.button
              key="download-btn"
              type="button"
              className="card-circle"
              aria-label="Download card"
              title="Download card"
              onClick={() => setShowSizes(true)}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              whileTap={TAP}
              transition={TAP_TRANSITION}
            >
              <DownloadIcon />
            </m.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export const CardSection: FC = () => {
  const skinUrl = useAppStore((s) => s.skinUrl);
  const skinName = useAppStore((s) => s.skinName);
  const slots = useAppStore((s) => s.slots);
  const baseSeed = useAppStore((s) => s.seed);

  const cardUsername = useAppStore((s) => s.cardUsername);
  const cardQuote = useAppStore((s) => s.cardQuote);
  const cardTextColor = useAppStore((s) => s.cardTextColor);
  const setCardSpec = useAppStore((s) => s.setCardSpec);

  const username = cardUsername || skinName || 'BUILDER';
  const quote = cardQuote;
  const textColor = cardTextColor;
  const [spins, setSpins] = useState(0);

  const shuffle = () => {
    setSpins((v) => v + 1);
  };

  // Assign a distinct slot to each card, rotating per refresh spin
  const cardSlots = useMemo(() => {
    if (!slots.length) return [];
    return [0, 1, 2, 3].map((idx) => {
      const slotIndex = (spins * 4 + idx) % slots.length;
      return slots[slotIndex];
    });
  }, [slots, spins]);

  if (!skinUrl || !slots.length) return null;

  return (
    <section className="cards-section" aria-label="Collector Cards">
      <div className="stage-head cards-head">
        <h2 className="stage-title">Cards</h2>
        <div className="wordmark-pill">
          <input
            type="text"
            className="wordmark-input"
            placeholder="Username"
            value={cardUsername || skinName || ''}
            onChange={(e) => setCardSpec({ username: e.target.value })}
            aria-label="Username"
          />
        </div>
        <div className="wordmark-pill">
          <input
            type="text"
            className="wordmark-input"
            placeholder="Quote"
            value={cardQuote}
            onChange={(e) => setCardSpec({ quote: e.target.value })}
            aria-label="Quote"
          />
        </div>
        <div className="wordmark-pill color-pill" title="Text color">
          <input
            type="color"
            className="card-color-input"
            value={cardTextColor}
            onChange={(e) => setCardSpec({ textColor: e.target.value })}
            aria-label="Text color"
          />
        </div>
        <m.button
          type="button"
          className="refresh"
          aria-label="Randomize card poses"
          title="Randomize card poses and styles"
          onClick={shuffle}
          animate={{ rotate: spins * 360 }}
          transition={BOUNCY}
        >
          <RefreshIcon />
        </m.button>
        <button
          type="button"
          className="refresh-open"
          aria-label="Open fullscreen feed"
          title="Fullscreen feed"
          onClick={() => useAppStore.getState().openFeed('card')}
        >
          <FullscreenIcon />
        </button>
      </div>

      <div className="cards-grid">
        {[0, 1, 2, 3].map((idx) => (
          <CardTile
            key={`procedural-card-${idx}-${spins}`}
            slot={cardSlots[idx] ?? slots[0]}
            skinUrl={skinUrl}
            skinName={skinName}
            spec={{
              ...DEFAULT_CARD_SPEC,
              username,
              quote,
              textColor,
              seed: baseSeed + spins * 101 + idx * 37,
            }}
          />
        ))}
      </div>
    </section>
  );
};
