# Froggo Adventure — Design Spec

**Game ID:** `froggo-adventure`
**Version:** 0.2
**Last updated:** 2026-04-19
**Platform:** ImagineX Console (web, iframe-embedded). Works on desktop (keyboard) and mobile (on-screen touch controls).

## Premise

A 2D side-scrolling action-platformer inspired by 16-bit Sonic the Hedgehog. The hero is **Froggo**, a pixel-art frog in red sneakers who runs, jumps, and rolls through the swampy Lily Pond to collect golden water droplets and defeat the mechanical minions of **Dr. Slither**, a cyber-snake who has been draining the pond dry.

The play feel target: momentum-driven platforming where speed is earned, jumps are variable-height, and rolling down slopes accelerates Froggo into a damage-dealing spin attack.

## Cast

| Role | Name | Description |
|---|---|---|
| Hero | **Froggo** | Pixel frog, yellow belly, red sneakers. Rendered from `froggo.png`. |
| Enemy grunt | **Bugbot** | Small hovering mosquito-robot. One hit from a rolling/jumping Froggo kills it; a ground-contact with Froggo costs the player droplets. |
| Villain | **Dr. Slither** | Cyber-snake mastermind. Not yet appearing in Act 1 — reserved for later levels / boss fight. |

## Controls

| Input | Action |
|---|---|
| `←` / `→` or `A` / `D` | Move left / right |
| `Space` or `↑` or `W` | Jump (variable height — longer hold = higher jump) |
| `↓` or `S` while moving | Roll (tuck into spin; damages Bugbots, accelerates on downhills) |
| `↓` (held) + tap `Space`/`↑` while stationary | **Spin Dash** — rev up then release `↓` to launch |
| `R` | Restart level |
| `Enter` on title screen | Start |

**Mobile/touch:** On-screen controls shown automatically on touch devices. Bottom-left: ◀ / ▶ movement buttons. Bottom-right: ROLL and JUMP buttons. Title/game-over/win screens accept any tap to start or restart. Canvas scales to fit the viewport while preserving the 4:3 aspect ratio (max 800×600 on desktop).

## Physics

Frame-rate independent, tuned for feel, not realism.

| Constant | Value | Purpose |
|---|---|---|
| Gravity | `1800 px/s²` | Pulls Froggo down |
| Walk accel | `1500 px/s²` | Ground accel when input held |
| Air accel | `400 px/s²` | Reduced control mid-air — stationary jumps don't drift far; running jumps keep full momentum |
| Max run speed | `360 px/s` | Terminal horizontal ground speed |
| Max roll speed | `640 px/s` | Faster cap while rolling / spin-dashing |
| Spin dash base | `420 px/s` | Launch speed at 0 revs |
| Spin dash per-rev | `+50 px/s` | Each charge-rev adds this much (cap 6 revs) |
| Friction (ground, no input) | `1200 px/s²` decel | Slows when not pressing direction |
| Roll friction | `400 px/s²` decel | Less slowdown while rolling |
| Jump impulse | `-680 px/s` | Initial vertical velocity on jump (~128 px max height) |
| Jump-cut multiplier | `0.5` | If jump released early, upward velocity halved |
| Coyote time | `80 ms` | Grace period to jump after leaving a ledge |
| Jump buffer | `100 ms` | Early jump press still registers if pressed just before landing |

**State machine:** `idle → run → jump/fall → land → roll → charging (spin-dash) → hurt → dead → goal`.

**Camera:** Follows Froggo horizontally with a smoothed lerp (`0.15`). Pans vertically **up** when Froggo rises above `y=180` (i.e., during a spring launch) and clamps at `camera.y = -360`. Background sky and clouds stay in screen space; hills / trees / reeds / ground all scroll together with the vertical camera so parallax stays coherent.

## Entities

- **Froggo** — hitbox `24×32 px`. Render 48×48 sprite centered on hitbox, squashed/rotated based on state.
- **Bugbot** — `24×24 px` hitbox. Hover-patrol within a platform's bounds. Dies when Froggo's velocity Y > 0 (falling onto it) OR while rolling. Contact otherwise costs 1+ droplet.
- **Droplet** — `16×16 px` pixel-art golden teardrop. Worth +10 score. Player starts with 0 droplets. Getting hit scatters up to 16 droplets in an upward arc; they bounce with gravity on the ground and can be recollected within ~4.5 s (blink in the final ~1.5 s before disappearing). Any droplets beyond 16 at the time of hit are lost, matching Sonic ring-loss behavior.
- **Spring** — `32×16 px` pad. On contact, gives -1600 px/s vertical velocity (~711 px launch height). Camera pans upward to keep Froggo visible during flight.
- **Goal flag** — triggers win state. White flash, screen shake, rainbow ring burst, fireworks, "STAGE CLEAR!" slam-in text, then the animated score tally panel.

