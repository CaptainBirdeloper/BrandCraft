# Banner

A YouTube channel banner has to survive two very different crops, so the geometry is
fixed once and everything else is measured off it.

- Frame: 2560×1440 (16:9), the upload's own canvas
- Strip: 1546×423 (3.655:1), the part every device shows, centred in the frame
- Outside the strip: exactly one flat colour, nothing else, so the desktop and
  phone crops both read as deliberate

## Composition

Paint order is `bg → left → right → text`, clipped to the strip.

- `bg` is one `fillRect` of the preset backdrop colour over the whole frame
- Figures are alpha-trimmed bust renders, drawn at full strip height and pinned to
  their own strip edge. The box width is the bust's own aspect — no fixed 470 px
  box, no padding — so the outer contour sits exactly on the edge: extreme in the
  strip, and uncut, because the image bound *is* the silhouette bound. The bust is
  cropped from the render's full width (the preset crop only supplies the vertical
  band), otherwise the slice would be baked into the image before layout sees it
- The wordmark box is symmetric about the strip centre, sized to the tighter of the
  two clearances minus a 16 px gutter (444×245 on a typical pair, 17.3 % of the
  frame width). It is derived from the figure widths, so the type can never crowd a
  pose at any output width, and unequal bust widths cannot push it off centre.
  If a pair is wide enough to squeeze the box under 16 % of the strip, both figures
  scale down together — crop nothing, keep the outer edges flush.
  `drawBannerText` picks the largest size that fits width and cap height, then
  centres the glyph run. The spec's `textScale` shrinks the box around its own
  centre, which is the size dial

## Cards

Four banners, each with its own `BannerSpec`: text, typeface, lighting family,
text scale and pair offset. `bannerCards(slots, specs)` makes one card per spec;
card `k` is slot `k` on the left and slot `(k + pairOffset) % 8` on the right.

Each card owns its randomizer. `rerollBanner(index)` steps only that card's spec
(5 typefaces × 3 families × 3 scales × 5 offsets = 225 looks, always different),
and because the other specs keep their object identity the other three cards do
not even re-render.

`renderBannerPreview` composes one preview with `crop: 'strip'`: the canvas is the
1546×423 strip at the requested width, which is exactly what a phone shows. Cards
therefore never letterbox or crop the figures. The download screen composes
`crop: 'frame'` instead, the full 2560×1440 upload.

## Type

`BANNER_FONTS` holds five faces: `caps` (serif, uppercase, the default), `roman`,
`italic`, `inter` and `advercase`. Advercase is the designer's demo OTF
(Indieground Design Inc.), bundled for personal use only. `ensureBannerFonts`
preloads every face before the first measure, because a fallback face would change
the fitted size.

## Lighting

`bannerRig(family, slot, side)` rebuilds the slot's own profile rig — same hue,
same pose — with the key pushed outward and ambient traded for rim. Families are
`flat`, `editorial` and `rim`; side 1 mirrors the rig so both figures are lit from
the outside edge. The rig is reset per capture, because one viewer serves the
whole batch.

## Capture

`renderBannerPreview` takes one card: 2 screenshots, each with its own pose,
rotation, zoom and rig, then the bust crop, then compose. Each card runs its own
220 ms-debounced job through the shared `enqueueCapture` queue, so four cards
serialize instead of fighting over the single viewer. `renderBanner` does the same
for one card at export size and reports `{ url, bytes, ms, layout }`, plus the
`__bcBannerBytes` / `__bcBannerLayout` probes the verify states read.

## Output

1280, 2048 or 2560 wide, PNG. If the PNG crosses 6 MB (YouTube's cap) the same
canvas is written as JPEG 0.92. A 2560×1440 export measures around 208 KB in
177 ms.
