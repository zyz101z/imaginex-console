# CRAZY GOLF KINGDOM — Game Design Document

ImagineX web game. Created 2026-09-26. Status: 🚀 **LIVE on imaginex.games 2026-09-26** (user playtested, said "good start" → two polish passes → publish).
Registry `available` in `src/lib/games.ts`, leaderboard id in `route.ts`, score label "Daily Pts" in `page.tsx`.
Cover: user-supplied `D:\ImagineX\crazygolfkingdom.png` (1024×1536 with red Imagine-X spine, has its own logo) →
`cover.png`; spine-less crop `title_art.jpg` is the title-screen background (blurred copy fills wide screens).

## Build ledger
- 2026-09-26 v1: physics.mjs (custom ball sim, 35 tests) · coursegen.mjs (seeded generator, ghost golfer
  proves every hole, ~670 tests) · render.mjs (three.js r169 CDN, shadows, canvas textures, Meshy GLBs)
  · main.js (modes, input, HUD, save, procedural SFX) · 15 Meshy models (450 credits; textures shrunk
  2048 JPEG → 1024 WebP via gltf-transform, 47MB → 6.2MB; originals kept in scratchpad only) · cover.png
  (Meshy nano-banana-pro, cropped) · headless Chrome playthrough (9-hole career + 2P + daily, 9 checks).
  Fixed in build: hole-finish fired every frame after cup-in (events not cleared → 47k pts); decor models
  crowding the course; ramp skirt drawing over the slope.
- 2026-09-26 polish batch (after first playtest "good start, make it better"): physics-accurate SHOT PREVIEW
  (yellow→red dots simulate the real step() up to 1.4 s / first bounce; arrow shaft hides while dots show) ·
  camera auto-faces the cup once the ball rests (any orbit cancels it; R / 🎯 re-enables) · real two-finger
  orbit + pinch zoom (pointer map; second finger cancels an aim) · ball trail above 4.5 m/s · screen shake
  (bumper/cannon/hard wall/hole-in-one) · cup-in camera zoom · hole-in-one 4× confetti volleys · seeded
  ambient SCATTER props per kingdom (trees/flowers, gumdrops/candy canes, ferns/rocks, dead trees/tombstones,
  crystals/asteroids; never adjacent to the course) · Meshy windmill tower stands beside every windmill
  obstacle · EASY MODE toggle on the title (no water/void penalty, 20 strokes, HUD shows EASY) · career star
  total on the title.
