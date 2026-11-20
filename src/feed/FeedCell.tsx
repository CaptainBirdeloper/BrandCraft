import type { BannerCard } from '../banner/cards';
import { offsetOf, type Metrics } from './metrics';
import type { BannerSpec } from '../preset/banner';
import type { Slot } from '../preset/variants';
import type { FeedItem, FeedKind } from './types';
import { DownloadIcon, PencilIcon } from '../components/icons';

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

  return (
    <div className="feed-cell" style={style}>
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