## Damage & death

- Hit by Bugbot with droplets ≥ 1 → up to 16 droplets scatter in an upward arc, count reset to 0, 1.2 s invulnerability (flashing). Scattered droplets can be re-collected for ~4.5 s (blinking near the end).
- Hit by Bugbot at 0 droplets → die, respawn at level start (MVP: single checkpoint).
- Fall into water pit → die (frogs can't swim in acid — Dr. Slither polluted it).

## Spin Dash

- Hold `↓` while grounded and stationary to enter the **charging** state. Froggo locks position and spins in place; a pulsing dust cloud + charge bar render above him.
- Each press of `Jump` (Space / Up / W, or **JUMP** on mobile) adds one rev, up to `SPINDASH_MAX_REVS = 6`. Each rev plays a rising "vrrrm" SFX.
- Releasing `↓` launches Froggo in the facing direction at speed `SPINDASH_BASE + chargeLevel * SPINDASH_PER_REV` (420–720 px/s), enters the rolling state, and plays a launch whoosh.
- Launching while airborne or moving is impossible — entry requires `|vx| < 30` and `grounded`.

## Level 1 — "Lily Pond"

- Width: ~4800 px (≈6 screens), height: 720 px.
- Starts on solid ground. Gentle slopes, then **Spring 1** at `x=800` on the first plateau (launches onto the 500-px-wide floating secret platform at `y=300`), a Bugbot patrol, a droplet stash, a gap with a static lily pad stepping stone, a second Bugbot, an upper plateau with **Spring 2** at `x=2860` (launches onto the 620-px-wide upper secret platform at `y=240`), a downhill roll, and the **goal arch**.
- Target completion time: ~45–60 s.
- Secret droplets on both high platforms — only the springs reach them. Worth a combined ~210 points (about 1/3 of the level's total droplet score).

### Floating platforms

| # | Purpose | x, y, w, h |
|---|---|---|
| 1 | Secret cache (spring 1 target) | `x=900, y=300, w=500, h=16` |
| 2 | Pit stepping-stone lily pad | `x=1720, y=440, w=200, h=16` |
| 3 | Upper secret (spring 2 target) | `x=2880, y=240, w=620, h=16` |

### Goal arch

`x=4560, y=340, w=140, h=180`. Stone archway with vine-wrapped pillars, curved crossbar, gold crown on top, swirling green portal inside, sparkle stars, and a "GOAL" plaque. Triggers the win cinematic when Froggo's body enters the inner arch volume.

## Scoring

`score = (droplets × 10) + max(0, timeBonus) + (bugbotsDefeated × 50)`

- `timeBonus = max(0, (90 − levelTimeSec) × 20)` — finishing in 30 s yields +1200.
- Score submitted to leaderboard when player touches the goal flag.

## Leaderboard integration

On level complete, game sends:
```js
window.parent.postMessage(
  { type: 'imaginex-score', gameId: 'froggo-adventure', score, nickname: 'Player' },
  '*'
);
```

ImagineX parent forwards to `POST /api/leaderboard`. Requires adding `'froggo-adventure'` to the `KNOWN_GAMES` set in `src/app/api/leaderboard/route.ts`.

## Rendering approach

- HTML5 Canvas, **`800 × 600` internal resolution** with CSS `image-rendering: pixelated` upscaling. Canvas is responsive: `#wrap` sizes to `min(100vw, 100vh * 4/3, 800px)` on each axis, so the same internal coordinates work on desktop (full 800×600) and mobile (scaled down while preserving 4:3).
- Visual style: **16-bit pixel-art**. No anti-aliased circles in background or entities. Hard edges throughout.
  - **Sky**: 6 stepped color bands (no smooth gradient), 2-px dithered pixel checkerboards between bands.
  - **Clouds**: chunky solid-white rectangles with a one-row shadow underneath, slow parallax (`0.12×`) on X only — stay pinned in screen-space Y.
  - **Distant hills**: stepped pyramid silhouettes built from rectangles, single-column pixel highlight on one side. Parallax `0.25×`.
  - **Mid-layer trees**: silhouetted pines (rectangle foliage layers), parallax `0.35×`.
  - **Reeds**: three-stalk clusters with lighter pixel tips, parallax `0.5×`.
  - **Ground**: tile-based rendering — 4-px-wide grass strip in 3 tonal layers (highlight / main / shadow), dirt fill with dithered dark-pixel texture and scattered pebbles, grass tufts every 32 px. All culled to camera view for perf.
  - **Water**: flat base color, 2-px dithered highlight band, wave-top pixel shimmer.
  - **Lily pads**: built from rectangles with vein pattern and a pixel flower (not ellipses).
  - **Droplets**: pixel-art stepped teardrop with 2-px highlight and shadow dots; periodic pixel sparkle.
  - **Bugbots**: chunky rectangular bodies, pixel visor eye, stepped-rectangle stinger, flat rectangle flapping wings.
  - **Spring pads**: red base + red coils + pink pad top with white highlight pixel.
  - **Goal arch**: hand-built from rectangles (pillars, curved top, vines, crown, portal disk).
- Froggo sprite: drawn from `froggo.png` (1024×1024 transparent RGBA) at 48×48 canvas pixels with `imageSmoothingEnabled=false`. Applied procedural effects:
  - **Running**: small rotational tilt proportional to velocity, Y-bob sine wave.
  - **Jumping/rolling**: 360° rotation at rate proportional to horizontal speed (classic Sonic ball-roll).
  - **Landing**: X-stretch/Y-squash for 120 ms.
  - **Hurt**: flashing transparency.
- Win cinematic (in-canvas): white flash → rainbow-ring explosion → "STAGE CLEAR!" slam-in → sliding score-tally panel with per-tick "ding" SFX → pulsing total reveal → "PRESS R / TAP TO PLAY AGAIN" prompt. Screen-shake applied for the first 360 ms.

## Audio

- **Music:** `audio/Froggo_Act1.mp3`, looped, volume `0.6`. Starts on the first `Enter` press or first touch/click (autoplay-safe). Continues across restart.
- **SFX:** All synthesized procedurally via WebAudio — no audio files needed. Events: `jump`, `droplet pickup`, `spring`, `bugbot squish`, `hurt`, `goal`, `rev` (spin-dash charge), `launch` (spin-dash release), `tick` (score tally ka-ching), `firework` (celebration burst).

## File layout

```
public/games/froggo-adventure/
├── SPEC.md                 # This file
├── index.html              # Game (single file, self-contained)
├── froggo.png              # Hero sprite (1024×1024 RGBA, transparent bg)
├── cover.png               # Cartridge cover (1024×1536)
└── audio/
    └── Froggo_Act1.mp3     # Looped background music
```

## Already implemented (cumulative)

- [x] Single playable level ("Lily Pond")
- [x] Momentum-driven physics (run, variable-height jump, roll)
- [x] Droplets, Bugbots, springs, goal arch
- [x] Leaderboard integration via `postMessage` → `/api/leaderboard`
- [x] 16-bit pixel-art visual pass (stepped sky, tiled ground, chunky entities)
- [x] Music + full SFX suite (WebAudio-synthesized)
- [x] Sonic-style droplet scatter-on-hit with recovery window
- [x] Spin dash charge-and-release
- [x] Mobile/touch controls + responsive canvas
- [x] Vertical camera follow for tall spring launches
- [x] Cinematic win sequence (flash, rainbow ring, fireworks, slam-in text, tallying score panel)

## Out of scope for now

- Multiple zones / levels beyond Lily Pond
- Boss fight with Dr. Slither
- Checkpoints mid-level
- Multi-frame sprite animation (idle blink, run cycle, jump pose) — currently procedural transforms on single PNG
- Shield / power-up items
- Second playable character
- Chaos-emerald-style bonus stages

## Next candidates (ordered)

1. Second level — "Cyber Swamp" with new hazards and Bugbot variants.
2. Proper multi-frame run-cycle animation (request 3 extra Froggo pose PNGs).
3. Dr. Slither boss fight at end of level 2 or 3.
4. Power-up: shield droplet (one-hit protection).
5. Checkpoint totems mid-level.
