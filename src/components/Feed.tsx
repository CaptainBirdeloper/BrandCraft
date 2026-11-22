import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { STRIP_ASPECT } from '../banner/layout';
import {
  contentHeight,
  layoutFor,
  renderWidth,
  windowFor,
  type Metrics,
} from '../feed/metrics';
import { prng, seedAt, wildBanner, wildSlot } from '../feed/wild';
import { FeedCell } from '../feed/FeedCell';
import type { FeedItem, FeedKind } from '../feed/types';
import { clampBannerText } from '../preset/banner';
import { renderBannerPreview } from '../render/banner';
import { renderPreset } from '../render/render';
import { generateCardRecipe, renderCardRecipe } from '../card/procedural';
import { useAppStore } from '../store';
import { RefreshIcon } from './icons';

/**
 * The fullscreen feed. Cards are placed from their id, not from their slot in a
 * mounted list, so retiring the top of the scroll never moves anything below it.
 * One render loop feeds the queue: visible cards first, then the ones off screen,
 * one at a time through the shared WebGL queue that already serialises every
 * other render in the app.
 */

interface FeedProps {
  kind: FeedKind;
  /** Mounted but covered by another page: keep the cards, stop the loop. */
  hidden: boolean;
}

const IDLE_MS = 90;
const MAX_FAILURES = 3;
const FALLBACK: Metrics = layoutFor(1200, 800, 1);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function revokeBlob(url: string | null | undefined): void {
  if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function Feed({ kind, hidden }: FeedProps) {
  const skinUrl = useAppStore((s) => s.skinUrl);
  const lastCommit = useAppStore((s) => s.lastCommit);
  const closeFeed = useAppStore((s) => s.closeFeed);
  const openEdit = useAppStore((s) => s.openEdit);
  const openFeedDownload = useAppStore((s) => s.openFeedDownload);
  const openFeedBannerDownload = useAppStore((s) => s.openFeedBannerDownload);
  const showToast = useAppStore((s) => s.showToast);
  const banners = useAppStore((s) => s.banners);
  const setBanner = useAppStore((s) => s.setBanner);
  const cardUsername = useAppStore((s) => s.cardUsername);
  const cardQuote = useAppStore((s) => s.cardQuote);
  const cardTextColor = useAppStore((s) => s.cardTextColor);
  const setCardSpec = useAppStore((s) => s.setCardSpec);

  const initialWordmark = banners[0]?.text ?? 'Subscribe';
  const [wordmark, setWordmark] = useState(initialWordmark);
  const wordmarkRef = useRef(wordmark);
  wordmarkRef.current = wordmark;

  const [seed, setSeed] = useState(() => (Math.random() * 4294967296) >>> 0);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [version, bump] = useReducer((n: number) => n + 1, 0);

  const scroller = useRef<HTMLDivElement | null>(null);
  const items = useRef(new Map<number, FeedItem>());
  const keep = useRef({ from: 0, to: -1 });
  /** Highest id created so far; the content height follows it, so scrolling never hits a wall. */
  const tail = useRef(-1);
  const frame = useRef(0);

  const aspect = kind === 'banner' ? STRIP_ASPECT : kind === 'card' ? 3 / 4 : 1;
  const metrics = useMemo<Metrics | null>(
    () => (box.width > 0 && box.height > 0 ? layoutFor(box.width, box.height, aspect) : null),
    [box.width, box.height, aspect],
  );
  const metricsRef = useRef<Metrics | null>(metrics);
  metricsRef.current = metrics;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const skinRef = useRef(skinUrl);
  skinRef.current = skinUrl;

  const didMountWordmark = useRef(false);
  // Debounced in-place invalidation for banner text modification
  useEffect(() => {
    if (!didMountWordmark.current) {
      didMountWordmark.current = true;
      return;
    }
    if (kind !== 'banner') return;
    const timer = window.setTimeout(() => {
      // 1. Sync store
      const count = useAppStore.getState().banners.length;
      for (let i = 0; i < count; i++) {
        setBanner(i, { text: wordmark });
      }

      // 2. Invalidate existing banner items in place (preserve layout, poses, and scroll)
      let touched = false;
      items.current.forEach((item) => {
        if (item.spec) {
          item.spec.text = wordmark;
          if (item.url) {
            revokeBlob(item.url);
            item.url = null;
          }
          item.status = 'queued';
          touched = true;
        }
      });
      if (touched) bump();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [wordmark, kind, setBanner]);

  // Invalidate card items in place when username, quote, or textColor changes
  useEffect(() => {
    if (kind !== 'card') return;
    const store = useAppStore.getState();
    const uname = store.cardUsername || store.skinName || 'BUILDER';
    const q = store.cardQuote || 'built with stone and fire';
    const col = store.cardTextColor || '#FFFF00';

    let touched = false;
    items.current.forEach((item) => {
      if (item.cardRecipe) {
        item.cardRecipe.spec.username = uname;
        item.cardRecipe.spec.quote = q;
        item.cardRecipe.spec.textColor = col;
        item.cardRecipe.palette.text = col;
        item.cardRecipe.palette.accent = col;
        if (item.url) {
          revokeBlob(item.url);
          item.url = null;
        }
        item.status = 'queued';
        touched = true;
      }
    });
    if (touched) bump();
  }, [cardUsername, cardQuote, cardTextColor, kind]);

  const handleWordmarkChange = (val: string) => {
    const sanitized = clampBannerText(val);
    setWordmark(sanitized);
  };

  const make = useCallback(
    (id: number): FeedItem => {
      const rand = prng(seedAt(seed, id));
      const cardId = `feed-${seed}-${id}`;
      if (kind === 'banner') {
        const wild = wildBanner(rand, cardId, id, wordmarkRef.current);
        return { id, status: 'queued', slot: wild.slot, url: null, spec: wild.spec, card: wild.card };
      }
      if (kind === 'card') {
        const slot = wildSlot(rand, cardId, `Card ${id + 1}`);
        const cardSeed = seedAt(seed, id);
        const store = useAppStore.getState();
        const recipe = generateCardRecipe(cardSeed, {
          username: store.cardUsername || store.skinName || 'BUILDER',
          quote: store.cardQuote || 'built with stone and fire',
          textColor: store.cardTextColor || '#FFFF00',
          seed: cardSeed,
        });
        return { id, status: 'queued', slot, url: null, cardRecipe: recipe };
      }
      return { id, status: 'queued', slot: wildSlot(rand, cardId, `Wild ${id + 1}`), url: null };
    },
    [kind, seed],
  );

  const ensure = useCallback(
    (from: number, to: number) => {
      for (let id = Math.max(0, from); id <= to; id += 1) {
        if (!items.current.has(id)) items.current.set(id, make(id));
      }
    },
    [make],
  );

  /** Re-window the mounted set around the current scroll offset. */
  const sync = useCallback(() => {
    const el = scroller.current;
    const m = metricsRef.current;
    if (!el || !m || m.batch <= 0) return;
    if (tail.current < 0) tail.current = m.batch - 1;
    const height = el.clientHeight;
    const top = el.scrollTop;
    const next = windowFor(top, height, m);
    const grew = next.to > keep.current.to || next.from < keep.current.from;
    keep.current = next;
    if (top + height * 1.25 >= contentHeight(tail.current, m)) {
      tail.current += m.batch;
    }
    const before = items.current.size;
    ensure(next.from, next.to);
    // Retire everything off the window. Positions come from the id, so this never
    // shifts the cards the user is looking at.
    for (const id of items.current.keys()) {
      if (id < next.from || id > next.to) {
        const item = items.current.get(id);
        if (item?.url) revokeBlob(item.url);
        items.current.delete(id);
      }
    }
    if (grew || items.current.size !== before) bump();
  }, [ensure, bump]);

  const onScroll = useCallback(() => {
    if (frame.current) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0;
      sync();
    });
  }, [sync]);

  useEffect(() => {
    return () => {
      if (frame.current) {
        window.cancelAnimationFrame(frame.current);
      }
      items.current.forEach((item) => {
        if (item.url) revokeBlob(item.url);
      });
      items.current.clear();
    };
  }, []);

  /** Visible cards first, then whatever else is queued. */
  const pick = useCallback((): number | null => {
    const { from, to } = keep.current;
    for (let id = from; id <= to; id += 1) {
      const item = items.current.get(id);
      if (item && item.status === 'queued') return id;
    }
    for (const [id, item] of items.current) {
      if (item.status === 'queued') return id;
    }
    return null;
  }, []);

  // Measure the scroller; a rotate or a window drag re-lays out the grid.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      setBox({ width: el.clientWidth, height: el.clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  // A new viewport means a new window, and possibly a new column count.
  useEffect(() => {
    if (!metrics) return;
    sync();
  }, [metrics, sync]);

  // A re-roll throws the live set away and starts from id 0 again.
  useEffect(() => {
    items.current.forEach((item) => {
      if (item.url) revokeBlob(item.url);
    });
    items.current.clear();
    keep.current = { from: 0, to: -1 };
    tail.current = -1;
    if (metricsRef.current) sync();
  }, [seed, sync]);

  // An edit committed from the feed comes back here: refresh that one cell in place.
  useEffect(() => {
    if (!lastCommit) return;
    const target = lastCommit.preset.id;
    let touched = false;
    for (const item of items.current.values()) {
      if (item.slot.preset.id !== target && item.slot.preset.id !== `${target}-l`) continue;
      item.slot = lastCommit;
      if (item.card) item.card = { ...item.card, left: lastCommit };
      if (item.url) revokeBlob(item.url);
      item.url = null;
      item.status = 'queued';
      touched = true;
    }
    if (touched) bump();
  }, [lastCommit, bump]);

  // One render loop for the whole feed: paced per frame, serialised by render.ts.
  useEffect(() => {
    let live = true;
    let failures = 0;
    const run = async () => {
      while (live) {
        const skin = skinRef.current;
        if (hiddenRef.current || !skin) {
          await sleep(IDLE_MS);
          continue;
        }
        const id = pick();
        if (id === null) {
          await sleep(IDLE_MS);
          continue;
        }
        const item = items.current.get(id);
        if (!item) continue;
        item.status = 'rendering';
        bump();
        try {
          const m = metricsRef.current ?? FALLBACK;
          let url: string;
          if (kind === 'card' && item.cardRecipe) {
            const bustUrl = await renderPreset(item.slot, skin, 512);
            try {
              const bustImg = await loadImage(bustUrl);
              const canvas = renderCardRecipe(item.cardRecipe, bustImg, undefined, 720, 960);
              const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
              canvas.width = 0;
              canvas.height = 0;
              if (!blob) throw new Error('Blob creation failed');
              url = URL.createObjectURL(blob);
            } finally {
              if (bustUrl.startsWith('blob:')) URL.revokeObjectURL(bustUrl);
            }
          } else if (item.spec && item.card) {
            url = await renderBannerPreview(
              item.spec,
              item.card,
              skin,
              Math.min(renderWidth(m, STRIP_ASPECT), 1240),
            );
          } else {
            url = await renderPreset(item.slot, skin, renderWidth(m, 1));
          }
          if (items.current.get(id) === item && item.status === 'rendering') {
            item.url = url;
            item.status = 'ready';
            failures = 0;
          } else {
            // Card was retired, re-rolled, or invalidated while in-flight
            revokeBlob(url);
          }
        } catch (error) {
          failures += 1;
          if (items.current.get(id) === item) item.status = 'error';
          if (failures >= MAX_FAILURES) {
            console.error('feed render failed:', messageOf(error));
            showToast('Feed stopped: renderer error');
            live = false;
          }
        }
        bump();
        await nextFrame();
      }
    };
    void run();
    return () => {
      live = false;
    };
  }, [bump, pick, showToast]);

  // Esc leaves. The edit and download pages close themselves.
  useEffect(() => {
    if (hidden) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeFeed();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [hidden, closeFeed]);

  // The feed scrolls itself; the page behind it must not.
  useEffect(() => {
    if (hidden) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [hidden]);

  const cells = useMemo(() => {
    const m = metrics;
    if (!m) return [];
    const list: FeedItem[] = [];
    for (const item of items.current.values()) list.push(item);
    list.sort((a, b) => a.id - b.id);
    return list.map((item) => (
      <FeedCell
        key={item.id}
        item={item}
        metrics={m}
        kind={kind}
        onEdit={openEdit}
        onDownload={openFeedDownload}
        onBannerDownload={openFeedBannerDownload}
      />
    ));
    // `version` stands in for the mutable item map.
  }, [version, metrics, kind, openEdit, openFeedDownload, openFeedBannerDownload]);

  const liveCount = items.current.size;
  const height = metrics ? contentHeight(tail.current < 0 ? 0 : tail.current, metrics) : 0;

  // Probe for the verify harness; harmless in production.
  useEffect(() => {
    let ready = 0;
    for (const item of items.current.values()) if (item.status === 'ready') ready += 1;
    (window as Window & { __bcFeed?: unknown }).__bcFeed = {
      kind,
      seed,
      live: liveCount,
      ready,
      height: Math.round(height),
      scrollTop: Math.round(scroller.current?.scrollTop ?? 0),
      viewport: Math.round(scroller.current?.clientHeight ?? 0),
    };
  });

  const reroll = () => {
    setSeed((Math.random() * 4294967296) >>> 0);
    const el = scroller.current;
    if (el) el.scrollTop = 0;
  };

  return (
    <div
      className="feed"
      hidden={hidden}
      role="region"
      aria-label={kind === 'banner' ? 'Fullscreen banner feed' : kind === 'card' ? 'Fullscreen card feed' : 'Fullscreen preset feed'}
    >
      <div className="feed-bar">
        <span className="feed-meta">
          {kind === 'banner' ? 'Banners' : kind === 'card' ? 'Cards' : 'Presets'} · endless · {liveCount} live · seed{' '}
          {seed.toString(36)}
        </span>
        {kind === 'banner' ? (
          <div className="feed-wordmark-pill">
            <input
              type="text"
              className="feed-wordmark-input"
              value={wordmark}
              maxLength={16}
              placeholder="Wordmark"
              aria-label="Customize banner wordmark"
              onChange={(e) => handleWordmarkChange(e.target.value)}
            />
          </div>
        ) : kind === 'card' ? (
          <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
            <div className="wordmark-pill">
              <input
                type="text"
                className="wordmark-input"
                value={cardUsername || skinUrl ? (cardUsername || useAppStore.getState().skinName || '') : ''}
                placeholder="Username"
                aria-label="Customize card username"
                onChange={(e) => setCardSpec({ username: e.target.value })}
              />
            </div>
            <div className="wordmark-pill">
              <input
                type="text"
                className="wordmark-input"
                value={cardQuote}
                placeholder="Quote"
                aria-label="Customize card quote"
                onChange={(e) => setCardSpec({ quote: e.target.value })}
              />
            </div>
            <div className="wordmark-pill color-pill" title="Text color">
              <input
                type="color"
                className="card-color-input"
                value={cardTextColor}
                aria-label="Customize card text color"
                onChange={(e) => setCardSpec({ textColor: e.target.value })}
              />
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="refresh"
          aria-label="Re-roll the feed"
          title="Throw the whole feed away and roll again"
          onClick={reroll}
        >
          <RefreshIcon />
        </button>
        <button
          type="button"
          className="feed-exit"
          aria-label="Close fullscreen"
          title="Close (Esc)"
          onClick={closeFeed}
        >
          Esc
        </button>
      </div>
      <div className="feed-scroller" ref={scroller} onScroll={onScroll}>
        <div className="feed-canvas" style={{ height }}>
          {cells}
        </div>
      </div>
    </div>
  );
}
