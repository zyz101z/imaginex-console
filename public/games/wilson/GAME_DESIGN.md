# Wilson's Spray World — Game Design Document

**Shelf title:** Wilson's Spray World
**Game id:** `wilson`
**Platform:** ImagineX console — single-file HTML5 canvas game, iframe-embedded, offline.
**Player:** Wilson, a zombie skater kid who tags walls across the city for coins and fame.
**Status:** IN BUILD (v1, 2026-08-02). Concept art for Wilson incoming from user — placeholder
Wilson (code-drawn zombie skater) used until it arrives, then swapped into HUD/menu.

---

## Locked decisions (with user, 2026-08-02)
- **Core mechanic:** FREE-DRAW CREATIVE. Player sprays freely with a palette of colors and
  nozzle sizes. Each wall gives a prompt ("Paint a CAT").
- **Scoring judge:** HIDDEN-SILHOUETTE MATCH (no AI backend). Each prompt owns a target shape
  the game knows but does NOT show as a trace outline. Score = how well paint covers the shape
  (coverage) minus overspray outside it (containment), plus style bonuses. Feels expressive,
  scores fairly, always beatable.
- **Progression:** COINS + SHOP UNLOCKS. No level gating. Walls keep coming; coins accumulate;
  shop is the pull.
- **Timer:** RELAXED. No hard countdown, cannot fail a wall. Finishing under par time gives a
  bonus. Player taps DONE when happy.
- **Leaderboard:** BEST SINGLE WALL SCORE (metric label "Best Tag"). Submitted via console
  postMessage protocol. gameId `wilson`.

## Core loop
1. Roll up to a wall. Prompt appears: "Paint a SKULL."
2. Pick colors/nozzle, spray freely on the brick wall.
3. Tap DONE → judge scores coverage + containment + style → Grade (F→S) + coins.
4. Coins bank. Next wall (new prompt). Spend coins in shop anytime.

