# Agent notes

Project-specific rules that outrank general habits. Global rules live in `~/.dsh/AGENTS.md`.

## Verification

- Read a canvas once: `ctx.getImageData(0, 0, W, H)` into a buffer, then index it. Never call
  `getImageData(x, y, 1, 1)` inside a loop — every call is a GPU readback, and a 1600×900 frame
  scanned per pixel is 1.4 M of them.
- Write verify evals that collect findings into an array and throw one joined report at the end.
  A throw-first assertion turns each run into a REPL, because it can only report one fact.
- Gate on `waitFor` selectors, not fixed settles. A settle is only for debounce and paint.
- After two iterations on the same measurement, change the instrument instead of tuning the
  threshold. Threshold tuning past two rounds means the measurement is wrong, not miscalibrated.
- Run each state once per change set. Batch the states into one command; do not re-run after
  every small edit.

## Editing text files

- PowerShell never edits file text. Here-string `.Replace()` silently misses on CRLF/LF
  mismatch, and `Get-Content -Raw | Set-Content -Encoding utf8` double-encodes non-ASCII
  (`×` becomes `Ã—`). Use the `edit` tool for targeted changes, or a Node script that reads with
  `utf8`, normalises `\r\n` to `\n`, and throws on a missed pattern.
- After writing non-ASCII (×, —, →, ’) through any shell path, grep the file for `Ã|Â` before
  moving on. Both markers mean mojibake, and repair means an explicit character map, not a
  latin1 round trip.

## This codebase

- Banner and preset artwork must be resolution-independent: every dimension is a fraction of the
  frame width, derived in `src/banner/layout.ts` or the preset spec. Never multiply by
  `layout.scale` in a drawing call — the rect is already in target pixels.
- Every capture serialises through `enqueueCapture`. A public renderer must never be nested
  inside another job, and the rig is reset per capture because one `SkinViewer` serves the batch.
- Verify states live under `states` in `verify.states.json` (root is `{ defaults, states }`), and
  the file may start with a BOM that has to be stripped before `JSON.parse`.
- Gate every change set with `npx tsc --noEmit` then `npx vite build`. `pnpm` is not on PATH here.
