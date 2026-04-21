# Froggo Adventure — Design Spec

**Game ID:** `froggo-adventure`
**Version:** 0.5
**Last updated:** 2026-04-20
**Platform:** ImagineX Console (web, iframe-embedded). Works on desktop (keyboard) and mobile (on-screen touch controls).

## Premise

A 2D side-scrolling action-platformer inspired by 16-bit Sonic the Hedgehog. The hero is **Froggo**, a pixel-art frog in red sneakers who runs, jumps, and rolls through the swampy Lily Pond to collect golden water droplets and defeat the mechanical minions of **Dr. Slither**, a cyber-snake who has been draining the pond dry.

The play feel target: momentum-driven platforming where speed is earned, jumps are variable-height, and rolling down slopes accelerates Froggo into a damage-dealing spin attack.

## Cast

| Role | Name | Description |
|---|---|---|
| Hero | **Froggo** | Pixel frog, yellow belly, red sneakers. Rendered from `froggo.png`. |
| Enemy grunt | **Bugbot** | Small hovering mosquito-robot. One hit from a rolling/jumping Froggo kills it; a ground-contact with Froggo costs the player droplets. |
| Heavy enemy | **Heavy Bugbot** | Armored, 2 HP, requires two hits with a 250 ms i-frame between. Red/armored visor. |
| Turret | **Zapper** (Zone 2) | Stationary purple turret. Fires a cyan plasma bolt at Froggo's side every ~2.2 s. Killable by stomp or roll; rolling Froggo cancels incoming projectiles. |
| Electrified patroller | **Shockbot** (Zone 2) | Purple bot with antennae. Cycles between electrified (2.0 s) and dormant (1.5 s). Hittable only while dormant; any contact while electrified hurts Froggo. |
| Boss (Zone 1) | **Bogmech** | 3 HP hover-dive boss in a locked arena at the end of Lily Pond Act 2. |
| Boss (Zone 2) | **Slithertron** | 4 HP cyber-snake boss with a 4-segment trailing body. Head is vulnerable; body segments damage Froggo on contact (roll makes body contact safe). |
| Villain | **Dr. Slither** | Cyber-snake mastermind. Slithertron is his prototype; the full Dr. Slither fight is still reserved for a later zone. |

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
- **Bugbot (basic)** — `24×24 px` hitbox, 1 HP. Hover-patrol within a patrol range. Killed by a single stomp (downward) or roll. Contact otherwise costs droplets.
- **Bugbot (heavy)** — `36×36 px` hitbox, **2 HP**, slower speed, dark-red armored body with yellow visor. Requires two hits (with ~250 ms i-frame between hits so a single stomp can't consume both HP). Appears only in Act 2.
- **Bogmech (boss)** — `60×48 px` hitbox, 3 HP. Hovers in an arena at the end of Act 2, periodically winds up and dives toward Froggo's position. Damaged by stomp/roll; contact otherwise hurts Froggo. HP bar + "BOGMECH" label rendered above. Arena locks behind Froggo once he enters.
- **Droplet** — `16×16 px` pixel-art golden teardrop. Worth +10 score. Player starts with 0 droplets. Getting hit scatters up to 16 droplets in an upward arc; they bounce with gravity on the ground and can be recollected within ~4.5 s (blink in the final ~1.5 s before disappearing). Any droplets beyond 16 at the time of hit are lost, matching Sonic ring-loss behavior.
- **Spring** — `32×16 px` pad. On contact, gives -1600 px/s vertical velocity (~711 px launch height). Camera pans upward to keep Froggo visible during flight.
- **Goal arch** (Act 1 only) — triggers end-of-act transition, not the full win cinematic. Shows "ACT 1 CLEAR!" card followed by the "ACT 2" title slam.

## Damage & death

- Hit by Bugbot with droplets ≥ 1 → up to 16 droplets scatter in an upward arc, count reset to 0, 1.2 s invulnerability (flashing). Scattered droplets can be re-collected for ~4.5 s (blinking near the end).
- Hit by Bugbot at 0 droplets → die, respawn at level start (MVP: single checkpoint).
- Fall into water pit → die (frogs can't swim in acid — Dr. Slither polluted it).

## Spin Dash

- Hold `↓` while grounded and stationary to enter the **charging** state. Froggo locks position and spins in place; a pulsing dust cloud + charge bar render above him.
- Each press of `Jump` (Space / Up / W, or **JUMP** on mobile) adds one rev, up to `SPINDASH_MAX_REVS = 6`. Each rev plays a rising "vrrrm" SFX.
- Releasing `↓` launches Froggo in the facing direction at speed `SPINDASH_BASE + chargeLevel * SPINDASH_PER_REV` (420–720 px/s), enters the rolling state, and plays a launch whoosh.
- Launching while airborne or moving is impossible — entry requires `|vx| < 30` and `grounded`.

## Zones and acts

Zones contain multiple **Acts** played back-to-back. Beating the final act of a zone triggers the full zone-clear cinematic and submits the combined score to the leaderboard. Beating a non-final zone unlocks the next zone — the clear screen prompts the player to advance directly, and the title screen exposes a **zone picker** once more than one zone is unlocked (also accessible via number keys `1` / `2`). Zone unlock progress is persisted in `localStorage` under `froggo.zonesUnlocked`.

### Zone 1 — Lily Pond Zone

| Act | Theme | Width | Key features |
|---|---|---|---|
| 1 | Morning swamp | 4800 px | Two springs, 4 basic Bugbots, secret caches. Ends at a stone goal arch. |
| 2 | Sunset swamp | 6200 px | Longer level, trickier platforming, 3 Heavy Bugbots, 4 basic Bugbots, 3 springs, boss arena at the end. Palette shifts to purple/orange. Ends with **Bogmech boss** (3 HP, hover + dive pattern). |

### Zone 2 — Cyber Swamp Zone

Dr. Slither's industrial outpost carved into the poisoned swamp. Metal-plate ground, neon seams, distant antenna cities, oil-slick water. New hazards: **spike strips** and **sawblades** (environmental, can't be killed), plus the **Zapper** and **Shockbot** enemies. Every act includes exactly **one mid-level checkpoint totem** — touching it stores a respawn point; losing a life respawns at the last activated checkpoint instead of the act start. Checkpoint state resets on act transition.

| Act | Theme | Width | Key features |
|---|---|---|---|
| 1 | Cyber Swamp, Dawn | 7500 px | Deep teal/purple palette, cyan neon seams. 5 basic Bugbots, 3 Zappers, 2 spike strips, 2 sawblades, 3 springs, 1 checkpoint at `x ≈ 3340`. Ends at a goal arch. Target time: 120 s. |
| 2 | Cyber Swamp, Core | 9500 px | Magenta/ultraviolet palette. 4 basic + 3 Heavy Bugbots, 4 Zappers, 3 Shockbots, 3 spike strips, 3 sawblades, 4 springs, 1 checkpoint at `x ≈ 5000`. Boss arena locks at `x > 8400` for the **Slithertron** fight (4 HP, serpent body chain). Target time: 180 s. |

### Zone music

- **Zone 1:** `audio/Froggo_Act1.mp3`, looped via an `<audio id="bgm">` element at volume `0.6`.
- **Zone 2:** `audio/Froggo_Act2_Cyber_Swamp.mp3`, looped via a second `<audio id="bgm2">` element at volume `0.6`.
- Switching zones pauses one `<audio>` element and plays the other via `setZoneMusic(zoneIdx)` / `startMusic()`.
- A WebAudio-synthesized chiptune loop (126 BPM, C minor, saw bass + square lead + synth drums) remains in the code as an automatic **fallback** — it only kicks in if `bgm2.play()` fails at runtime. It does not play when the MP3 is present and loads successfully.

### Between-act transition

On Act 1 goal: dim backdrop → "ACT 1 CLEAR!" with per-stat breakdown and act score (~1.8s) → slam-in "ACT 2" title card + total-so-far (~2.4s) → Act 2 loads with fresh Froggo position and the sunset palette. HUD shows `A1:nnn Σ:nnn` (this act's score, running total).

### Zone clear

Beating the Bogmech in Act 2 triggers the full zone-clear cinematic (white flash → rainbow ring → fireworks → "ZONE CLEAR!" slam → score tally with `totalZoneScore`). Leaderboard submission fires only at this point — no submission after Act 1.

## Level 1 — "Lily Pond Zone Act 1"

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
├── SPEC.md                       # This file
├── index.html                    # Game (single file, self-contained)
├── froggo.png                    # Hero sprite (1024×1024 RGBA, transparent bg)
├── froggo-run-{1..4}.png         # Run-cycle frames
├── froggo-jump-{1..7}.png        # Jump-cycle frames
├── title.png                     # Title-screen background art
├── cover.png                     # Cartridge cover (1024×1536)
└── audio/
    ├── Froggo_Act1.mp3           # Zone 1 looped background music
    └── Froggo_Act2_Cyber_Swamp.mp3  # Zone 2 looped background music
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
- [x] Two-act zone structure (Act 1 + Act 2 with transition card)
- [x] Heavy Bugbot variant with 2 HP
- [x] Sunset palette for Act 2 (sky bands, hills, clouds, reeds)
- [x] End-of-zone boss (Bogmech: hover + dive, 3 HP)
- [x] Boss arena locking, leaderboard submission gated to zone clear
- [x] **Zone 2 — Cyber Swamp** (two acts, longer + harder than Zone 1)
- [x] **Cyber palettes** (`cyber-dawn`, `cyber-core`): dark sky bands, magenta/cyan neon, blinking city lights, satellite, metal-plate ground with rivets, neon platform status lights, antenna-tipped hills, satellite-dish trees
- [x] **New hazards**: spike strips (static) and rotating sawblades (patrolling)
- [x] **Zapper enemy** with cyan plasma projectiles (killable by stomp/roll; roll also cancels projectiles)
- [x] **Shockbot enemy** with periodic electric field (vulnerable only when dormant)
- [x] **Slithertron boss** — 4 HP, 4-segment serpent body trailing the head. Head vulnerable, body deals damage
- [x] **Checkpoint totems** — one mid-level per Zone 2 act, persistent respawn across lives within an act
- [x] **Zone progression** — Zone 1 clear unlocks Zone 2, `localStorage`-persisted, title screen zone picker, post-clear prompt advances directly to next zone
- [x] **Zone intro card** — "ZONE N" slam-in between zones
- [x] **Zone 2 music** — `Froggo_Act2_Cyber_Swamp.mp3` looped via a dedicated `<audio id="bgm2">` element, with a WebAudio-synthesized chiptune loop retained as an automatic fallback if the MP3 fails to load

## Out of scope for now

- Zones beyond Cyber Swamp
- Full Dr. Slither boss fight (Slithertron is the prototype)
- Multi-frame sprite animation (idle blink, run cycle, jump pose) — currently procedural transforms on single PNG
- Shield / power-up items
- Second playable character
- Chaos-emerald-style bonus stages
- Cyber-themed goal-arch variant (Zone 2 Act 1 still uses the nature-green arch visuals)

## Next candidates (ordered)

1. Zone 3 — new biome (ice cavern? factory interior?) with unique enemies and boss.
2. Dr. Slither full boss fight.
3. Power-up: shield droplet (one-hit protection).
4. Cyber-themed goal-arch visuals for Zone 2 Act 1.
5. Additional checkpoints on longer acts / tuning pass on Zone 2 difficulty.
