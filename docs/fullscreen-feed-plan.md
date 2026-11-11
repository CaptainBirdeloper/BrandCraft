# Fullscreen Doom-Scroll Feed — Design

Status: design only. No code written yet. Awaiting approval before any file changes.

Two modes, one system:

- **PFP feed** — every cell is a fully randomized profile card, generated forever.
- **Banner feed** — same machinery, cells are banners instead of squares.

Entry: a fullscreen icon beside each section's refresh icon. Esc returns.

---

## 1. Scope

In scope

- Fullscreen overlay with its own scroll container, opened from the preset grid header and from the banner header.
- A wild randomizer: every attribute of a card is random (camera, framing, all six bone axes, backdrop, star, all three lights, ambient, contrast), plus per-element on/off switches at 75% on / 25% off.
- Endless generation while scrolling; first screen must be completely full, with at least 25% of view height of scrollable content below the fold.
- Batched generation triggered by scroll, not by a timer.
- Idle-screen memory stays flat: items above the visible window are retired seamlessly (no scroll jump, no flash).
- Every cell is downloadable, editable, copyable — same three actions the grid cards have.
- Fade-in transitions, smooth at speed.

Out of scope (deliberate)

- Persisting the feed across reloads. Reopening starts a fresh seed.
- Sharing "the whole feed". Individual cards have share codes; the feed sequence does not.
- Server rendering, prefetching images over the network, or any upload. Everything stays in the browser.

---

## 2. Facts that shape the design

From the current code, these are load-bearing:

1. `renderPresets()` / `renderPreset()` in `src/render/render.ts` share **one** WebGL viewer and serialize through a module-level `queue`. Two renders never overlap. The feed must join that queue, not fork a second viewer.
2. `ensurePose(name, bones)` is idempotent **per name** (`src/render/poses.ts:25`), so a randomly generated bone set must be registered under `poseKey(bones)`. Reusing a base pose name would silently render the first bones ever registered for that name.
3. `commitEdit()` writes the draft back into `state.slots` by preset id (`src/store.ts:84`). Feed cards are not in `slots`, so an edit committed from the feed would be dropped unless the store learns about feed items.
4. `openDownload()` downloads `state.slot`; `openBannerDownload(index)` downloads `banners[index]`. Both are index/reference based, so a feed card needs a way in that does not pretend to be one of the eight grid slots.
5. `returnTo` is typed `'editor' | 'edit'` — the download page can already return to two places, so a third (`'feed'`) is a small widening, not a new mechanism.
6. Preset cards render at `CARD_SIZE = 512` (`src/components/Editor.tsx:14`) and banner tiles at 1240 px (`src/components/BannerSection.tsx:11`). Those are the existing quality/perf anchors.
7. `drawLayers` / `drawLayersRect` always draw halftone, glow, star, vignette. Element-level on/off does not exist yet, so the randomizer's element switches require an additive field, not a rewrite.
8. Palette rules already hold: no `#000000` fills, no white on the accent, no green. The wild randomizer must not be the first thing to break them.
9. `randomizeSlots()` deliberately keeps every pose and camera value from the base card (`src/preset/randomize.ts:106`). That is the opposite of what this feature needs, so it cannot be reused as-is.

---

## 3. Decisions

