import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { SMOOTH, TAP, TAP_TRANSITION, screenVariants } from '../motion';
import { EXPORT_SIZES, type ExportSize } from '../preset/presets';
import { renderPreset } from '../render/render';
import { useAppStore } from '../store';

const PREVIEW_SIZE = 1024;

export function DownloadScreen() {
  const skinUrl = useAppStore((s) => s.skinUrl);
  const slot = useAppStore((s) => s.slot);
  const closeDownload = useAppStore((s) => s.closeDownload);

  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    renderPreset(slot, skinUrl, PREVIEW_SIZE)
      .then((url) => {
        if (!cancelled) setPreview(url);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slot, skinUrl]);

  if (!skinUrl) return null;

  const download = async (size: ExportSize) => {
    setBusy(true);
    try {
      const url = await renderPreset(slot, skinUrl, size);
      const link = document.createElement('a');
      link.href = url;
      link.download = `brandcraft-${slot.preset.id}-${size}.png`;
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
      <div className="download-preview">
        <AnimatePresence initial={false}>
          {preview ? (
            <m.img
              key={preview}
              className="download-img"
              src={preview}
              alt={`${slot.preset.label} preview`}
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
        {EXPORT_SIZES.map((size) => (
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
