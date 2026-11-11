import { AnimatePresence, m } from 'motion/react';
import { FAST, TAP, TAP_TRANSITION, cardVariants } from '../motion';
import type { Slot } from '../preset/variants';
import { CopyIcon, DownloadIcon, PencilIcon } from './icons';

interface Props {
  slot: Slot;
  /** Rendered square, or null until the first batch for this card lands. */
  src: string | null;
  error: string | null;
  selected: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDownload: () => void;
}

export function PresetCard({
  slot,
  src,
  error,
  selected,
  onSelect,
  onCopy,
  onEdit,
  onDownload,
}: Props) {
  return (
    <m.div className="preset" variants={cardVariants}>
      <m.button
        type="button"
        className="preset-select"
        aria-pressed={selected}
        aria-label={`Select ${slot.preset.label} preset`}
        onClick={onSelect}
        whileTap={TAP}
        transition={TAP_TRANSITION}
      >
        {/* Two stacked layers: a re-roll dissolves over the old square, never through black. */}
        <AnimatePresence initial={false}>
          {src ? (
            <m.img
              key={src}
              className="preset-img"
              src={src}
              alt=""
              initial={{ opacity: 0, scale: 1.015 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={FAST}
            />
          ) : null}
        </AnimatePresence>
        {src ? null : (
          <span className="preset-placeholder" title={error ?? undefined}>
            {error ?? 'Rendering'}
          </span>
        )}
      </m.button>
      <div className="preset-actions">
        <m.button
          type="button"
          className="circle"
          aria-label="Copy preset code"
          onClick={onCopy}
          whileTap={TAP}
          transition={TAP_TRANSITION}
        >
          <CopyIcon />
        </m.button>
        <m.button
          type="button"
          className="circle"
          aria-label="Edit preset"
          title="Edit preset"
          onClick={onEdit}
          whileTap={TAP}
          transition={TAP_TRANSITION}
        >
          <PencilIcon />
        </m.button>
        <m.button
          type="button"
          className="circle"
          aria-label="Download preset"
          onClick={onDownload}
          whileTap={TAP}
          transition={TAP_TRANSITION}
        >
          <DownloadIcon />
        </m.button>
      </div>
    </m.div>
  );
}
