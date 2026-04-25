# Froggo Adventure — Design Spec

**Game ID:** `froggo-adventure`
**Version:** 0.8
**Last updated:** 2026-04-25
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
| Boss (Zone 1) | **Bogmech** | 4 HP hover-dive boss in a locked arena at the end of Lily Pond Act 2. Drops into an **enraged phase** at ≤ half HP: red pulsing aura, darker armor, white-flashing eye, shorter hover/wind-up windows, faster and more aggressive player-tracking dives. |
| Boss (Zone 2) | **Slithertron** | 4 HP cyber-snake boss with a 4-segment trailing body. Head is vulnerable; body segments damage Froggo on contact (roll makes body contact safe). Aggressive attack pattern: glides 2.4s biased toward Froggo's x, winds up 0.55s with continuous target re-lock, then dives with homing acceleration (up to 400 px/s lateral) so the dive adjusts mid-air instead of following a fixed arc. |
| Boss (Zone 3, planned) | **Yeti Mech** | 5 HP bipedal mech boss at the end of Crazy Mountain Zone Act 2 (temple). Planned attacks: ground-pound shockwave (jump to dodge), ice-boulder lob (side-step), horizontal charge (climb a wall to escape — ties the climb mechanic into the boss fight). Enraged phase at ≤ half HP. Not yet implemented. |
| Villain | **Dr. Slither** | Cyber-snake mastermind. Slithertron is his prototype; the full Dr. Slither fight is reserved for the final zone (Zone 6). |
| Enemy (Zone 3, planned) | **Snowroller** | Rolling snowball enemy for Crazy Mountain Act 1. Rolls along the ground and accelerates on downhill slopes. 1 HP, killed by stomp/roll from above. Not yet implemented — Zone 3 Act 1 currently uses Bugbots as placeholder enemies. |

## Controls

| Input | Action |
|---|---|
| `←` / `→` or `A` / `D` | Move left / right |
| `Space` or `↑` or `W` | Jump (variable height — longer hold = higher jump) |
| `↓` or `S` while moving | Roll (tuck into spin; damages Bugbots, accelerates on downhills) |
| `↓` (held) + tap `Space`/`↑` while stationary | **Spin Dash** — rev up then release `↓` to launch |
| `→` or `←` into a climb wall while airborne | **Cling** — Froggo grabs the wall (Zone 3+) |
| While clinging: default | Auto-ascend up the wall |
| While clinging: `↓`/`S` (or ROLL on mobile) | Descend the wall |
| While clinging: `Space` (or JUMP on mobile) | Wall-jump — releases with horizontal kick away from wall |
| While clinging: press away from wall | Release and fall |
| `R` | Restart level. After a zone-clear screen, `R` advances to the next zone if one is unlocked. |
| `Enter` on title screen | Start Zone 1 |
| `1` / `2` / `3` on title screen | Jump directly into a zone (only shown once unlocked) |

**Mobile/touch:** On-screen controls shown automatically on touch devices. Bottom-left: ◀ / ▶ movement buttons. Bottom-right: ROLL and JUMP buttons. Title/game-over/win screens accept any tap to start or restart. Canvas scales to fit the viewport while preserving the 4:3 aspect ratio (max 800×600 on desktop).

## Physics

Frame-rate independent, tuned for feel, not realism.

