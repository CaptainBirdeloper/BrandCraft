import { useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import type { BannerCard } from '../banner/cards';
import { offsetOf, type Metrics } from './metrics';
import type { BannerSpec } from '../preset/banner';
import type { Slot } from '../preset/variants';
import type { FeedItem, FeedKind } from './types';
import { DownloadIcon, PencilIcon } from '../components/icons';
import { BOUNCY, TAP, TAP_TRANSITION } from '../motion';
import { CARD_EXPORT_SIZES, CardExportSize } from '../card/types';
import { renderCardRecipe } from '../card/procedural';
import { renderPreset } from '../render/render';
import { useAppStore } from '../store';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

interface FeedCellProps {
  item: FeedItem;
  metrics: Metrics;
  kind: FeedKind;
  onEdit: (slot: Slot) => void;
  onDownload: (slot: Slot) => void;
  onBannerDownload: (spec: BannerSpec, card: BannerCard) => void;
}

export function FeedCell({
  item,
  metrics,
  kind,
  onEdit,
  onDownload,
  onBannerDownload,
}: FeedCellProps) {
  const { left, top } = offsetOf(item.id, metrics);
  const style = { left, top, width: metrics.cellW, height: metrics.cellH };
  const label = item.slot.preset.label;

  const [showSizes, setShowSizes] = useState(false);
  const [exportingSize, setExportingSize] = useState<string | null>(null);

  const handleExport = async (size: CardExportSize) => {
    const skinUrl = useAppStore.getState().skinUrl;
    if (!skinUrl || !item.cardRecipe || exportingSize) return;
    setExportingSize(size.label);

    let exportBustUrl: string | null = null;
    let exportObjUrl: string | null = null;

    try {
      const renderSize = Math.max(512, Math.min(2048, Math.round(size.width * 0.75)));
      exportBustUrl = await renderPreset(item.slot, skinUrl, renderSize);
      const bust = await loadImage(exportBustUrl);

      const canvas = renderCardRecipe(
        item.cardRecipe,
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
      const cleanName = (item.cardRecipe.spec.username || 'player').replace(/[^a-zA-Z0-9_-]/g, '_');
      const link = document.createElement('a');
      link.download = `${cleanName}-card-${item.cardRecipe.archetype}-${size.label}.png`;
      link.href = exportObjUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export card from feed:', err);
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
      className="feed-cell"
      style={style}
      onMouseLeave={() => setShowSizes(false)}
    >
      {item.url ? (
        <img className="feed-cell-img" src={item.url} alt={label} draggable={false} />
      ) : (
        <span className="feed-cell-placeholder">
          {item.status === 'error' ? 'Skipped' : 'Rendering'}
        </span>
      )}
      <div className="feed-cell-actions">
        {kind === 'banner' ? (
          <button
            type="button"
            className="circle"
            aria-label={`Download ${label}`}
            onClick={() => {
              if (item.spec && item.card) onBannerDownload(item.spec, item.card);
            }}
          >
            <DownloadIcon />
          </button>
        ) : kind === 'card' ? (
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
                key="dl-circle"
                type="button"
                className="circle"
                aria-label={`Download ${label}`}
                onClick={() => setShowSizes(true)}
                whileTap={TAP}
                transition={TAP_TRANSITION}
              >
                <DownloadIcon />
              </m.button>
            )}
          </AnimatePresence>
        ) : (
          <>
            <button
              type="button"
              className="circle"
              aria-label={`Edit ${label}`}
              onClick={() => onEdit(item.slot)}
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              className="circle"
              aria-label={`Download ${label}`}
              onClick={() => onDownload(item.slot)}
            >
              <DownloadIcon />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
