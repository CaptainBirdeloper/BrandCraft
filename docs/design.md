# BrandCraft — design decisions and traps

Values live in code; this file holds only what code cannot say. For numbers read
[src/styles/tokens.css](../src/styles/tokens.css) (palette, ladder, type scale),
[src/styles/app.css](../src/styles/app.css) (geometry per screen), [src/motion.ts](../src/motion.ts)
(springs). [summary.txt](../summary.txt) indexes every file, class and module. If this doc and the
code disagree, the code is right — so this doc never restates a value.

## Voice

Dark navy canvas, Signal Yellow as the single primary action, and a "printed poster" feel: heavy
display type, hairline borders instead of shadows, generous negative space. Roles are fixed —
Signal Yellow acts, Strawberry destroys, Rosewood hovers and decorates. Everything else is a
neutral tier.

Hard constraints (they are why the palette is small, not descriptions of it):

- No `#000000` canvas and no white-only text; the neutral tiers carry body copy. Black appears
  only as the tile behind a render (preset card, download preview, edit preview).
- Never white text on Signal Yellow (1.07:1), never small white text on Strawberry, never
  Rosewood or Olive Wood for small text on dark.
- No drop shadows for elevation — the surface ladder plus a hairline border does the work.
- Yellow is a fill, border or ring, never a large flat area; two accents per screen at ~10 %.
- No green. "Success" would need a new hue, which means a palette review, not a shortcut.

## Lighting (character shading)

The renderer's stock shading was `ambient + diffuse * dot(N, cameraDir)`, so every preset was lit
identically and the busts read flat. [src/lighting/lighting.ts](../src/lighting/lighting.ts) replaces
that shader; [src/lighting/lightrig.ts](../src/lighting/lightrig.ts) holds the data.

- **Model**: hemisphere ambient (sky above, background bounce below) + wrapped key Lambert +
  opposite fill + Fresnel rim, then a fixed 0.86 gain so a hot key cannot clip to white, then a
  contrast S-curve. Per face, no specular — skins are matte and a highlight fights the pixel art.
- **Rigs are 3D positions in model space** (feet `y = 0`, torso `y ≈ 24`, faces `+z`) aimed at
  `[0,24,0]`. Distance is ignored, so a position is a direction dial, not a point light. This is
  what makes the cards read as different photographs rather than tints of one headlight.
- **Colour is derived, never picked**: key tint = star hue, fill = its complement, rim = star hue,
  ground bounce = background hue. Two cards sharing a `light:` segment still differ because their
  `bg:`/`star:` differ. No hex exists in the lighting code.
- **Baked layers** after the GL render: star-colour glow behind the star, background-tinted corner
  vignette, and a blurred silhouette contact shadow so the bust sits on the backdrop.
- **Share code**: `light:k=x,y,z,i;f=…;r=…;a=…;c=…`, optional; unknown keys ignored, absent
  segment means `DEFAULT_RIG`. Old and pasted codes must keep working — add, never repurpose.

## Randomized grid and the refresh control

Every load re-rolls the *appearance* of the eight menu cards from a seed; the icon-only button
beside the stage title re-rolls again.

- **Scope is deliberately narrow.** Only `bg:`, `star:` and `light:` are random. Pose, camera and
  crop stay literal `slots.txt` data, so composition rules hold on every roll and no randomizer bug
  can break framing.
- **Deterministic.** `mulberry32` seeded once per grid; `?r=1234` pins it, which is what makes the
  verify probes and screenshots reproducible. Never sprinkle `Math.random()` into a render path.
- **No palette.** Backdrop hue is uniform, star hue sits 180° ± 40 opposite it, point count 3–6,
  one of eight anchors, ±25° rotation. Rigs are three random points on a sphere with key front,
  fill far side, rim behind — a roll should read as a new photo, not a new tint.
- **Share codes follow the roll.** Copy and Download encode the re-rolled slot, so a copied code
  reproduces the card on screen; `slots.txt` stays the base row, never the painted result.
- **Batch or nothing.** One shared viewer: one resize, one skin upload, one warm-up, then eight
  synchronous `screenshot()` calls. Per-card frame waits cost ~265 ms of pure vsync; the batch
  measures ~160 ms for a re-roll and ~420 ms for the first batch including the upload. Cards keep
  their old image while a re-roll runs, so the grid never blinks back to "Rendering".