| # | Decision | Rejected alternative | Why |
|---|---|---|---|
| D1 | Feed is a **fixed overlay** that keeps `Editor` mounted underneath | New route that unmounts the editor | Closing the feed would re-render 8 PFP cards + 4 banners (seconds of WebGL work) and lose page scroll. Overlay close is instant. |
| D2 | Feed owns its **own scroll container** (`overflow-y: auto`, `overscroll-behavior: contain`), body scroll locked while open | Window scroll | Local `scrollTop` makes virtualization math exact and keeps the page behind from drifting. |
| D3 | Cards are placed **absolutely, offset from their id**: `top = floor(id / columns) * cell`, `left = (id % columns) * cell` | Flow layout + spacers only | Offsets never depend on which items are mounted, so adding items above or retiring them never moves anything the user is looking at. This is the whole trick behind seamless eviction. |
| D4 | Item content is **deterministic from `(feedSeed, id)`** via mulberry32 | `Math.random()` per item | Scroll up after retirement re-creates the identical image instead of showing a new card in the same slot. Also makes verify probes deterministic. |
| D5 | Generation is **one serial queue, paced to frames**, priority visible → next batch → overscan | Parallel workers / second viewer | There is one GL viewer; parallel captures would corrupt it. Pacing keeps scroll at 60 fps while cards fill in. |
| D6 | Live window is **bounded** (`MAX_LIVE`) and retired items are *dropped*, not hidden | CSS `content-visibility` only | Data URLs are the memory: 60 × ~0.3 MB is fine, 1000 × ~0.3 MB is not. |
| D7 | Element on/off is a new **optional** `elements` field on `Variant`, defaulting to all-on | Separate render path for feeds | Absent field = byte-identical output to today, so the grid, banners, editor and every existing share code are untouched. |
| D8 | Feed floor is `ceil(innerHeight / cell)` full rows **plus one extra row** (≈25% vh of scroll room), floored at 8 cells and capped at 32 per batch | "Fill exactly one screen" | Guarantees the stated 125% coverage without an open-ended first batch. |
| D9 | Escape closes the feed; download opened from the feed returns **to the feed at the same scroll position** | Return to the grid | The user was mid-scroll; kicking them back to the grid loses their place. |
| D10 | Motion: per-card fade+2% scale in, cross-dissolve on re-render. Entrance animation is **skipped** when the card enters during a fast scroll | AnimatePresence on everything | 60 simultaneous spring animations during a flick is a frame-time sink; the fade still lands. |

---

## 4. Data model

```ts
type FeedKind = 'pfp' | 'banner';

interface FeedItem {
  /** Monotonic index in the infinite sequence. Doubles as the seed input. */
  id: number;
  seed: number;            // hash(feedSeed, id)
  kind: FeedKind;
  slot: Slot;              // fully wild slot; id = `feed-<feedSeed>-<id>`
  spec?: BannerSpec;       // banner feed only
  card?: BannerCard;       // banner feed only: left/right slots + bg
  status: 'queued' | 'rendering' | 'ready' | 'error';
  url: string | null;      // PNG data URL, null when retired or pending
  width: number;           // px the URL was rendered at (for placeholders/quality notes)
  error?: string;
  renderedAt?: number;     // performance.now(), for the ms metric
}

interface FeedState {
  open: boolean;
  kind: FeedKind;
  feedSeed: number;
  /** Sparse map: only the live window exists. Retired ids are deleted, not kept empty. */
  items: Map<number, FeedItem>;
  first: number;           // lowest mounted id
  last: number;            // highest mounted id
  scrollTop: number;       // restored on return from download/edit
  columns: number;
  cell: number;            // CSS px, square edge (pfp) or cell width (banner)
}
```

Deliberate: `items` is a **Map keyed by id**, not an array. Retiring item 3 leaves a hole; nothing needs to know its index in an array that no longer means anything.

Store additions (`src/store.ts`):

- `screen` union gains `'feed'`; `returnTo` gains `'feed'`.
- `openFeed(kind)`, `closeFeed()`, `rerollFeed()` (new `feedSeed`, clears items, resets window), `setFeedViewport({columns, cell})`, `setFeedWindow({first, last})`, `setFeedItem(id, patch)`, `setFeedScroll(top)`.
- `commitEdit()` gains a branch: if `editDraft.preset.id` starts with `feed-`, patch that feed item's `slot` (and `customSlot`) instead of the grid slots.
- `openFeedDownload(id)`: sets `slot` = item.slot (pfp) or `downloadOverrides = {spec, card}` (banner), sets `returnTo = 'feed'`, opens download.
- `reroll()` (grid refresh) must **not** touch feed state, and `rerollFeed()` must not touch grid state. The two randomizers stay independent — this also fixes the existing coupling where the grid refresh re-rolls what banners draw from.

---

## 5. The wild randomizer (`src/feed/wild.ts`)

Signature: `wildSlot(rand: () => number, base: Slot, id: string): Slot`.

Every field of every card, with its domain:

