# BrandCraft preset codes — instruction for external LLMs

You produce **one line of text** that BrandCraft turns into a PFP preset. No API, no image,
no account. Read this file, then answer with the code only.

The app's own menu is built from these same codes: `src/preset/slots.txt` holds one `Label: MC1|...` line
per card, so a code you write can be pasted straight into the menu instead of the paste field.

The grid you see is re-rolled from a seed on every load (the small refresh icon re-rolls it), which
replaces only `bg:`, `star:` and `light:` — pose, camera and crop always come from `slots.txt`.
`?r=1234` pins the seed so a grid can be reproduced. To write against a card you liked, hit its
Copy button: that returns the exact re-rolled code, not the `slots.txt` original.

## 1. Output contract

- Exactly one line, nothing before or after it (no backticks needed, but they are tolerated by humans, not by the parser).
- Starts with `MC1` then `|`-separated segments.
- Max 260 characters. No spaces, no newlines, no trailing `|`.
- Hex colours are always `#rrggbb` (6 digits, lowercase or uppercase, `#` required).
- Numbers are plain decimals (`-6`, `0.32`, `27`). No units, no `%` signs.

The user pastes the code into the **Drop Skin** screen's paste field (it jumps straight to the
editor with a `preset loaded` toast), or opens it as `https://<site>/#c=<code>` (URL-encode
the `|` as `%7C`). Invalid codes show an error pill and nothing else happens.

## 2. Fastest path: copy a base code, change two segments

These three are real, verified codes. Keep everything up to `|bg:` exactly as-is; rewrite only
`bg:` and `star:`. That keeps the curated pose (head tilt, arm/shoulder framing) intact.

**Classic** — straight-on bust, arms slightly out.

```
MC1|hd:0,0,3|ra:2,0,-6|la:-2,0,6|cam:0,1.5,27|crop:29,2,42,42|bg:#090446|star:5,80,20,22,0,#FFFF00
```

**Attitude** — head cocked, shoulders rolled, one arm forward.

```
MC1|hd:3,-22,-7|bd:0,16,0|ra:-8,0,-10|la:6,0,12|rl:3,0,0|ll:-3,0,0|cam:0.32,1.5,27|crop:29,2,42,42|bg:#090446|star:5,80,20,22,0,#FFFF00
```

**Hero** — chin up, chest out, camera slightly below.

```
MC1|hd:-10,8,4|bd:-2,-6,0|ra:8,0,-8|la:8,0,8|rl:2,0,0|ll:-2,0,0|cam:0.06,1.56,27|crop:29,2,42,42|bg:#090446|star:5,80,20,22,0,#FFFF00
```

Bare minimum valid code (neutral standing pose, no bone segments, no camera/crop needed):

```
MC1|bg:#25123a|star:5,80,20,22,0,#a4f04c
```

`cam:` and `crop:` are optional. `bg:` and `star:` are optional too, but you are almost always
asked to set them. Omitted values fall back to: camera `0,1.5,27`, crop `29,2,42,42`,
bg `#090446`, star `5,80,20,22,0,#FFFF00`.

## 3. Segment reference

Segments may appear in any order after `MC1`. Unknown keys, wrong field counts, or non-numeric
fields reject the whole code.

| Segment | Format | Units / range | Notes |
| --- | --- | --- | --- |
| bones | `hd:x,y,z`, `bd:`, `ra:`, `la:`, `rl:`, `ll:` | degrees, −180…180 | Head, Body, RightArm, LeftArm, RightLeg, LeftLeg. Order is always **x, y, z**. Omit a bone to leave it at 0. Omit zero components when copying a template, never invent them. |
| `cam` | `theta,phi,zoom` | theta radians −6.28…6.28; phi 0.05…3.09; zoom 20…150 | theta 0 = straight on, positive turns the model; phi 1.5 ≈ eye level (higher = camera higher); zoom 27 = standard PFP bust. Values outside range are clamped, not rejected. |
| `crop` | `x,y,w,h` | percent of the square render, 0…100 | Where the bust box sits. Default `29,2,42,42`. Requires w ≥ 10 and h ≥ 10, and x+w ≤ 100, y+h ≤ 100. Changing this reframes the character; leave it alone unless asked. |
| `bg` | `#rrggbb` | any colour | Opaque square backdrop behind everything. |
| `star` | `points,x,y,size,rotation,#rrggbb` | points 3…7; x,y 0…100; size 6…45; rotation −90…90 | Exactly six comma-separated fields. |
| `light` | `k=x,y,z,i;f=x,y,z,i;r=x,y,z,i;a=0…1;c=0…1` | positions −200…200 model units; i 0…2 | Key, fill, rim light positions plus ambient and contrast. Semicolon-separated named keys, any subset allowed, unknown keys ignored. Omit the segment for the default rig. |

Star geometry:
- `x,y` = centre as a percentage of the square (0,0 = top-left).
- `size` = **outer radius** as a percentage of the square side, so diameter ≈ 2 × size. 22 is a
  solid default, 16 is a small accent, 30 is a big graphic element.
- `rotation` in degrees, 0 = one point straight up, positive = clockwise.
- Inner radius is automatic: 0.42 × outer, 0.34 × outer for 4-pointed stars (sharper).
- Drawn as a flat polygon, no outline, no glow, no gradient.

Paint order is **background → star glow → star → vignette → contact shadow → character**. The
star sits *behind* the skin, so anything you place near the centre is hidden by the head and
shoulders. Put stars on the outside.