- **Rejected**: caching the character and tinting it per card in 2D (≈5× faster, but collapses
  key/fill/rim into one flat tint, deleting the shading work); parallel WebGL contexts (more skin
  uploads and context memory for ~60 ms).
- **The button** is icon only, inherits the accent, no focus ring, no lingering border — same rule
  as every control in the app.

## Render loop and the pose frame

`screenshot()` redraws synchronously and the camera setters snap, which makes back-to-back
captures tempting. That is wrong for exactly one thing: a pose. `playAnimation()` only points the
animation controller at a clip; the skeleton is written by `updateAnimationController` from inside
the loop tick. A screenshot in the same task as `playAnimation()` therefore captures whatever pose
the loop last applied — for a batch, the last pose of the *previous* batch. The symptom was cards
carrying an old pose over their own fresh backdrop, and a download page matching no card.

The fix keeps the loop alive for the whole batch and treats the pose as the expensive part: group
cards by pose name, let each group cost one frame (`playAnimation` → `nextFrames(1)`), then capture
every card in the group with no further wait. Eight cards over three poses costs three frames
instead of eight. Rendering is now deterministic — the same slot produces byte-identical pixels on
any mount, which is what the `pose-match` probe asserts.

Corollary: any new path that changes camera, pose or light must go through the same
"settle a frame before the first capture" shape. This includes the editor's preview.

## Editor (edit page)

A pencil on any card opens `screen: 'edit'` with that card as `editDraft`: sticky square preview on
the left, scrolling control column on the right, sticky footer with the share code, Done and
Download.

- **One codec, two faces.** Every slider reads and writes the same `Slot` that `encodePreset`
  serialises, so the code chip, the grid card and the exported PNG cannot disagree. Steps mirror
  the codec's rounding (1° bones and camera, 1 % crop and star, 0.05 light intensity, 0.01
  ambient/contrast) — a slider can only land on a value a decode would reproduce.
- **Bounds are live.** `crop-x`/`crop-y` max out at `100 − width`, so the square crop cannot leave
  the render; `applyParam` clamps against the live bounds before writing.
- **Colour is HSL over hex**, **light is azimuth/elevation** around `LIGHT_TARGET`. Neither may
  reach for a palette constant.
- **Poses get new names.** `poseKey(bones)` hashes the bone set, because `ensurePose` is idempotent
  per name and would replay the first pose registered under that label.
- **Draft, then commit.** `updateDraft` never touches the grid. Escape and Done both commit;
  Download from the edit page sets `returnTo: 'edit'` so closing the download screen returns with
  the draft intact.
- **Preview renders coalesce.** One in flight, newest wins, final value always painted.
  `renderPreview` caches the character under skin+camera+pose+light at a 2048 master; backdrop,
  star and crop edits only recompose 2D layers (a few milliseconds).
- **Stillness while dragging.** `scaleX` fill, fixed-width value box, native thumb: a drag never
  triggers layout and never shows a focus ring.

## Motion

`motion@14.10.1` via `motion/react`, mounted once in `main.tsx` as
`MotionConfig reducedMotion="user"` > `LazyMotion features={domAnimation} strict`. Springs are
always described the Apple way — perceptual duration plus bounce — and live in one file.

Moments, each with a reason to exist: page overlap so a screen change never shows a spinner; card
`whileTap` 0.96 that always settles back to 1; a re-roll cross-dissolve on two stacked layers with
the glyph turning one full 360°; a toast that rises 8 px instead of popping; the download page as a
full-page transition, not a modal; export pills dimming instead of spinning; one 220 ms lateral
jolt for a bad paste (a looping jolt nags); late images fading in only once the render lands.

Rules that keep this from degrading the app: animate only `transform` and `opacity`, run every exit
through `AnimatePresence` with stable keys, honour `prefers-reduced-motion` globally rather than per
component, keep state out of animations, and never leave a permanent `will-change`. Cost: the main
chunk went 79 kB → 112 kB gzip; loading `domAnimation` lazily would save parse time but skip the
entrance animation on first mount, which defeats the point.

## CSS and naming

`app.css` is one flat sheet, so a screen prefixes its classes (`.edit-*`, `.control-*`, `.slider*`,
`.download-*`). A generic name like `.pill` already belongs to the rail — reusing it is how the
edit footer once restyled the Replace Skin button, because the appended rule came later and won on
equal specificity. New screen, new prefix.
