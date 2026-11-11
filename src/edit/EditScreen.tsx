import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { m } from 'motion/react';
import { encodePreset } from '../preset/codec';
import { GROUPS, applyParam, boundsOf, paramsOf, togglesOf } from './controls';
import { SMOOTH, TAP, TAP_TRANSITION, screenVariants } from '../motion';
import { clearPreviewCache, renderPreview } from '../render/render';
import { useAppStore } from '../store';
import type { Slot } from '../preset/variants';
import { Slider } from './Slider';

const PREVIEW_SIZE = 768;

type PreviewWindow = Window & { __bcPreviewRenders?: number };

export function EditScreen() {
  const skinUrl = useAppStore((s) => s.skinUrl);
  const draft = useAppStore((s) => s.editDraft);
  const updateDraft = useAppStore((s) => s.updateDraft);
  const commitEdit = useAppStore((s) => s.commitEdit);
  const openDownload = useAppStore((s) => s.openDownload);

  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** One preview render in flight at a time; the newest request always wins. */
  const busy = useRef(false);
  const pending = useRef<Slot | null>(null);

  const paint = useCallback(
    async (slot: Slot) => {
      if (!skinUrl) return;
      if (busy.current) {
        pending.current = slot;
        return;
      }
      busy.current = true;
      try {
        const url = await renderPreview(slot, skinUrl, PREVIEW_SIZE);
        setPreview(url);
        setError(null);
      } catch (err) {
        console.error('preview render failed:', err);
        setError(err instanceof Error ? err.message : 'render failed');
      } finally {
        busy.current = false;
        const perf = window as PreviewWindow;
        perf.__bcPreviewRenders = (perf.__bcPreviewRenders ?? 0) + 1;
        const next = pending.current;
        pending.current = null;
        if (next) void paint(next);
      }
    },
    [skinUrl],
  );

  useEffect(() => {
    const perf = window as PreviewWindow;
    perf.__bcPreviewRenders = 0;
  }, []);

  useEffect(() => {
    if (draft) void paint(draft);
  }, [draft, paint]);

  // The cached character is ~16 MB of pixels; drop it when the editor goes away.
  useEffect(() => () => clearPreviewCache(), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') commitEdit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commitEdit]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const code = useMemo(() => (draft ? encodePreset(draft) : ''), [draft]);
  if (!draft) return null;

  const copy = () => {
    navigator.clipboard
      .writeText(code)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  return (
    <m.main
      className="edit"
      variants={screenVariants}
      initial="hidden"
      animate="show"
      exit="out"
    >
      <div className="edit-stage">
        <div className="edit-frame">
          {preview ? (
            <m.img
              className="edit-img"
              src={preview}
              alt={`${draft.preset.label} preview`}
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 1 }}
              transition={SMOOTH}
            />
          ) : (
            <span className="preset-placeholder">Rendering</span>
          )}
        </div>
        {error ? <p className="edit-error">{error}</p> : null}
        <p className="edit-hint">Esc commits and returns to the grid</p>
      </div>

      <div className="edit-panel">
        <div className="edit-scroll" data-testid="edit-scroll">
          {GROUPS.map((group) => (
            <section className="control-card" key={group.id} data-group={group.id}>
              <header className="control-head">
                <h2 className="control-title">{group.title}</h2>
                <span className="control-hint">{group.hint}</span>
              </header>
              {togglesOf(group.id).length > 0 ? (
                <div className="toggle-row">
                  {togglesOf(group.id).map((toggle) => {
                    const on = toggle.get(draft);
                    return (
                      <m.button
                        key={toggle.id}
                        type="button"
                        className={`toggle-chip${on ? ' is-on' : ''}`}
                        data-toggle={toggle.id}
                        aria-pressed={on}
                        whileTap={TAP}
                        transition={TAP_TRANSITION}
                        onClick={() => updateDraft(toggle.set(draft, !on))}
                      >
                        <span className="toggle-pip" />
                        {toggle.label}
                      </m.button>
                    );
                  })}
                </div>
              ) : null}
              {paramsOf(group.id).map((param) => {
                const { min, max } = boundsOf(param, draft);
                return (
                  <Slider
                    key={param.id}
                    paramId={param.id}
                    label={param.label}
                    value={param.get(draft)}
                    min={min}
                    max={max}
                    step={param.step}
                    unit={param.unit}
                    onChange={(value) => updateDraft(applyParam(draft, param, value))}
                  />
                );
              })}
            </section>
          ))}
        </div>

        <footer className="edit-foot">
          <button type="button" className="edit-code" onClick={copy} title={code}>
            <span className="edit-code-label">{copied ? 'copied' : 'code'}</span>
            <span className="edit-code-text">{code}</span>
          </button>
          <div className="edit-actions">
            <m.button
              type="button"
              className="edit-pill"
              onClick={commitEdit}
              whileTap={TAP}
              transition={TAP_TRANSITION}
            >
              Done
            </m.button>
            <m.button
              type="button"
              className="edit-pill edit-pill-primary"
              onClick={openDownload}
              whileTap={TAP}
              transition={TAP_TRANSITION}
            >
              Download
            </m.button>
          </div>
        </footer>
      </div>
    </m.main>
  );
}