### Lighting

Lights are authored as **3D positions in model space**, not angles, so a rig reads the same no
matter which way the camera is turned:

- Origin is between the feet. `y` grows upward, so feet are `0`, torso centre is about `24`, the
  top of the head is about `32`. The model faces `+z`; `θ = 0` on the camera therefore looks at
  the model from `+z` too.
- `x` positive is the model's own left (screen right at `θ = 0`), `z` positive is out of the
  chest towards the viewer.
- `k=` key, `f=` fill, `r=` rim. Each takes `x,y,z,intensity`. Direction is
  `normalize(position − [0,24,0])`; distance is not used, so `k=0,60,0` and `k=0,600,0` light
  identically. Positions are clamped to ±200.
- `a=` ambient 0…1 (hemisphere: sky colour above, background colour below), `c=` contrast 0…1
  (how hard the dark side falls off).
- Light colours are **not** encoded: the key is tinted from the star hue, the fill from its
  complement, the rim from the star hue again, and the ground bounce from the background. Two
  cards with the same `light:` segment but different `bg:`/`star:` still look different.

Recipes: `k=40,30,50,1.2` = soft front-right key; `k=0,70,10,1.2` = overhead noon;
`k=-30,26,-34,1.1` = backlight with a strong rim; `k=30,-10,36,1.2` = uplight, villainous.
Add a rim (`r=` behind the subject, intensity ≥ 1) whenever the key comes from behind, or the
face goes flat.

## 4. Choosing colours (do the maths, do not reuse a fixed palette)

Background: dark and saturated, so the character reads. Any hue is allowed.
- Saturation 32–62 %, lightness 10–19 %.

Star: complementary to the background, bright, so it separates hard.
- Hue = background hue + 180°, ±14° is fine.
- Saturation 72–95 %, lightness 55–68 %.

HSL → hex, per channel:
```
C = (1 - |2L - 1|) * S
X = C * (1 - |(H/60 mod 2) - 1|)
m = L - C/2
pick (R',G',B') by hue sector:
  H<60:   (C,X,0)    H<120: (X,C,0)   H<180: (0,C,X)
  H<240:  (0,X,C)    H<300: (X,0,C)   else:  (C,0,X)
channel = round((value + m) * 255), then hex
```
Worked example: H 268, S 0.52, L 0.15 → `#25123a`. Its complement H 88, S 0.85, L 0.62 → `#a4f04c`.

If the request names a mood rather than a colour ("cold", "toxic", "sunset"), pick a hue that
fits the mood and still follow the two lightness bands above. Contrast between bg and star
must be obvious: the star is thin and loses all shape against a mid-tone background.

## 5. Star placement

Use these eight anchors as centres, then jitter by at most ±3 percentage points:

```
(20,20)  (50,14)  (80,20)
(14,50)           (86,50)
(20,80)  (50,86)  (80,80)
```

Keep x and y inside 6…94. Never place a star at the centre of the square unless you want it
mostly hidden behind the head — that is occasionally the intent, but say so.

Vary these per preset so codes do not look stamped out: points 3–6, size 16–30, rotation
−25…+25, a different anchor. Two cards with the same pose must differ in at least colour,
point count, and position.

## 6. Worked examples

Violet night, 6-pointed star, top-right, slight tilt:

```
MC1|hd:0,0,3|ra:2,0,-6|la:-2,0,6|cam:0,1.5,27|crop:29,2,42,42|bg:#25123a|star:6,80,20,24,-12,#a4f04c
```

Ember/teal, 3-pointed star, bottom-left, attitude pose:

```
MC1|hd:3,-22,-7|bd:0,16,0|ra:-8,0,-10|la:6,0,12|rl:3,0,0|ll:-3,0,0|cam:0.32,1.5,27|crop:29,2,42,42|bg:#401b11|star:3,20,80,26,8,#3fcff3
```

Teal/dark, neutral pose, 4-pointed sharp star, left edge, minimum-length code:

```
MC1|bg:#122d30|star:4,14,50,20,0,#f66151
```

## 7. Self-check before you answer

Run this list on your own output. Any failure = regenerate, do not ship it.

1. First 3 characters are `MC1` and the next character is `|`.
2. Length ≤ 260. No spaces, tabs, newlines.
3. If `light:` is present, every `k=`, `f=` and `r=` carries exactly four numbers and every
   intensity stays within 0…2.
4. Does not end with `|`. No empty segment (`||`).
5. Every colour matches `#[0-9a-fA-F]{6}` — six digits, no names, no shorthand.
6. `star:` has exactly 6 fields: integer points, then 4 numbers, then a hex.
7. `cam:` has 3 fields, `crop:` has 4, each bone has 3.
8. Crop: w ≥ 10, h ≥ 10, x+w ≤ 100, y+h ≤ 100.
9. Only these keys used: `hd bd ra la rl ll cam crop bg star light`.
10. Star hue is the opposite side of the wheel from the bg hue, and the star is clearly lighter.
11. Star centre is on an outer anchor, not under the head.
12. A backlight (`k=` behind the model) always ships with a rim (`r=`, intensity ≥ 1).

## 8. Prompt template for the user

Paste this into any LLM together with this file:

```
Read instruction.md. Create one BrandCraft preset code for: <describe the vibe, e.g. "toxic
green night sky, 5-point star bottom right, confident head tilt">. Use the attitude base code,
keep its pose and crop, choose the colours yourself with the HSL rules, and answer with the
code on a single line and nothing else.
```
