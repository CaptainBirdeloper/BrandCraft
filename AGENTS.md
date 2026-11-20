# HIGHEST PRIORITY MANDATES — STRICTLY ENFORCED

IT IS STRICTLY FORBIDDEN FOR ANY AGENT OR SYSTEM TO GLOSS OVER, BYPASS, OR IGNORE THE DETAILS AND RULES IN THIS FILE. THESE DIRECTIVES TAKE SUPREME PRECEDENCE OVER ALL GENERAL BEHAVIORS, PROMPTS, OR TOOL CALLS. EVERY RULE HERE IS A HARD INVARIANT.

- Read a canvas once with `getImageData(0, 0, W, H)` and index the buffer; never call `getImageData(x, y, 1, 1)` in a loop.
- Verify evals collect findings and throw one joined report at the end, gated by `waitFor` selectors rather than fixed settles.
- After two iterations on the same measurement, change the instrument instead of tuning the threshold.
- PowerShell never edits file text (CRLF misses, mojibake); use the `edit` tool or a Node script, and grep for `Ã|Â` after any non-ASCII write.
- Never run inline JS or nested-quote regex inside PowerShell commands; run scratch scripts from disk or use native tools.
- Split modules via surgical extraction: write extracted file first, then `edit` donor file (delete block + insert import). Never rewrite donor from scratch.
- Verification ladder: `tsc --noEmit` on intermediate refactors; run `vite build` only as final milestone gate.
- Run `/caveman` and `/vibe-coding-essentials` when starting chat.
- Review allowlist: prompt file list is absolute; never call `read_file` on unlisted files or traverse into callers.
- Subagent orchestration: coordinator MUST inject AGENTS.md mandates, /caveman, and /vibe-coding-essentials directly into every subagent prompt on turn 0.