- 2026-09-26 "loop fun + visual" pass: TRICK-SHOT BONUSES on the holing shot (Bank Shot 2+ walls +75, Bumper
  Buster 3 bumpers +100, Long Bomb >9 m +100, Lucky Lip +50, Portal Putt +75, Cannonball +75) · STREAK of
  holes at/under par → ×1.5/×2/×2.5/×3 points (HUD 🔥 pill, "streak broken" toast) · running score-vs-par pill ·
  star rating popup every hole in every mode · coin fly-in · SO CLOSE! on lip-outs · idle nudge after 12 s ·
  visuals: drifting cloud sprites (day kingdoms, dim in Castle), moon in Castle, corner posts + ball caps at
  every outer-wall vertex, hole number on the flag, bumpers squash on hit, guardians wobble on hit, rippling
  water texture, cup glow ring when the ball rests within 1.6 m, tee ring pulses while idle. Fixed: water disc
  was drawn under the tile; windmill tower now 1.35 tiles out and smaller. Music: user's 6 Suno loops
  delivered 2026-09-26 (source `D:\ImagineX\audio\golf\`) → copied to `music/`; music director in main.js
  (title loop on menus, kingdom loop per hole, 0.9 s crossfade, ducks while paused, separate 🎵 mute on HUD +
  title, autoplay retry on first gesture, save.music).
- 2026-09-26 CONTROLS pass (user: "a bit difficult"): drag-to-shoot from ANYWHERE (no more must-start-on-ball; a miss
  used to orbit the camera); power = screen distance (dead zone 10 px, full at 42% of the smaller screen dimension) so
  zoom/tilt no longer change the feel; direction still floor-projected; aim angle eases toward the finger (18/s);
  PULL (slingshot, default) / PUSH toggle (`save.aimMode`, 🎯 Aim button on title + pause); after every rest the arrow
  re-aims at the cup; keyboard ← → slower (1.1 rad/s, Shift 0.35) and Space charge ramps 1.3 s then HOLDS (was an
  oscillating timing bar); orbit = right-drag / two fingers / Q-E only. `test/browser.drag.js` drives real puppeteer
  mouse drags (13 checks).
- 2026-09-26 iPAD pass: viewport maximum-scale=1 + viewport-fit=cover, body position:fixed + overscroll-behavior:none,
  -webkit-touch-callout none, canvas/HUD touchstart+touchmove preventDefault (no rubber-band), gesturestart/change
  preventDefault (no page pinch), audio unlock also on touchend/click (iOS), setPointerCapture try/catch, resize on
  visualViewport/orientationchange, hover styles gated by @media (hover:hover), touch-action:manipulation on buttons,
  `html.touch` class → 48 px HUD buttons + bigger pills, safe-area padding; renderer on touch devices: DPR ≤1.5, PCF
  (not soft) shadows, 1536 shadow map. `test/browser.ipad.js` = Safari-UA emulation 1024×768 + 820×1180 with real CDP
  touch drags + two-finger pinch (20 checks).
- 2026-09-26 "1-3-5" pass: ⛳ SHOT OF THE DAY (`generateAceHole`, seeded per UTC day, difficulty 1-3; 3 balls, ball
  resets to tee after each miss; ace = 300/200/100 pts by ball, miss = 50−10·closest m; coins = pts/5; per-day board
  `crazy-golf-ace-daily-YYYYMMDD` (route.ts DAILY_ID regex extended, 3-day TTL; in-game top-10 + name entry
  `save.name`); mode card on the modes screen w/ today's best) · NEW OBSTACLES: TURNTABLE (rotating floor disc,
  physics pulls ball velocity toward the disc's surface velocity, never rests on it; Candy/Castle/Space) and
  JUMP PAD + GAP (pad tile → missing tile → landing tile; ballistic flight ignores walls, lands on floor, void = reset;
  slow balls get a minimum launch; gap edges have no walls; dark pit rendered; chevron plate + landing ring; Dino/
  Space/Meadow; "AIR MAIL" +100 trick) · BALL SKIN PERSONALITY: per-skin trail colour, glow, particles (sparkle/
  fire/bubbles/hearts) and a drop sound (chime/vroom/goal horn/twinkle/giggle/pop/roar), blurbs in the shop.
  Tests: physics 42, coursegen ~670 (jumps bridge the connectivity check), `test/browser.ace.js` (14 checks).
- 2026-09-26 LOADING + TITLE pass (user: long pause after picking a kingdom, flicker at hole start, empty title):
  hole generation moved to a module Web Worker (`src/gen.worker.mjs`; main-thread fallback yields first); courses are
  now lazy "specs" (`courseSpecs` → `ensureHole(i)`), hole 0 builds immediately, hole i+1 prefetches during play,
  scorecard awaits all; loading overlay paints before any work (spinner + kingdom emoji + bar; overlay fades out)
  — measured: overlay 6 ms, playable <1 s (was several seconds of frozen UI). Flicker fix: preload the kingdom's
  models (sync placement via `modelReady`), `R.warm()` compiles shaders + renders one frame behind the overlay, and
  `S.hole/S.world` are published to the frame loop only after `buildHole` (a hole-less frame used to throw).
  TITLE ATTRACT MODE: `startAttract()` builds a random kingdom hole behind the menus, camera orbits the course
  centre, a ghost golfer (12 angles × 5 powers) plays it, confetti on cup-in, new hole every cup/75 s; menus are
  translucent panels; the cover's logo is cropped to `logo.png` and shown as a bobbing badge.
- Playtest questions below still open. Not yet done: mobile pinch-zoom, ball trail, kingdom-specific
  ambient props beyond the two guardians, music (user usually supplies Suno tracks).

## Pitch
Procedural mini-golf through five themed kingdoms. Every hole is generated from a seed, so no
hole is ever hand-built, and the holes get progressively unhinged: bumpers, windmills, moving
walls, boost pads, cannons, teleporters, sand, water, and Meshy-made cartoon guardians
(a T-rex, a UFO, a gingerbread man...) standing in the way. Real 3D in the browser
(three.js), custom ball physics, drag-to-shoot. Hot-seat 2-player, par chasing, stars, coins,
ball skins, a daily seeded course with a leaderboard.

## Look
- three.js (CDN importmap, r169) with shadows, hemisphere + sun light, sky gradient.
- Course pieces are procedural geometry: green felt tiles (canvas texture), red rounded
  bumper walls, wooden ramps, sand (tan noise texture), water (animated blue), cup + flag.
- Obstacles are Meshy text-to-3D GLBs in `models/` (15 models, ~6k tris each, textured),
  used as decoration + simple collision proxies (cylinder/box). Missing model ⇒ procedural
  fallback primitive so the game never breaks on a failed load.
- Ball: white with dimple normal look via texture, rolls with real angular velocity.
- Juice: aim arrow + power ring, hit puff, wall-hit sparks, cup-in confetti + fanfare, camera
  flyover of each hole, ball trail on fast shots, screen-space score popups (BIRDIE! etc).

## Kingdoms (themes) — each 9 holes, unlocked in order in Career
| # | Kingdom | Palette | Models | Signature gimmick |
|---|---|---|---|---|
| 1 | Meadow Kingdom | grass green / red walls | windmill, mushroom, gnome | windmill blades, bumpers |
| 2 | Candy Kingdom | pink felt / mint walls | lollipop, gingerbread, cupcake | boost pads, sticky (slow) syrup patches |
| 3 | Dino Swamp | olive / brown | trex, palm, volcano | water hazards, sweeping tail (rotating bar) |
| 4 | Haunted Castle | purple felt / grey stone | tower, ghost, pumpkin | moving walls, teleporters |
| 5 | Space Station | navy / neon cyan | ufo, rocket, alien | low gravity (long rolls), cannons, ice |

## Hole generation (`src/coursegen.mjs`, pure, seeded)
- Grid of 1-unit tiles (rendered at 2.2 m). Random walk from tee to cup: 6–22 tiles long,
  widening to 2-wide sections and side pockets; turns limited so the path reads clearly.
- Elevation: sections can step up/down via ramp tiles (ball rolls back if it lacks speed).
- Obstacles placed by difficulty budget (hole index within the kingdom drives budget):
  bumper posts, wall blocks, windmill, spinner bar, moving wall, boost pad, sand, water,
  cannon (enter → launched to a target tile), teleporter pair, ice, and a kingdom guardian
  model with a collision proxy.
- Par = 2 + path-length term + obstacle term, clamped 2–5. Verified by the headless
  "ghost golfer" (greedy shot search) so every generated hole is provably completable
  within par+3; generator rerolls otherwise.

## Physics (`src/physics.mjs`, pure, testable in node)
- Fixed-step 120 Hz sub-stepping. Ball = point mass radius 0.12 m on a height field defined
  by tile heights + ramp slopes; gravity component along slope; rolling friction per surface
  (felt 0.9 m/s², sand 4.0, ice 0.15, syrup 3.0). Space kingdom uses gravity 0.5×.
- Collisions: circle vs segment (walls, spinner bars, windmill blades, moving walls), circle
  vs circle (bumpers, model proxies), restitution 0.75 walls / 1.15 bumpers (bumpers add
  energy, cap speed). Continuous-ish: sub-steps keep tunnelling out at max power.
- Cup: radius 0.2; capture if distance < 0.14 and speed < 2.6, else lip-out deflection.
- Water / off-course: ball resets to last resting spot, +1 stroke. Max 8 strokes then auto-hole.
- Shot: power 0–1 → speed 1.5–13 m/s. Ball at rest when speed < 0.05.

## Modes
- **Quick Round**: 9 holes from a kingdom (random seed) — pick kingdom, 1 or 2 players.
- **Career**: kingdoms unlock in order; stars per hole (3★ = under par, 2★ = par, 1★ = finish);
  need 14★ to unlock the next kingdom. Coins per hole by result.
- **Daily Course**: same seed for everyone per calendar day (UTC), 9 holes mixed kingdoms,
  one attempt scored; posts to leaderboard `crazy-golf-kingdom` (points, higher = better).
- **2P hot seat**: alternate shots per hole; scorecard shows both.

## Scoring / economy
- Points per hole: hole-in-one 500, eagle 350, birdie 200, par 100, bogey 50, worse 10.
- Coins = points/10 (career + quick). Shop: ball skins (8), trail colors, flag styles.
- Save: localStorage `cgk_save_v1` (career stars, coins, skins, settings, daily best).

## Controls
- Mouse/touch: press on or near the ball and drag away (slingshot). Arrow shows direction,
  ring fills with power. Release to hit. Drag back onto the ball to cancel.
- Right-drag / two-finger drag: orbit camera. Wheel/pinch: zoom. Camera auto-follows.
- Keyboard: ←/→ rotate aim, hold SPACE to charge, release to hit. R = replay flyover.

## Testing
- `node test/physics.test.mjs` — collisions, friction stop, cup capture, lip-out, ramps,
  bumpers, water reset, determinism.
- `node test/coursegen.test.mjs` — 500 seeded holes: path connectivity, tee/cup distinct,
  par in range, ghost golfer completes every hole ≤ par+3, obstacles never on tee/cup.
- Browser: `window.__cgk` hook exposes state for headless/DevTools checks.

## Assets
- `cover.png` Meshy nano-banana-pro key art (cropped from the case-mockup output).
- `models/*.glb` Meshy text-to-3D (preview 20 + refine 10 credits each, target 6k tris).

## Open questions for playtest
- Power curve feel (is max power too strong on short holes?).
- Windmill timing readability; cannon target readability.
- Whether Noah wants a "kid mode" (unlimited strokes, no water penalty).