## Scoring detail (v4 — normalized shape matching, replaces the v1 coverage judge)
The v1 judge compared paint to a target at a FIXED position/size, which made it a hidden
stencil, not free drawing. v4 normalizes instead:
1. Player mask at 180×N from the paint layer.
2. **Hole-fill** (flood from border) — so an OUTLINE of a cat scores like a filled cat.
3. **Normalize**: crop to bounding box, rescale into 64×64 keeping aspect ratio → the player
   may draw anywhere on the wall at any size. Aspect is preserved on purpose (a squashed cat
   shouldn't read as a cat).
4. Compare vs the reference shape, normalized the same way, best over mirror + ±3px shifts:
   `0.5 × IoU(area) + 0.5 × contour`, contour = chamfer distance transform of the reference
   boundary sampled at the player's boundary, `1 - meanPx/7`.
   ⚠️ Area IoU ALONE is not enough: an inscribed circle is 79% of its square by area, so a
   square scored S for the round tag. The contour term is what makes shape actually count.
5. `inkRatio > 0.42` scales accuracy down hard, so blanketing the wall can't pass.
6. Grades: S ≥ .86, A ≥ .76, B ≥ .66, C ≥ .50, D ≥ .34 (S deliberately rare — user asked for
   it to be harder after playtest). Calibrated with `scratchpad/calibrate.js` against realistic
   drawings; representative results in the changelog below.
- No ghost outline is drawn any more — position no longer matters, so a hint would just mislead.

## Scoring detail (v1, superseded)
- Offscreen **mask canvas**: target silhouette filled solid = the "inside" region.
- Compare against the **paint layer** at a downscaled resolution (perf) via getImageData:
  - `coverage` = painted-inside / total-inside  (0..1) — main driver
  - `overspray` = painted-outside / total-outside (0..1) — penalty
  - base accuracy = clamp(coverage - overspray*k)
- **Style bonuses** (coins, not accuracy): 3+ colors used; not-one-giant-blob (edge/variety);
  speed bonus under par.
- Grade thresholds map accuracy→F/D/C/B/A/S. Score = accuracy*base + bonuses.
- Easy/kid toggle: faint "ghost" hint of the shape (accessibility only).

## Prompt library (code-drawn silhouettes, ~12 to start)
cat, skull, heart, star, ghost, fish, mushroom, lightning bolt, smiley, crown, snake,
skateboard. Wilson-flavored extras: zombie hand, brain, tombstone. Each = compact vector
path filled to the mask; no image assets.

## Shop / economy (coins)
- **Paint colors:** ~6 basics free; unlock neon, gold, chrome, glow, pastel sets.
- **Nozzles:** S/M/L basic; unlock fat cap, skinny cap, splatter.
- **Wilson cosmetics:** skateboard decks, caps/beanies, zombie skin recolors, signature tag.
- Prices tuned so a kid unlocks something every few walls.

## Feel / vibe
- Brick/concrete wall, paint drips, procedural spray-hiss + rattle SFX (WebAudio).
- Spray-can cursor; Wilson on the HUD reacting to grades (idle skate bob).
- Dark street theme, neon accent (registry color). Mobile + desktop pointer input.

## Tech
- Single-file `index.html`, inline JS, canvas 2D. Full-bleed canvas, letterbox scale.
- Paint on a dedicated layer canvas; mask on offscreen; composite over wall bg.
- `window.__wilson` test hook (paint region programmatically, read score) for headless tests.
- Save: `wilson_save` localStorage JSON {coins, owned:{colors,nozzles,skins}, equipped, bestScore, seen}.
- Registry: add to `games.ts` (status coming_soon until playtest), add `wilson` to
  `KNOWN_GAMES` in /api/leaderboard, add "Best Tag" to GAME_SCORE_LABELS.

## Build status / changelog
- 2026-08-02: GDD finalized, mechanic changed from earlier stencil draft to free-draw. Build started.
- 2026-08-02: v1 BUILT & TESTED (headless Chrome/puppeteer). Full single-file game:
  spray engine (pointer paint, 6 nozzles, drips, procedural hiss/rattle/ding SFX),
  12 code-drawn silhouettes, coverage/overspray scoring (spray-all correctly penalized to D),
  grades F-S, coin economy, 3-tab shop (14 paints, 6 caps, 4 tag colors), wilson_save,
  best-wall leaderboard via postMessage. Wilson concept art wired into title + HUD.
  Registered in games.ts as **coming_soon**, added to KNOWN_GAMES + GAME_SCORE_LABELS ("Best Tag").
  All headless checks passed, zero runtime errors. **UNCOMMITTED — awaiting user playtest**
  → then flip status to "available" + push (same flow as BREACH/route-dispatcher).
- TODO after playtest: consider cutting real Wilson out of the dark bg for a cleaner HUD;
  add more prompts; tune coin prices; maybe add music.mp3 (user adds music).
- 2026-08-02 (v2): **SKATE WORLD added** (user: "need actual gameplay besides spraying").
  Side-scrolling night city: Wilson rides his board (code-drawn animated skater — arrows/AD move,
  space/W/↑ jump [edge-triggered so taps never drop], touch pads on mobile), collects coin arcs
  (some need jumps), rolls up to 10 BLANK WALLs per district. Near a wall → "🎨 PAINT THIS WALL"
  (or E/Enter) → existing spray mode with that wall's prompt → mural is STAMPED onto the building
  (thumb canvas; grade badge). All 10 done → +150 bonus + NEW DISTRICT (fresh prompts, district
  counter). City persists in wilson_save (prompts/done/grade/color; thumbs are session-only —
  reloaded walls show the silhouette in your main color as a stand-in mural). PLAY now enters
  skate mode; result button = BACK TO STREET. Parallax skyline w/ lit windows, moon, props
  (trash cans/hydrants), coin/jump SFX. Headless suite test_wilson2.js: 10/10 PASSED
  (movement, jump, coins, wall-enter w/ matching prompt, mural persistence across reload).
- 2026-08-02 (v3): **TRICKS + RAILS + POLISH, and an 8-bug audit fixed.**
  New gameplay: jump again mid-air = trick (KICKFLIP/360 SPIN/HEELFLIP/IMPOSSIBLE/NOLLIE,
  deck flips + full-body spin animation); stacking tricks in one air = combo (6/15/30/50 coins);
  grind rails between buildings (land on top → sparks + coins scaled to grind length, jump to
  bail out); pigeons that scatter as you skate past; floating score popups. Prompt library
  12 → **18** (added diamond, moon, bone, alien, spray can, zombie hand).
  **Murals now persist for real** — a 160×104 WebP snapshot per wall (~2KB, whole save 2.1KB)
  is stored, so reloading shows your actual painting, not a stand-in silhouette. persist()
  drops snapshots rather than losing the save if quota is ever hit.
  Bug audit (all 8 fixed + regression-tested, see test/README.md): permanent softlock after
  painting a district's last wall; unknown skin/prompt id bricking boot or freezing the render
  loop; resize-mid-painting wrecking the score; stuck keys on alt-tab; coin farming via reload;
  negative wall size on tiny viewports; painting after DONE; leaderboard re-posting every wall.
  ⚠️ Load order matters: `save = load()` MUST run after the COLORS/NOZZLES/SKINS/SHAPES consts
  (it validates against them; earlier placement = TDZ ReferenceError at boot).
  Test suites live in `test/` (4 files, real headless Chrome) — ALL PASSING.
- 2026-08-02 (v4): **REAL free-drawing + harder S.** User: grading too easy, and asked whether
  genuine free-draw scoring was feasible. Answer shipped: normalized shape matching (see
  "Scoring detail v4" above) — draw the subject ANYWHERE on the wall at ANY size, outline or
  filled, and it's judged on whether the shape actually resembles the subject.
  **FREESTYLE walls** (2 per district, `p:'free'`): no assigned subject, Wilson guesses what you
  drew by matching against all 18 shapes ("Wilson reckons that's a Heart!"). This is honest
  recognition over a known vocabulary — NOT open-vocabulary ML. Truly open-ended "draw anything,
  is it good art" would need a trained model (Quick-Draw-style CNN) and is out of scope offline.
  Calibration (calibrate.js): exact shape 96% S · outline-only 93% S · small corner drawing 92% S
  (proves position/size independence) · lumpy freehand circle 73% B · square-for-round-tag 69% B
  · star-for-tag 23% F · whole wall sprayed F · blank 0 coins. Freestyle: heart→Heart 95%,
  ghost outline→Ghost 92%, scribble→D.
  Gotchas for future work: `free` is NOT in PROMPTS (separate FREE const) — anything iterating
  prompts or looking up SHAPES[id] must special-case it (save sanitizer, drawBuilding, setPrompt
  test hook all do). Reference masks are cached per shape in `refCache`.
- 2026-08-02 (v5): three additions picked to fill real gaps (user: "pick 3 things").
  1. **Spray toolkit** — UNDO (↶), ERASER (🧽 toggle, destination-out), PEEK (👁, flashes the
     target ~1.4s; explains itself on freestyle walls). Undo replays a *vector stroke log*
     (stamp positions per stroke, capped at 60) rather than canvas snapshots — a full-res
     snapshot is ~5MB on a retina tablet, so 10 of them would be 50MB. Drips are skipped on
     replay to keep undo deterministic; `colorsUsed` is rebuilt from the log.
  2. **Mural Gallery** (🖼️ on title) — finished murals were previously destroyed by district
     rollover. They're now copied into `save.gallery` (capped 24, ~2KB WebP each) with grade,
     subject name and district, and rendered as a grid. Regression-tested to survive rollover.
  3. **Goals** (🎯 on title) — 3 rotating challenges from a 10-entry pool (paint N walls, earn
     A/S, land tricks/combos, grind rails, collect coins, use 4 colours, finish/【guess】a
     freestyle). `bumpStat(stat,n)` is called from the wall-finish, trick-land, grind-end and
     coin-pickup paths; completing one pays coins + toasts, clearing all three rerolls.
  New suite `test/toolkit.test.js` covers all three (undo restores ink EXACTLY, eraser removes
  some-but-not-all, peek never touches the paint layer, gallery survives rollover, goal rewards
  pay out and reroll). All 5 suites green, zero runtime errors.
- 2026-08-03 (v6): **ART PASS — the game looked like a prototype; now it doesn't.**
  *City:* layered night sky (gradient + parallax twinkling stars + glowing gibbous moon +
  drifting clouds), two skyline layers — far silhouettes with blinking radio masts, mid-layer
  blocks with warm lit windows, water towers and glowing neon signs — plus a haze band between
  them for depth. Streetlamps now cast head-glow, a light cone and a pool on the tarmac.
  Street has kerb, paving joints, cracks, manholes and puddles with smeared neon reflections.
  Full-scene vignette. Building facades rebuilt: light falloff, cornice, two rows of windows
  (lit ones spill glow onto the wall), fire escapes, AC units, downpipes.
  *Wall panel / spray mode:* concrete-and-brick with per-brick tint noise, mortar shadow,
  water staining, ground scuffs, faded OLD TAGS underneath (the wall has history), overhead
  light wash and corner grime. Added a spray-can cursor that tracks the pointer, shows the
  live colour and a nozzle-size ring (dashed when the eraser is on).
  *Wilson:* redrawn at 1.5× and far more faithful to the concept art — backwards cap with the
  brim out the back, eyepatch + strap, stitched mouth, pale zombie skin, open tattered hoodie
  over the X-eyes smiley tee, bandaged forearm, hi-top sneakers with purple laces, spray can in
  hand, grip-taped deck with the smiley. Grit kicks up while rolling; landing puffs dust
  (bigger puff on a hard landing).
  *UI:* glassy cards with pop-in animation and an accent hairline, gradient/glow buttons,
  animated grade reveal, glowing selected swatches, blurred HUD chrome, title glow behind
  Wilson. Controls hint moved to the top (it was sitting over Wilson's legs).
  ⚠️ Gotcha fixed during this pass: a `quadraticCurveTo` call with 2 args instead of 4 threw
  every frame — the game kept running ONLY because of the v2 fix that queues the next rAF
  first. Keep that ordering.
  Verified: all 5 suites still green, zero runtime errors, title fits without scrolling at
  960×640 and 390×720, and frame time is a locked 16.7ms (60fps) even on a software renderer.