| Field | Domain | Notes |
|---|---|---|
| pose bones | per bone slot: head x ±35, y ±60, z ±25; body x ±18, y ±25, z ±18; arms x −170..170, y ±50, z ±60; legs x −70..70, y ±25, z ±25 | registered as `poseKey(bones)`; clamped to stay inside the model |
| theta | 0..360 | full orbit |
| phi | −35..35 | beyond that the camera looks at the model from underneath and the head clips |
| zoom | 20..40 | matches the existing clamp |
| crop x, y | solved so a square of side `w` stays inside the frame | reuses the same rule the crop sliders enforce |
| crop w | 0.30..0.60 | |
| backdrop style | riso 75% / flat 25% | the "elements on/off" rule, applied to the print screen |
| ink2 | on 75% / off 25% | second screen |
| backdrop pitch | 0.013..0.024 | |
| star points | 3..7 | |
| star x, y | snapped to the 8 anchors ±0.04 | keeps the silhouette clear of the bust, same reason as `randomVariant` |
| star size | 0.16..0.34 | |
| star rotation | −30..30 | |
| star on/off | on 75% / off 25% | new element flag |
| glow on/off | on 75% / off 25% | new element flag |
| vignette on/off | on 75% / off 25% | new element flag |
| colours | bg hue free, star hue complementary ±40, sat/light in the existing bands | then palette jail |
| key / fill / rim light | `randomRig(rand)` | already exists, already sane |
| ambient, contrast | `randomRig` ranges | |

Element flags live on the variant as an additive optional field:

```ts
interface Variant {
  // ...existing
  elements?: { star: boolean; glow: boolean; vignette: boolean; halftone: boolean };
}
```

`drawLayers` / `drawLayersRect` consult `variant.elements?.x ?? true` per layer. Absent → today's output, bit for bit.

### 5.1 Palette jail

Runs after generation, rejects and re-rolls:

- backdrop luma < 0.06 (i.e. reads as `#000000`) → lift lightness into the existing band.
- hue inside 90..160 (green) → rotate 90.
- star colour too close to the backdrop (ΔL < 0.18) → push lightness away.
- no pure white (`#ffffff`/luma > 0.96) — the accent stays Signal Yellow's job.

### 5.2 Randomizer parity audit

The requirement is "every single attribute". The plan proves it with a table, not a vibe: for each of the 46 entries in `PARAMS` (`src/edit/controls.ts:496`), the wild randomizer must move the value by more than one step from the base card. Group counts:

- camera: theta, phi, zoom (3)
- framing: crop x, y, w, h (4)
- pose: 6 bones × 3 axes (18)
- backdrop: pitch, ink2 + halftone flag (3)
- star: points, x, y, size, rotation, colour (6)
- light: 3 sources × (position, intensity) + ambient + contrast (12)

3 + 4 + 18 + 3 + 6 + 12 = 46. The verify state `feed-random` asserts, over 40 consecutive items: ≥ 30 distinct poses, ≥ 35 distinct backdrop/orientation pairs, every PARAM observed off its base value at least once, element flags in 60–90% on, zero palette-jail violations.

---

## 6. Layout and scroll math

