# TANK WARS — design + dev notes

_Renamed from "Tank Bros" 2026-07-01 (user request); cover art replaced with user-made
TankWars.png (original at D:\ImagineX\TankWars.png; shipped as compressed cover.jpg).
Ids/keys renamed: gameId tank-bros→tank-wars, localStorage tankbros_*→tankwars_*._

Classic maze-tank duel (Tank Trouble / Atari Combat lineage), built 2026-07-01 as a
single-file canvas game for ImagineX. The niche it fills on the shelf: a **same-keyboard
2-player versus game** (dad vs kid), with a solo vs-AI mode.

## Rules
- Top-down maze arena (15×10 cells, thin walls, recursive-backtracker + ~20 extra
  openings for loops). New maze every round.
- Tank controls: rotate + drive. Shells **bounce off walls** and kill ANY tank —
  including your own. Max 4 live shells per tank, 0.36s fire cooldown.
- Round ends on a kill (mutual kill = DRAW, no score). **First to 5 rounds wins.**
- **Sudden death** at 26s: walls crumble every 1.4s until the arena opens up (anti-camping).
- Power-ups (one on field at a time, every 6.5–10s, despawn 12s):
  - ▲ **TRIPLE** — 3-way spread (8s)
  - ⚡ **RAPID** — 0.13s cooldown, faster shells, +7 shell cap (8s)
  - ⬤ **SHIELD** — blocks one hit
  - ■ **BIG SHOT** — single fat slow shell that smashes through 2 walls and eats enemy shells

## Controls
- **INSTANT directional drive** (v1.2, 2026-07-01): press where you want to go (8-way) and
  the tank moves that way THE SAME FRAME — the hull swivel is cosmetic (HULL_SNAP 11 rad/s,
  aligns in ~0.15s) and never gates movement. Plus Pac-Man-style **corner assist**: when a
  wall mostly blocks you but an opening is ≤26px to the side (probe ladder 9/17/26px at
  TANK_R-2), the tank auto-slides into it — doorways don't demand pixel alignment.
  History: v1.0 rotate-to-steer → "hard to drive"; v1.1 auto-rotate-then-drive → still
  arced/swooped ("turns weird") because movement waited on alignment. v1.2 = movement
  follows input instantly; only the sprite turns. AI unchanged (TANK_ROT 5.2 = its aim
  limiter). Aiming = facing = last direction pressed.
- P1 (amber): WASD + Space/F · P2 (teal): Arrows + Enter/M
- Touch (solo): left half = steer toward finger, right half = fire
- P pauses; auto-pause on window blur
- v1.1 physics: full-normal iterative wall pushout (was per-axis) — wall end-caps at
  doorways used to snag the hull (repro: tight-hug doorway test traveled 43/225px;
  now 207/225). TANK_R 14→13 for forgiveness.

## Modes
- 1 Player vs AI: **Rookie** (slow reactions, aim error, no dodging) / **Ace**
  (fast, leads moving targets, dodges incoming shells, grabs nearby power-ups).
  Menu offers Rookie/Ace directly (flattened when 2P was removed).
- AI: BFS pathing over the maze grid @0.4–0.7s repath, line-of-sight raycast
  (segment-vs-wall-rect slab tests) gating fire.
- ~~2 Players same keyboard~~ REMOVED 2026-07-01 (user: "don't think we'll play on the
  same keyboard"). The seat-2 plumbing (scheme param, twoPlayer flag, teal-player
  branches) is left DORMANT on purpose — the eventual wish is **networked 2P on
  different devices** (bigger lift: needs a relay server / WebRTC + rooms; revisit
  as its own project). Both key sets (WASD + arrows) now drive the solo tank.

## Tech
- Single index.html, IIFE, fixed 60Hz timestep (accumulator; Bloot lesson), canvas
  at devicePixelRatio, CSS-scaled to fit.
- Shell movement substepped (≤4px/step) so bounces never tunnel walls; tank-wall
  resolution split per-axis for sliding.
- Procedural WebAudio SFX (fire/bounce/boom/powerup/countdown/fanfare), mute button
  top-right (console exit-bar owns the top-LEFT hover zone — keep it clear).
- Score reporting: cumulative human **match wins** in localStorage `tankwars_wins`,
  posted as `{type:'imaginex-score', gameId:'tank-wars', score}` on match victory
  (any human winner: P1 in solo, either player in 2P).
- `?demo=1` auto-starts an AI-vs-AI match (headless screenshot hook).

## Progression (v2.0, 2026-07-01 — user request: "something to earn")
- **SCRAP economy:** +10/round won, +2/round otherwise, match bonus 50 (Rookie) / 100 (Ace);
  campaign battles pay one-time rewards 30→150 (replays 25%). Saved in localStorage
  `tankwars_profile` {scrap, owned, tank, stars, done}.
- **GARAGE — 5 tanks** (sidegrades; enemy AI uses them too): Scout (free, classic),
  Mammoth 150 (slow, fat shell smashes 1 wall), Viper 400 (fast, rapid darts die after
  2 bounces, 6-shell cap), Pinball 800 (shells ×1.18 speed per bounce, cap 430, 13s life),
  Photon 1500 (hitscan laser: raycast + one reflection, 1.15s reload; AI photons get
  2.4× fire-delay so they don't beam-spam).
- **CAMPAIGN — 10 battles**, first-to-3, sequential unlock, stars (3=flawless 3-0, 2=3-1,
  1=won): Boot Camp → Scrapyard → Pillar Park → The Long Halls → Demolition → Snake Pit →
  Pinball Wizard → Crossfire → Lights Out → THE GENERAL. New OFFICER AI tier between
  Rookie/Ace (AI_LEVELS params: repath/dodge/lead/aimErr/fire timing).
- **Arenas:** maze (classic), dense (8 loop-openings), pillars (open + scattered stubs),
  corridors (long halls + gaps; stubs placed with connectivity-check-and-revert — raw gen
  was 97% disconnected before that fix), shifting (THE GENERAL: every 6s walls crumble AND
  regrow, connectivity + tank-overlap checked before each regrow).
- Quick Play unchanged (first-to-5, rookie/ace) and pays scrap too.
- Screenshot hooks: `?demo=1` (AI match), `?screen=garage`, `?screen=campaign`.

## Testing
- Headless node harness (scratchpad `tanktest.js`, technique per imaginex memory):
  21 checks — maze connectivity (20 mazes × all 150 cells), wall containment under
  30s random driving, shell bounce/bounds, full match to 5 with postMessage +
  localStorage, 60s AI-vs-AI soak, power-up pickup/effects, sudden-death crumble.
  All passing at ship time.
