# Wilson test suites

Real-browser tests (headless Chrome via puppeteer) — these drive the actual canvas,
so they verify pixel scoring and physics rather than stubbing them.

## Running

1. Serve the console: `npm run dev` (from `imaginex-console/`)
2. From a directory with `puppeteer` installed:
   ```
   export LD_LIBRARY_PATH=<libroot>/usr/lib/x86_64-linux-gnu   # only if Chrome deps are unpacked locally
   node core.test.js && node skate.test.js && node features.test.js && node regressions.test.js
   ```
Each exits non-zero on failure and prints a VERDICT line.

## What each covers

| File | Covers |
|---|---|
| `core.test.js` | Spray engine loads, hidden-silhouette scoring (perfect fill = S, half = C, spray-everything = D, empty = 0 coins), colour-variety bonus, shop renders |
| `skate.test.js` | Enter skate mode, 10-wall district, movement, jumping, coin pickup, wall proximity → PAINT button, spray prompt matches the wall, mural marks wall done, persists across reload |
| `features.test.js` | 18 prompts and no duplicate ids, rails/pigeons spawn, air-trick starts + pays on landing, grind lands and pays out, mural image saved and survives reload, save size sane |
| `toolkit.test.js` | Undo restores the previous stroke *exactly* (ink pixels match) and empties the wall when fully undone; eraser removes some-but-not-all paint; peek never writes to the paint layer and explains itself on freestyle walls; gallery stores grade/name/image, survives district rollover, caps at 24, renders every tile; goals roll 3 distinct challenges, pay their reward on completion, and reroll once all three are cleared |
| `regressions.test.js` | The 8 audit bugs — see below |

## Regression list (audit 2026-08-02)

1. **Softlock** — quitting after painting the last wall left a district with no blank
   walls, and only the result screen could roll a new one. Save was unrecoverable.
2. **Catalog-change bricking** — an unknown skin id threw at boot (black screen); an
   unknown prompt id on a saved wall threw inside the draw loop and, because the next
   frame was queued *last*, permanently froze the game. Save is now sanitized on load
   and the rAF is queued first.
3. **Resize mid-painting** — paint was stretched across the whole wall while the target
   box stays square, so rotating a phone mid-mural wrecked the score. Paint is now
   re-anchored on the target box.
4. **Stuck keys on blur** — alt-tabbing while holding a direction left Wilson skating by
   himself. Input clears on blur/visibilitychange.
5. **Coin farming** — street coins respawned every reload (only walls were persisted),
   so F5 was free currency. Pickup state is saved.
6. **Tiny viewport** — a very short window made wall height negative, producing garbage
   canvas allocations and a throw inside `getImageData` on DONE. Dimensions are clamped.
7. **Paint after DONE** — a second finger could keep spraying into an already-scored wall.
8. **Leaderboard spam** — every wall re-posted the all-time best; now only real bests post.