| Constant | Value | Purpose |
|---|---|---|
| Gravity | `1800 px/s²` | Pulls Froggo down |
| Walk accel | `1500 px/s²` | Ground accel when input held |
| Air accel | `650 px/s²` | Mid-air control (tuned up 2026-04-23 so the player can actively steer jumps — previously 400) |
| Max run speed | `320 px/s` | Terminal horizontal ground speed (tuned down from 360 on 2026-04-23 to tighten jump arcs while still clearing every 200 px gap with margin) |
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
- **Bogmech (boss)** — `60×48 px` hitbox, 4 HP. Hovers in an arena at the end of Zone 1 Act 2, periodically winds up and dives toward Froggo's position. Damaged by stomp/roll (contact otherwise hurts Froggo via the stinger band). HP bar + "BOGMECH" label rendered above. Arena locks behind Froggo once he enters. Enters an **enraged phase** when HP ≤ `ceil(maxHp/2)` — hover window drops from 1800 → 1000 ms, wind-up from 520 → 380 ms, dive initial velocity 480 → 560, gravity 1450 → 1700, player-tracking factor 0.9 → 1.15 (cap 300 px/s), hover sway 96 → 130 px. Visual: red pulsing aura, blood-red armor tint, white-flashing eye.
- **Slithertron (boss)** — `40×28 px` head hitbox + 4 trailing body segments (`28×24 px` each, sampled from a position-history trail at a 12-frame offset). 4 HP. Attack pattern (retuned 2026-04-23): glides 2.4s biased toward Froggo's current x (so wind-ups start above him), winds up 0.55s while continuously re-locking target and sliding toward it, then dives with gravity 1300, initial horizontal 280 px/s plus lateral homing acceleration (cap 400 px/s). Head is the only vulnerable part; body segments damage Froggo on contact *unless* Froggo is rolling.
- **Droplet** — `16×16 px` pixel-art golden teardrop. Worth +10 score. Player starts with 0 droplets. Getting hit scatters up to 16 droplets in an upward arc; they bounce with gravity on the ground and can be recollected within ~4.5 s (blink in the final ~1.5 s before disappearing). Any droplets beyond 16 at the time of hit are lost, matching Sonic ring-loss behavior.
- **Spring** — `32×16 px` pad. On contact, gives -1600 px/s vertical velocity (~711 px launch height). Camera pans upward to keep Froggo visible during flight.
- **Climb wall** (Zone 3+) — solid rectangular block with handhold pick-marks on both faces. Froggo collides with it normally from any direction (can land on top, blocked walking into side, bonk head underneath). Additionally, while airborne Froggo can **cling** to either face by pressing the direction INTO the wall; see the **Climb mechanic** section. Rendered as slate-blue stone with lighter-blue pick-marks every 28 px.
- **Goal arch** (Act 1 only) — triggers end-of-act transition, not the full win cinematic. Shows "ACT 1 CLEAR!" card followed by the "ACT 2" title slam.

## Damage & death