Given viewport `W × H` (the overlay's client box, CSS px) and a target cell edge `C`:

```
C        = clamp(160, floor((W - 2*pad - (cols-1)*gap) / cols), 420)
cols     = W >= 1600 ? 5 : W >= 1100 ? 4 : W >= 700 ? 3 : 2
rows     = max(2, ceil(H / C))
floor    = cols * rows                      // one full screen
batch    = clamp(8, cols * (rows + 1), 32)  // +1 row ≈ 25% vh of scroll room
```

- `cell = C + gap` is the pitch used for absolute offsets.
- Coverage invariant: `floor * C >= H` and `(floor + cols) * C >= 1.25 * H`.
- Banner feed: `C_banner = clamp(280, ...)` per column with `cols = W >= 1400 ? 2 : 1`, cell height = `C_banner * 423/1546` (strip aspect) + gap. Same formulas, different ratio, same floor rules (floor at 4 banner cells).
- On `resize` / orientation change / zoom: recompute `cols`, `C`; keep ids and `items`; re-lay out. Scroll position is preserved proportionally (`scrollTop *= newTotal/oldTotal`) so the user stays at roughly the same sequence point. One frame of reflow is accepted and documented.

---

## 7. Virtualizer and seamless eviction

Invariants (the whole correctness story):

1. Every mounted item is positioned from its id: `top = floor(id/cols) * cellH`, `left = (id % cols) * cellW`.
2. Container height = `(last + 1) * cellH` **plus** a bottom sentinel row, so there is always ≥ 25% vh of scrollable space beneath the last mounted row.
3. A top spacer of height `first * cellH` stands in for the retired ids. Because items below are positioned by id, changing `first` does **not** move them.
4. Scroll correction is never needed: nothing above the viewport changes size, only the spacer does. This is the difference between "seamless" and "jumpy".

Window rule, run on `scroll` inside a `requestAnimationFrame`:

```
visibleFirst = floor(scrollTop / cellH) * cols
visibleLast  = floor((scrollTop + H) / cellH) * cols + cols - 1
keep         = [visibleFirst - cols, visibleLast + cols]   // ±1 row of slack
```

- Extend: when `scrollTop + H + 0.5*H >= (last + 1) * cellH`, enqueue the next batch of `batch` ids (`last + 1 … last + batch`), grow `last`, grow container height.
- Retire: any id outside `keep` is deleted from `items` (URL reference dropped) and excluded from render. `first` advances to the lowest kept id. Because `keep` is one row wider than the viewport on both sides, retirement only ever happens off-screen.
- Hard cap: if `live > MAX_LIVE` (pfp 60, banner 24), retire from the far side until under cap, never touching `keep`.
- `MAX_LIVE` also bounds the render queue: queued ids that are no longer inside `keep` are cancelled (dropped before rendering, saving the capture entirely).

Scrolling back up: ids above `first` are re-enqueued and re-rendered from their deterministic seed. Identical images, no visual surprise, and the placeholder only shows for the ~1 frame batch it was queued for.

---

## 8. Render scheduler (`src/feed/useFeed.ts`)

- Single serial loop, one item per turn, awaiting `renderPreset(slot, skin, px)` (which already serializes internally).
- Priority: visible-not-ready → next batch → overscan slack. Recomputed each turn (the user might have scrolled).
- Turn pacing: after a render resolves, wait for the next animation frame before starting the next one. Prevents a batch from blocking paint and gives the scroll handler a slot every frame.
- Render size per cell: `px = clamp(320, round(cell * min(devicePixelRatio, 2)), 768)` — pfp. Banner: `clamp(640, round(cell * min(dpr,2)), 1280)`.
- Abort work that no longer matters: before starting a turn, re-check the id is still in `keep`; if not, skip (no capture at all).
- Visibility: `document.visibilityState !== 'visible'` → pause the loop; on resume, drop the prefetch half and render only the visible window, so a 5-minute background tab does not produce a 40-card burst.
- Failure: an item that throws gets `status:'error'` and a short message in the placeholder (same pattern as `PresetCard`'s error span). Two consecutive failures → stop the loop and toast "rendering stopped — reload". Prevents 40 broken cards from a dead GL context.
- Instrumentation: `window.__bcFeed = { seed, kind, first, last, live, rendered, failed, ms }` updated per turn, read by verify.

Expected cost per cell: same order as today's grid cards (512 px capture + PNG encode). Target ≤ 40 ms; a 20-cell batch then fills in ~0.8 s while scrolling, with skeletons visible immediately.

---

## 9. Motion

- Overlay: fade + 1.5% scale, `FAST`-class spring in, faster exit. The page behind stays put (no shared-element morph — it would cost a second render of the card).
- Cell: skeleton → image cross-dissolve, exactly the `AnimatePresence` keyed-by-src pattern `PresetCard` already uses.
- Cells that enter while `|scrollVelocity| > 1200 px/s` get an opacity-only CSS transition (no spring, no scale). Ordinary scroll keeps the spring.
- `prefers-reduced-motion`: opacity only, everywhere, and no shimmer animation on skeletons (static placeholder text).
- No per-cell `layout` animation anywhere — layout animation on 60 absolutely positioned siblings is exactly the frame sink to avoid.

---

## 10. Per-cell actions

Each cell carries the same three circles as a grid card: copy code, edit, download — plus the whole cell is a button that opens the download page (same as the banner tiles, and as the grid's select+download flow).

- **Copy** — `encodePreset(item.slot)` → clipboard → toast. Share code must round-trip the element flags, else the copy button lies about the card: `bgl:` gains an optional 5th slot, a 4-bit mask (`halftone|star|glow|vignette`). Absent = all on (old codes unchanged; old builds reading a new code just draw everything).
- **Edit** — `openEdit(item.slot)`. On commit, the store patches the feed item (see §4) and the tile re-renders from the edited slot. The editor screen already works on a draft, so nothing else changes.
- **Download** — `openFeedDownload(item.id)`; `returnTo:'feed'`, `screen:'download'`. Closing the download page restores the feed **and its `scrollTop`**. The export itself re-renders from `slot` at the chosen size (1K/2K/4K), so the cell's preview URL is irrelevant — a retired card still downloads correctly.
- Touch devices (`@media (hover: none)`): actions are always visible, not hover-revealed.

---

## 11. Banner feed

Same virtualizer, same scheduler, different producer:

```ts
wildBanner(rand, baseSpecs, id): { slotLeft, slotRight, spec, card }
```

- Two independent wild slots per banner (`left`, `right`), with `pairOffset` random 2..6 deciding which grid base each one grew from — the pairing stays meaningful, the looks do not.
- `BannerSpec` randomized: `fontId` (5), `rig` family (3), `textScale` (3 of `TEXT_SCALES`), `pairOffset` (5). `text` stays the user's wordmark — randomizing the words would produce garbage text, not random design.
- Cell renders `renderBannerPreview(spec, card, skinUrl, px)`. `ensureBannerFonts()` must be awaited once before the first banner cell (already done by the banner section path).
- Click → download page with both banner sizes, resolved from `downloadOverrides` instead of `banners[index]`.
- Aspect: strip (1546×423) in the feed — the frame crop is chosen on the download page. Two columns on wide screens, one on narrow.

---

## 12. Keyboard, focus, history, a11y

- Trigger buttons: `aria-label="Open fullscreen preset feed"` / `"Open fullscreen banner feed"`, placed immediately after each section's `.refresh` in its `.stage-head`.
- Esc: closes the feed; if the download page or editor is on top of the feed, Esc walks back one step (download → feed → grid), never two at once.
- The overlay sets `inert` on the app behind it, so Tab cannot reach the grid; focus moves to the first cell; focus returns to the trigger button on close.
- Browser Back while the feed is open closes the feed (one `pushState` on open, popped on close; re-opening replaces rather than stacks, so double-clicking the icon cannot leave a history maze).
- Body scroll locked (`overflow: hidden` on `documentElement`), restored on close — including the case where the feed is closed by the download page's back button.
- `role="region" aria-label="Preset feed"`, `aria-live="off"`. No `aria-setsize` — the count is unbounded and lying about it is worse than omitting it.

---

## 13. Edge case register

Behaviour is specified for each; nothing here is left to "it'll be fine".

| Case | Behaviour |
|---|---|
| No skin loaded | Feed buttons are not rendered (same rule as `BannerSection`, which returns null without a skin). |
| Feed opened twice quickly | `openFeed` is idempotent while `open` — second call is a no-op, no second history entry, no second seed. |
| Viewport smaller than one cell (narrow phone) | `cols` floors at 2, `C` floors at 160; `rows` floors at 2 → minimum batch 4. Cells overflow horizontally by design (smaller crop of the same square). |
| Very large viewport (4K / 8K) | `C` caps at 420, batch caps at 32; the floor invariant is still met because `cols*rows*C >= H` for any H up to ~13k px. If it were not, the loop keeps adding batches of 8 until it is. |
| Resize / rotate / browser zoom mid-scroll | Recompute `cols`/`C`, keep `items`, re-lay out by id, scale `scrollTop` proportionally. One reflow frame. Live cards keep their URLs (no re-render) but may look soft if the cell grew — accepted and documented. |
| DPR change (window dragged to another monitor) | No re-render; same acceptance as above. The next cards rendered use the new DPR. |
| Tab hidden during a batch | Loop pauses; on return, prefetch is dropped and only the visible window is queued. No catch-up burst. |
| Flick-scroll past many batches | The window jumps forward whole batches; skipped ids are never created at all (`id`s exist only when queued), so a 20-batch flick costs the same as one batch. |
| Scroll back up over retired ids | Re-created deterministically from seed → same images; skeletons for one batch turn. |
| Momentum scroll while retirement runs | Retirement only happens in the rAF tail, never inside a render commit; it is O(retired) and does not touch mounted items' offsets. |
| Item render throws | Cell shows the error text; queue continues. Two consecutive failures stop the loop + toast. |
| WebGL context lost | Same as above: one toast, loop halted, feed stays scrollable with placeholders rather than spamming 40 errors. |
| Download from a retired card | Export path re-renders from `slot`, not from the preview URL — still correct. |
| Edit a card that gets retired while the editor is open | `editDraft` holds the full slot object; on commit the item is re-created in `items` if absent. No data loss. |
| Same card edited twice | Ids are stable, so the second commit patches the same item. |
| Copy on an insecure context / denied permission | Clipboard rejection surfaces as an error toast; the code is also selectable in the DOM fallback if present, otherwise the toast is the answer. |
| `?r=` seed pinning | `feedSeed` initialises from `seedFromSearch` so probes and screenshots are repeatable; the feed's own refresh button bumps it. |
| Grid refresh while feed is open | Independent: `reroll()` leaves feed state alone; the feed's refresh re-rolls only the feed. (Also removes today's coupling where the grid refresh changes what banners draw.) |
| Banner feed before fonts resolve | First cell awaits `ensureBannerFonts()`; skeletons hold until it resolves (same as the banner section). |
| Banner cell on a narrow screen | One column, full width; the strip keeps its aspect so nothing is squashed. |
| Reduce-motion users | Fades only, static skeletons. |
| Keyboard-only user | Esc to leave, Tab through cells, Enter opens the download page, per-cell actions are buttons in DOM order. |
| Screen reader | Region label, no fake counts, placeholders announce "Rendering" then the image alt is empty (decorative: the card has no textual content). |
| Print / screenshot probes | `feed`, `feed-scroll`, `feed-banner` states exist and are deterministic under `?r=`. |
| Memory ceiling | Live URLs bounded by `MAX_LIVE`; retired URLs are dereferenced (GC), no `revokeObjectURL` needed for data URLs. Expected ≈ 25 MB at cap. |
| Long session (hours) | `id` grows without bound in a `number`; at 60 flicks/minute that is 3.6k ids/hour — safe for decades of `Number.MAX_SAFE_INTEGER`. The `items` Map stays at cap size. |
| Back button after many opens | History holds at most one feed entry; close pops it. |
| Two feeds (pfp + banner) opened in sequence | Each open re-seeds and clears the other's items; only one feed can be open. |

---

## 14. Explicitly impossible / not attempted

- Truly infinite memory. The window is bounded; "forever" means unbounded *ids*, bounded *pixels*.
- Zero-latency images at any scroll speed. Captures are async, serialized, and cost tens of ms; skeletons are the honest answer.
- Full export-resolution (4K) previews in the feed. Cells cap at 768 px.
- Rendering a card per scroll pixel. Scroll only moves the window and enqueues batches.
- Perfect visual continuity across a resize. One reflow frame is accepted.
- Guaranteeing 60 fps on an unknown GPU while a 4K export is also running. The queue serializes; the feed yields.

---

## 15. File plan and phases

New files

- `src/feed/wild.ts` — `wildSlot`, `wildBanner`, `paletteJail`, `elementFlags`.
- `src/feed/virtual.ts` — pure math: `metrics(viewport)`, `windowFor(scrollTop, metrics)`, `offsetOf(id, metrics)`, `idsToEnqueue(...)`. No DOM, so it can be unit-tested.
- `src/feed/useFeed.ts` — viewport observer, scroll rAF, queue loop, retirement, instrumentation.
- `src/components/Feed.tsx`, `src/components/FeedCard.tsx`, `src/components/BannerFeedCard.tsx`.
- `src/styles/feed.css`.

Touched files (small, surgical)

- `src/store.ts` — feed slice, `screen`/`returnTo` widening, feed branch in `commitEdit`, `openFeedDownload`, `downloadOverrides`.
- `src/preset/variants.ts` — additive `elements?` and the three `?? true` checks in `drawLayers`/`drawLayersRect`.
- `src/preset/codec.ts` — optional 5th `bgl:` slot (element mask), tolerant decode.
- `src/components/icons.tsx` — `FullscreenIcon`.
- `src/components/Editor.tsx`, `src/components/BannerSection.tsx` — one button each in the section head.
- `src/components/DownloadScreen.tsx` — resolve banner from `downloadOverrides` when present.
- `verify.states.json` — new states (below).

Phases, each shippable and independently verifiable

- **P1 — Shell + virtualizer.** Overlay, scroll container, id-anchored placement, floor invariant, batch generation with the *existing* `randomizeSlots` (no wild randomizer yet), retirement, Esc. Acceptance: `feed-grid` coverage numbers, `feed-scroll` shows new ids and top ids gone with `scrollTop` unchanged, live count stays ≤ cap after 50 flicks.
- **P2 — Wild randomizer.** `wild.ts`, element flags, palette jail, parity audit. Acceptance: `feed-random` numbers.
- **P3 — Actions.** Copy (with element mask), edit round-trip, download round-trip + `returnTo:'feed'`. Acceptance: `feed-edit`, `feed-download`.
- **P4 — Banner feed.** `wildBanner`, banner cells, banner download override. Acceptance: `feed-banner`.
- **P5 — Motion + polish.** Velocity-aware entrance, reduce-motion, touch actions, focus/history. Acceptance: manual + one `shot`.
- **P6 — Docs.** `summary.txt` lines for the new modules; the feed's own paragraph.

---

## 16. Verification plan

Deterministic via `?r=`, one probe per item, pass exits 0 with metrics in `document.title` (project convention after the verify hardening).

| State | Asserts |
|---|---|
| `feed-open` | Icon exists beside both refresh buttons; clicking opens the overlay; `Editor` still mounted behind; body scroll locked. |
| `feed-grid` | `cells * cellH >= innerHeight`; scrollHeight `>= 1.25 * innerHeight`; no card overlaps (offsets match `id` math); placeholders ≤ cells. |
| `feed-scroll` | Programmatic scroll of 3 viewports: `first` advanced, `last` grew, retired ids absent from `items`, `scrollTop` unchanged ±1 px across retirement, live ≤ cap. |
| `feed-random` | 40 consecutive items: ≥30 distinct pose keys, 46 PARAMS all observed off-base, element flags 60–90% on, zero palette violations, zero `#000000`. |
| `feed-edit` | Edit a cell, move a slider, commit → the same cell re-renders changed and the change persists after scrolling away and back (determinism check inverted for edited items — edited slots are stored, not regenerated). |
| `feed-download` | Download from a cell → download page shows that card → close returns to the feed at the same `scrollTop`. |
| `feed-banner` | Banner feed floor invariant, two-slots-per-banner, wordmark present, close returns. |
| `feed-esc` | Esc closes; focus returns to the trigger; body scroll restored. |

Build gate: `tsc --noEmit` + `vite build` once per phase.

---

## 17. Metrics and instrumentation

`window.__bcFeed` per turn: `{seed, kind, first, last, live, rendered, skipped, failed, msLast, msAvg}`. Probes read it instead of inferring from the DOM.

Budgets to hold: per-cell capture ≤ 40 ms, batch of 20 ≤ 1 s, live ≤ 60 (pfp) / 24 (banner), scroll handler ≤ 1 ms, JPEG/PNG data URL ≤ 450 KB per cell.

---

## 18. Risks

- **Single GL viewer.** A feed render competes with anything else that renders. Acceptable because the overlay covers the page; documented so nobody adds a second viewer later.
- **Data URL memory on iOS Safari.** Safari can be aggressive with canvas/image memory. Mitigation if it bites: render cells through `canvas.toBlob` + `URL.createObjectURL` and revoke on retire (a scheduler-local change, no design change).
- **60 sibling components each with motion state.** Mitigated by CSS-only transitions above the velocity threshold; if profiling still shows cost, drop cell entrance animation entirely (it is decoration).
- **Deterministic re-creation requires the seed path to stay pure.** Any `Math.random()` leaking into `wild.ts` breaks scroll-back consistency — the parity probe catches it by comparing a re-created id's seed to the original.

---

## 19. Out-of-scope observations

- Today `reroll()` (grid refresh) also changes what the banners draw from, because banners index into `slots`. The feed design keeps its own state, which sidesteps it; decoupling the grid from banners is a separate, unrequested change.
- `src/preset/slots.txt` header has mojibake (`â€”`) from an earlier non-ASCII write. Unrelated, untouched.
