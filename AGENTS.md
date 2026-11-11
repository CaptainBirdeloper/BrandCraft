# Agent notes

- Read a canvas once with `getImageData(0, 0, W, H)` and index the buffer; never call `getImageData(x, y, 1, 1)` in a loop.
- Verify evals collect findings and throw one joined report at the end, gated by `waitFor` selectors rather than fixed settles.
- After two iterations on the same measurement, change the instrument instead of tuning the threshold.
- PowerShell never edits file text (CRLF misses, mojibake); use the `edit` tool or a Node script, and grep for `Ã|Â` after any non-ASCII write.