- Hit by any enemy/hazard with droplets ≥ 1 → up to 16 droplets scatter in an upward arc, count reset to 0, 1.2 s invulnerability (flashing). Scattered droplets can be re-collected for ~4.5 s (blinking near the end).
- Hit by any enemy/hazard at 0 droplets → die.
- Fall into water pit → die (frogs can't swim in acid — Dr. Slither polluted it).

## Lives & 1UP

- Player starts each game with `MAX_LIVES = 3` lives.
- On death: life `-1`.
  - If lives remain: brief "OUCH!" respawn card, then reload the current act. In Zone 2, respawn position is the last **activated checkpoint totem** (if any); otherwise, the act start. Accumulated `totalZoneScore` is preserved; the act's own droplet count is reset to zero.
  - If lives are exhausted: full "GAME OVER" screen. Press `R` / tap to fully reset (Zone 1 Act 1, lives refilled).
- **1UP at every 100 droplets** (`DROPLETS_PER_1UP = 100`): each time `dropletScore` crosses a multiple of 100 during a pickup, lives go up by 1 (capped at `LIVES_CAP = 9`). A 5-note rising "1UP!" fanfare plays (`sfxOneUp`) and a bouncy green "1 UP!" banner animates near the top of the canvas for ~1.8 s. Re-collecting scatter-dropped droplets counts toward the same threshold.
- **HUD lives display:** heart icons (`♥ ♥ ♥`) for 1–3 lives; compact `♥×N` form for 4+ lives so the bar never overflows.

## Spin Dash

- Hold `↓` while grounded and stationary to enter the **charging** state. Froggo locks position and spins in place; a pulsing dust cloud + charge bar render above him.
- Each press of `Jump` (Space / Up / W, or **JUMP** on mobile) adds one rev, up to `SPINDASH_MAX_REVS = 6`. Each rev plays a rising "vrrrm" SFX.
- Releasing `↓` launches Froggo in the facing direction at speed `SPINDASH_BASE + chargeLevel * SPINDASH_PER_REV` (420–720 px/s), enters the rolling state, and plays a launch whoosh.
- Launching while airborne or moving is impossible — entry requires `|vx| < 30` and `grounded`.

## Climb mechanic (Zone 3+)

Introduced in Zone 3 (Crazy Mountain). Froggo can cling to designated **climb walls** and scale them vertically, drawing on a grip meter.

| Constant | Value | Purpose |
|---|---|---|
| `CLIMB_SPEED` | `160 px/s` | Vertical movement while clinging |
| `CLIMB_JUMP_V` | `-640 px/s` | Vertical impulse on wall-jump (slightly less than a ground jump) |
| `CLIMB_WALL_KICK` | `340 px/s` | Horizontal kick AWAY from wall on wall-jump |
| `GRIP_MAX` | `2.5 s` | Total cling time at full grip |
| `GRIP_DRAIN_PER_SEC` | `1.0` | Drain rate while clinging |
| `GRIP_RECOVER_GROUND` | `5.0` | Fast recovery while grounded |
| `GRIP_RECOVER_AIR` | `0.3` | Slow recovery mid-air (prevents spamming climb-jump-climb) |
| `CLIMB_RELEASE_COOLDOWN` | `200 ms` | Cannot re-cling immediately after release |

**Cling trigger:** Airborne, overlapping a climb wall (hitbox extended by 2 px horizontally), pressing the direction INTO the wall, with `grip > 0.05` and past the release cooldown. On trigger, Froggo snaps to the wall edge, `vx/vy` zero out, `climbing = true`, and `facing` flips toward the wall.

**While clinging:**
- Default behavior is **auto-ascend** (Froggo climbs up at `CLIMB_SPEED` with no input). Held `↓`/`S` (or **ROLL** on mobile) descends at the same rate.
- Grip drains at `GRIP_DRAIN_PER_SEC` regardless of vertical direction.
- Pressing away from the wall releases (Froggo falls, cooldown starts).
- Pressing **Space** (desktop) or **JUMP** (mobile) wall-jumps off with a horizontal kick and vertical impulse. On desktop, `ArrowUp`/`W` does NOT trigger jump while clinging (it's reserved as climb-up input so it reads intuitively); only `Space` triggers wall-jump from keyboard.
- Grip reaches zero → forced release.

**Mantle at top:** When Froggo is ascending and reaches the top of the wall, he auto-mantles — snapped onto the wall's top surface, centered, `grounded = true`, `vx/vy = 0`. From there he can walk or jump off either side like a normal platform.

**Solid collision:** Climb walls are two-way solid (unlike platforms). Walking into a wall's side is blocked; jumping up into the bottom bonks Froggo's head; falling onto the top lands normally. Collision resolution uses min-penetration direction, and runs AFTER ground-collision so "standing on top of a wall" doesn't get clobbered by the grounded=false reset.

**Rendering:** Climb walls render as slate-blue stone pillars with lighter-blue pick-mark handholds every 28 px on both faces, plus a darker shadow column on the right edge and a cap/base band. The visual contrast with regular ground tells the player this surface is climbable.

**HUD:** A canvas-rendered grip meter appears in the top-right corner only when grip is below full. It fills blue by default and turns amber when grip drops below 35 %.

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

### Zone 3 — Crazy Mountain Zone (in progress)

Snow-capped mountain exterior giving way to an ancient temple interior. Introduces the **climb mechanic** (see above) — certain walls must be scaled to progress. Two acts implemented; the **Yeti Mech** boss is still TBD (Act 2 currently ends at a placeholder goal arch where the boss arena will be).

Palette `mountain-peak` (Act 1): pale blue sky gradient, white snow caps on ground tiles, slate-grey rocky hills, evergreen silhouettes, white clouds.

Palette `temple-depths` (Act 2): near-black ceiling fading to deep purple, dark-stone ground tiles with golden trim, dim purple hills/silhouettes, warm amber accents.

| Act | Theme | Width | Key features |
|---|---|---|---|
| 1 | Mountain Ascent | 9500 px | Mountain exterior. Terrain rises from `y=540` at the start to `y=180` at the true summit through slopes, pits, and **three mandatory climb walls** (`x=2600` h=160, `x=4600` h=160, `x=8500` h=140). One spring launches to a secret over the first pit; each climb wall has a reward platform directly above it. Mid-summit **checkpoint** at `x=6500`, then a descent into an icy ridge with a stepping stone bridging a crevasse, an approach plateau, the third climb wall, and a final ramp to the summit goal arch at `x ≈ 9320`. 7 basic + 3 Heavy Bugbots (placeholder until Snowroller). Target time: 220 s. |
| 2 | Temple Depths | 9500 px | Inside-the-mountain temple corridors with dark-stone tiles and golden trim. Three climb walls (`x=3800` h=120, `x=6600` h=120, `x=7300` h=80 optional shortcut), mid-corridor **checkpoint** at `x=4500`, four pit gaps bridged by stepping stones, optional upper-path platform past the checkpoint. 6 basic + 4 Heavy Bugbots (placeholder until Dart Trap and final boss enemies). Final corridor at `x > 8200` is reserved for the **Yeti Mech** boss arena; currently a placeholder goal arch sits at `x ≈ 9220`. Target time: 200 s. |

### Zone music

- **Zone 1:** `audio/Froggo_Act1.mp3`, looped via `<audio id="bgm">` at volume `0.6`.
- **Zone 2:** `audio/Froggo_Act2_Cyber_Swamp.mp3`, looped via `<audio id="bgm2">` at volume `0.6`.
- **Zone 3:** `audio/Crazy_Mountain_Zone3.mp3`, looped via `<audio id="bgm3">` at volume `0.6`.
- Switching zones pauses the inactive elements and plays the active one via `setZoneMusic(zoneIdx)` / `startMusic()`.
- A WebAudio-synthesized chiptune loop (126 BPM, C minor, saw bass + square lead + synth drums) remains in the code as an automatic **Zone 2 fallback** — it only kicks in if `bgm2.play()` fails at runtime. It does not play when the MP3 is present and loads successfully.

### Between-act transition

On Act 1 goal: dim backdrop → "ACT 1 CLEAR!" with per-stat breakdown and act score (~1.8s) → slam-in "ACT 2" title card + total-so-far (~2.4s) → Act 2 loads with fresh Froggo position and the sunset palette. HUD shows `A1:nnn Σ:nnn` (this act's score, running total).

### Zone clear

Beating the final act of a zone triggers the full zone-clear cinematic (white flash → rainbow ring → fireworks → slam-in title → score tally with `totalZoneScore`). Leaderboard submission fires only at this point — no submission after a non-final act.

- For a non-final zone, the title reads **"ZONE CLEAR!"** and the R-prompt reads **"PRESS R TO ENTER ZONE N+1"** (or `TAP TO ENTER ZONE N+1` on touch). A "★ ZONE N+1 UNLOCKED ★" banner appears above the score panel the first time the zone is cleared.
- For the final zone, the title reads **"GAME CLEAR!"** and the R-prompt reads **"PRESS R TO PLAY AGAIN"** / `TAP TO PLAY AGAIN`.

Starting the next zone takes the player through a **zone-intro card** ("ZONE N" slam-in, zone name + subtitle, ~3 s) before Act 1 begins. Act 1 loads with `totalZoneScore = 0`.

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

- **Music:**
  - Zone 1: `audio/Froggo_Act1.mp3`, looped via `<audio id="bgm">` at volume `0.6`.
  - Zone 2: `audio/Froggo_Act2_Cyber_Swamp.mp3`, looped via `<audio id="bgm2">` at volume `0.6`.
  - Zone 3: `audio/Crazy_Mountain_Zone3.mp3`, looped via `<audio id="bgm3">` at volume `0.6`.
  - Starts on the first `Enter` press / tap / click (autoplay-safe). Continues across restart. Zone switching pauses the inactive elements and plays the active one.
  - If `bgm2.play()` rejects at runtime, an automatic WebAudio-synth chiptune loop (126 BPM, C minor, saw bass + detuned square lead + synth kick/snare/hats) kicks in so Zone 2 is never silent.
- **SFX:** All synthesized procedurally via WebAudio — no audio files needed. Events: `jump`, `droplet pickup`, `spring`, `bugbot squish`, `hurt`, `goal`, `rev` (spin-dash charge), `launch` (spin-dash release), `tick` (score tally ka-ching), `firework` (celebration burst), `checkpoint` (rising chime on totem touch), `zap` (Zapper firing), `shock` (Shockbot electrify), `saw` (sawblade rumble), `1UP` (rising 5-note fanfare when a life is earned).

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
    ├── Froggo_Act1.mp3              # Zone 1 looped background music
    ├── Froggo_Act2_Cyber_Swamp.mp3  # Zone 2 looped background music
    └── Crazy_Mountain_Zone3.mp3     # Zone 3 looped background music
```

## Playtest flags

- `TEST_INFINITE_LIVES` (in `index.html`): when `true`, `gameOver()` does not decrement `lives`, so deaths always respawn. Currently **ENABLED** in production for father-and-son co-playtesting of later zones without restarting from Zone 1 on each death. Set to `false` before publishing a public build.

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
- [x] **Bogmech tuning** — bumped from 3 HP to 4 HP; added low-HP enraged phase with faster attack cycle, harder player tracking, and red-aura visual tell
- [x] **1UP at every 100 droplets** — `+1` life per 100-droplet threshold crossed (`DROPLETS_PER_1UP = 100`, capped at `LIVES_CAP = 9`), with rising 5-note fanfare and a bouncy "1 UP!" banner; compact `♥×N` HUD above 3 lives
- [x] **Jump control tuning (2026-04-23)** — `MAX_RUN` 360→320 and `AIR_ACCEL` 400→650. Tightens horizontal jump distance (still clears every 200 px gap) and gives active mid-air steering instead of rail-like jumps.
- [x] **Entity placement audit (2026-04-23)** — swept Zone 1 Act 2 and Zone 2 Acts 1+2 for springs on slope segments, saws buried under or floating above ground, floating spikes, zappers sinking 4 px, and four droplet rows embedded inside descending slope tiles. All fixed.
- [x] **Slithertron aggression pass (2026-04-23)** — glide time 4.2s→2.4s with player-x bias, wind-up 0.85s→0.55s with continuous target re-lock and slide-toward, dive gains lateral homing (cap 400 px/s). Previously could not reliably hit a running Froggo; now forces real dodging.
- [x] **Climb mechanic + grip meter (2026-04-23)** — hold-to-climb walls (`climbWalls` array in level data), auto-ascend / ROLL-to-descend / Space-to-wall-jump / press-away-to-release, grip meter (2.5s full, drains while clinging, recovers on ground), mantle-at-top auto-step, solid wall collision with on-top handling. Grip HUD in top-right, amber warning below 35 %.
- [x] **Zone 3 Act 1 — Crazy Mountain (2026-04-23)** — `mountain-peak` palette (snow-cap ground, pale blue sky, slate rocks), `Crazy_Mountain_Zone3.mp3` wired via `<audio id="bgm3">`, ascent geometry with mandatory climb walls, spring-launched secret, stepping-stone across pits, reward platforms above each climb wall, summit goal arch. Placeholder Bugbots (Snowroller still to do). Title picker now shows a third snowy-white button; keyboard `3` jumps in when unlocked.
- [x] **Zone 3 Act 1 expansion (2026-04-25)** — extended from 7200 px → 9500 px (target time 150 s → 220 s). Added a third climb wall at `x=8500` (h=140), a mid-summit checkpoint at `x=6500`, a descent ridge + icy-crevasse stepping-stone past the original goal, three more Bugbots (one Heavy), and a true summit at `y=180`. Goal arch moved from `x=6960` to `x=9320`.
- [x] **Zone 3 Act 2 — Temple Depths (2026-04-25)** — new `temple-depths` palette (dark-stone tiles with gold trim, near-black ceiling, dim purple silhouettes), 9500 px corridor with three climb walls (h=120/120/80), four pit gaps with stepping-stone platforms, optional upper-path reward, mid-corridor checkpoint at `x=4500`, 6 basic + 4 Heavy Bugbots. Final corridor reserved for Yeti Mech boss; currently a placeholder goal arch at `x ≈ 9220` triggers the (final) zone-clear cinematic.

## Out of scope for now

- Zones beyond Zone 3 (Zones 4 + 5 TBD; Zone 6 reserved for Dr. Slither finale)
- Full Dr. Slither boss fight (Slithertron is the prototype; final fight lives in Zone 6)
- Multi-frame sprite animation (idle blink, run cycle, jump pose) — currently procedural transforms on single PNG
- Shield / power-up items
- Second playable character
- Chaos-emerald-style bonus stages
- Cyber-themed goal-arch variant (Zone 2 Act 1 still uses the nature-green arch visuals)

## Next candidates (ordered)

1. **Yeti Mech boss** — Zone 3 finale, replacing the Act 2 placeholder goal arch. 5 HP, ground-pound shockwave (jump to dodge) + ice-boulder lob (side-step) + horizontal charge (climb a wall to escape). Enraged phase at ≤ half HP.
2. **Dart Trap hazard** — Zone 3 Act 2 trap that fires horizontal darts on a fixed cadence. Needs a `kind: 'dart'` entry in `hazards`, a render path, and a projectile entry that travels until hitting Froggo or a wall.
3. **Snowroller enemy** — rolling snowball for Crazy Mountain Act 1 (currently using Bugbots as placeholder).
4. Shield droplet power-up (one-hit protection).
5. Cyber-themed goal-arch visuals for Zone 2 Act 1.
6. Tuning pass on Zone 2 & 3 difficulty.
7. Disable `TEST_INFINITE_LIVES` for a public build.
