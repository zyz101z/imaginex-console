# X-Bros — Design Spec

**Game ID:** `x-bros`
**Version:** 0.8
**Last updated:** 2026-08-20 (v0.8 "second polish pass": title-screen rebuild with real cast lineup, themed platform art, CPU charged smashes, per-stage music tempo, animation pass)
**Platform:** ImagineX Console (web, iframe-embedded). Desktop keyboard only.
**Engine:** Phaser 3.80 (loaded from CDN inside the iframe).

## Premise

X-Bros — "ImagineX Smash" — is a Smash Bros-style 2D platform fighter starring heroes from the user's other ImagineX and Roblox games. Single player vs CPU. Stocks/lives, accumulating damage, knockback scaling, KO when launched off-stage.

## Roster

| Character | Source | Color | Build | Special |
|---|---|---|---|---|
| **Berserker** | Mini Tactics Arena | red/gold | heavy hitter | **Rage Lunge** (forward dash + hit) |
| **John** | Mini Tactics Arena (Tavern Keeper) | blue/cream | all-rounder | **Tankard Toss** (arcing wooden mug) |
| **Froggo** | Froggo Adventure | green/yellow | fast multi-jumper | **Tongue Pull** (long thin grab) |
| **Steve** | Bloot | white | mountain-tough | **Mountain Charge** (faster lunge) |
| **Bully Chad** | Tennis World | red/black | fast attacker | **Tennis Serve** (flat fast projectile) |
| **Jimmy** | Origami Pet Simulator | blue/orange | light, multi-jumper | **Paper Plane** (slow gliding projectile) |
| **Wilson** | Wilson's Spray World | pale zombie/purple | fastest walker | **Spray Blast** (purple paint blob projectile) |
| **Bigfoot** | Creature Cove | brown/tan | heaviest in the game | **Photo Blur** (lunge; goes semi-transparent mid-dash) |

Wilson and Bigfoot sheets landed 2026-08-20: ChatGPT output arrived as 2172×724 with freely-placed overlapping poses and REAL alpha, so a pure-stdlib Python tool (`sprite_tool.py` pattern: PNG decode → connected-component labeling → per-pose masks → repack) re-slotted the six poses into clean 560×724 frames (3360×724 sheets). Component grouping preserved detached props (Wilson's floating skateboard/beanie/spray can, Bigfoot's stars/birds) with their poses.

## Controls (single player, P1 only)

| Input | Action |
|---|---|
| Arrow Left / Right | Move |
| Arrow Up | Jump (light fighters get a second air-jump) |
| Z (tap) | Light attack (jab) |
| Z + Up held | Rising strike (anti-air launcher; works in air too) |
| Z + Down held (ground) | Low sweep — fast, pops opponent up (combo starter) |
| Z + Down held (air) | **Spike** — meteors an airborne opponent straight down |
| Z held past the jab, then release | **Charged smash** (charges after 0.45 s; glow pulses; 1.35–1.8× dmg/kb) |
| C (neutral, ground) | **Shield** — hold to block (grabs pierce it) |
| C + Left/Right (ground) | **Roll** — 0.32 s dash with 0.30 s i-frames, 0.9 s cooldown |
| C (air) | **Airdodge** — 0.30 s i-frames |
| X | Special move |
| M | Mute / unmute sound |
| Esc | Back to character select / title |

**Local 2-player (v0.7):** press **T** on the select screen to toggle VS CPU / 2 PLAYERS. In 2P mode P1 picks first (gold cursor), then P2 picks (red cursor; Esc backs out one step); mirror matches allowed. P2 plays on **WASD** (W jump, S down) + **F** attack / **G** special / **H** shield — same hold-to-smash and tilt rules as P1. Difficulty selector is hidden in 2P.

## Scenes

1. **Title** — animated logo + roster preview. Enter to continue.
2. **Select** — character + difficulty picker. Arrows pick fighter, Up/Down change CPU difficulty (Easy / Normal / Hard). Z or Enter starts the match. CPU character is chosen at random (never duplicates P1).
3. **Battle** — 16:9, 1280×720 internal canvas, 3 stocks each, side+bottom death zones. Stage chosen at random from `STAGES` each match (name banner fades in/out at start).

## Stages

Three layouts in the `STAGES` table. **The main floor footprint is identical in every stage** — the grab-destination clamp and the floor safety-net both assume it — so variety comes from platforms + palette only.

| Stage | Palette | Platforms | Backdrop art |
|---|---|---|---|
| **Sky Plains** | blue night (original) | 1 center platform | `bg/bg_plains.png` — moonlit floating islands |
| **Twin Peaks** | purple dusk | 2 side platforms | `bg/bg_peaks.png` — aurora twin mountains |
| **Sunset Flats** | orange sunset / green floor | none (pure ground game) | `bg/bg_sunset.png` — blazing sunset plains |
| **Neon Rooftop** (v0.7) | cyberpunk teal/pink | 2 low sides + 1 high center | `bg/bg_rooftop.png` — neon city skyline |
| **Crystal Cavern** (v0.7) | dark teal + gem glow | 1 wide high platform | `bg/bg_cavern.png` — glowing crystal cave |

**Title screen (rebuilt v0.8 after user feedback — fireworks art + color-block roster rejected):** `bg/bg_title.png` is now a golden-hour cliff vista (Meshy; picked from 2 candidates, the stormy-arena alternate is in scratchpad meshy_output). The whole cast stands on the painted cliff ledge as REAL idle-frame sprites (0.82× battle size, feet planted via each char's `feetY`, right half flipped to face center, staggered bob tweens). Logo breathes (scale 1↔1.02); no names/swatches anywhere. The select screen shows the same painting under a 0.72 scrim so the menus share one visual world.

**Themed platforms (v0.8):** physics rects are invisible; `BattleScene.drawSlab(st, x, y, w, h, body, edge)` paints floors + platforms per `st.theme`:
- `earth` (Plains/Sunset) — grass blanket + deterministic tufts, dirt speckles
- `stone` (Peaks) — block seams, cracks, highlight scratches
- `metal` (Rooftop) — neon glow above/below, rivets, panel seams
- `crystal` (Cavern) — soft aura + glowing crystal clusters growing off the top
Detail placement uses multiplicative hashing (no RNG) so redraws are stable. Stage entries carry `theme`, optional `grass`, and `bpm`.

**Per-stage music tempo (v0.8):** `SFX.startMusic(bpm)` — Plains 132, Peaks 126, Sunset 120, Rooftop 150, Cavern 112.

Backdrops are Meshy text-to-image paintings (nano-banana-pro, 16:9, 1376×768; 9 credits each, generated 2026-08-20). The stage is picked in `BattleScene.init` so `preload` fetches only that stage's PNG; a 0.18-alpha black scrim sits over the painting for fighter/HUD readability. If the PNG fails to load, `create()` falls back to the original procedural gradient + mountains.

## Mechanics

### Damage and knockback (Smash-style)
- Each fighter accumulates `damage` (a %). Starts at 0, no upper cap.
- On hit: `kb = (attackKbBase + victim.damage * 9) / victim.weight`. Launch velocity is `(dir * kb, -kb * 0.55)`.
- Hitstun is `(HITSTUN_BASE + damage * 0.003) / weight` — heavier fighters take less stun.
- KO = sprite leaves bounding box (`x < -180`, `x > W+180`, `y > 880`). Lose a stock, respawn from y=80.

### Per-character stats
Stored in `ROSTER` table in `index.html`. Tunable knobs per character:
- `weight` — divides incoming knockback + hitstun (1.0 = baseline)
- `walkSpeed` — ground / air horizontal velocity
- `jumpVel` / `doubleJumpVel` — vertical impulse (negative)
- `attackDmg` — damage added per light-attack hit
- `attackKbBase` — base knockback impulse per hit
- `attackRange` — hitbox width in front of fighter
- `attackCooldown` — seconds between consecutive swings
- `airJumpsMax` (optional) — extra air-jumps; defaults to 1. Froggo and Jimmy have 2.

### Dash-attack bonus
If a fighter swings while moving at ≥ 60 % of their `walkSpeed`, the hit deals **+25 % damage and knockback** and shows a yellow "DASH!" cue. Main reason `walkSpeed` matters in combat. **Jab only** — tilts and smashes have their own identity.

### Attack variants (v0.5)
All variants share `ATTACK_DURATION` and the character's base stats; the `V` table in `Fighter.startAttack` holds per-variant hitbox geometry + dmg/kb/cooldown multipliers:

| Variant | Trigger | Dmg × | KB × | CD × | Launch vector |
|---|---|---|---|---|---|
| jab | tap Z | 1.0 | 1.0 | 1.0 | standard `(dir·kb, −0.55kb)` |
| up | Z + Up held | 1.0 | 1.0 | 1.15 | `(0.3, −1.05)` — straight-up launcher |
| downTilt | Z + Down, grounded | 0.7 | 0.75 | 0.7 | `(0.4, −0.75)` — pop-up starter |
| spike | Z + Down, airborne | 1.1 | 1.0 | 1.25 | vs airborne victim `(0.2, **+0.9**)` = meteor + "SPIKE!"; vs grounded `(0.5, −0.6)` |
| smash | hold Z ≥ 0.45 s past the jab, release | 1.35–1.8× (charge) | same | 1.6 | standard + "SMASH!" + bigger shake |

Charge design note: the tap-jab still fires instantly on press (feel unchanged); the charge timer starts at the jab and only *becomes* a smash if Z is still held 0.45 s later (glow + chime). Release fires the smash even if the jab cooldown hasn't fully elapsed — it's a deliberate commitment.

### Shield / roll / airdodge (v0.5)
- **Shield** (C on ground, neutral): bubble ellipse; blocks attacks, specials, and projectiles; **grabs pierce it** (rock-paper-scissors: attack < shield < grab < attack).
- Shield HP 0–100: drains 16/s while held, +`dmg × 2.4` per blocked hit, regens 22/s when down. Can't raise below 8 HP.
- **Shield break** (HP ≤ 0): 1.6 s stun, "SHIELD BREAK!" cue, HP resets to 50. HUD shows a thin blue shield bar (turns orange < 30).
- **Roll** (C + direction, ground): 0.32 s dash at 560 px/s with 0.30 s i-frames; **airdodge** (C in air): 0.30 s i-frames in place. Both share a 0.9 s cooldown and a 0.45-alpha ghost look. Dodged hits show "DODGE!".
- Getting hit or starting a special drops shield + cancels charge; all defense state resets on stock loss.

### Special moves
Press X. Each character's special is one of three types defined in `character.special`:

- **`lunge`** (Berserker, Steve) — sets body velocity forward + slight up, spawns an active hitbox attached to the fighter for `duration` seconds. One-hit consumed.
- **`projectile`** (John, Chad, Jimmy) — spawns a `Projectile` entity that travels with initial velocity (and optional gravityY for arcs). Hits opponent on overlap; destroyed on hit or off-screen.
- **`grab`** (Froggo) — extends a long thin hitbox for `extendTime` seconds. On hit, opponent is **tweened** to the grabber's position (cleaner than per-frame velocity pull which capped at `maxVelocity`), put into hitstun, then knocked away. Grab destination is clamped to within 90 px of either edge so the pull can't deposit a victim off-stage.

Specials have their own `cooldown` per character.

### CPU AI
Three difficulty presets in `DIFFICULTY`:

| | Easy | Normal | Hard |
|---|---|---|---|
| `attackChance` (per frame in range) | 0.16 | 0.20 | 0.85 |
| `attackCdMin / cdRange` (s) | 0.45 / 0.25 | 0.36 / 0.22 | 0.14 / 0.08 |
| `comboAttackChance` (during opponent's hitstun) | 0.45 | 0.55 | 0.99 |
| `comboCdMin / cdRange` (s) | 0.30 / 0.20 | 0.26 / 0.16 | 0.08 / 0.06 |
| `whiffPunishChance` (during opponent's attack cooldown) | 0.0 | 0.25 | 0.95 |
| `airChase` (chase up to platforms with double-jump) | false | true | true |
| `reactionDelay` (s) | 0.18 | 0.18 | 0.0 |
| `crowd` (no back-off when too close) | false | false | true |
| `faceLock` (force-face the opponent in range) | false | true | true |
| `rangeBuffer` (extra distance kept beyond attackRange) | 32 | 24 | 8 |
| `shieldChance` (per opponent swing) | 0.05 | 0.22 | 0.45 |
| `rollChance` (per opponent swing) | 0.03 | 0.12 | 0.28 |

Key tactical behaviors implemented in `CpuController.poll`:
- Paces toward opponent until in attack range. With `crowd: false` it backs off if it overshoots; with `crowd: true` (Hard only) it stays in your face.
- `faceLock` forces facing toward opponent when in (or just outside) range. Without this, the idle wiggle would point the bot away half the time and waste its attack chances.
- Combo punish: while opponent is in hitstun, attack chance and cooldowns shift to the combo set — Hard guarantees ~5 follow-up hits in a row.
- Whiff punish: when opponent's `attackCooldownUntil > now` (they just swung and missed), the bot lunges in.
- Air chase: jumps onto platforms above; uses air-jumps to chase and to recover from off-stage falls.
- Special-move usage in `CpuController.poll` chooses lunge / projectile / grab based on horizontal range to opponent.
- **Defense (v0.5):** one dice-roll per opponent swing (keyed on `opponent.attackUntil`): roll away, shield for 0.5 s, or do nothing per `rollChance`/`shieldChance`. Rolls emit shield-input + direction on a single frame; the Fighter's C-combo logic turns it into a roll.
- **Charged smash (v0.8):** when the opponent is stunned with >45% damage, in range and grounded, the CPU occasionally (`comboAttackChance × 0.10` per frame) commits to a `chargePlan`: plants feet, presses and HOLDS attack for 0.75 s (visibly telegraphed by the charge glow), then releases the smash. Regular swings are locked out until the plan resolves; the opponent can recover and punish mid-charge — that's intended counterplay.
- **Tilts (v0.7):** `upWindow` (opponent 60–170 px above, within 0.8× range) makes the CPU throw the up-strike; `spikeWindow` (CPU airborne, opponent 60–170 px below within 95 px) triggers the air spike. Both extend the in-range box vertically and set the `up`/`down` input flags only on attack frames (so `up` never causes a stray jump — jumps are edge-triggered separately). CPU still doesn't charge smashes.

### Juice pack (v0.7)
- **Hitstop:** `BattleScene.hitstop(ms)` freezes physics + fighter ticks (HUD/tweens keep running): 50 ms normal hits, 75 ms heavy (≥12 dmg), 80 ms specials, 110 ms smash. Grabs skip hitstop (the pull tween would desync).
- **Particles:** `spawnBurst` (tween-driven square bursts) on every hit/special/shield-break/KO; `spawnDust` on jumps and hard landings (prev-frame fall speed > 420).
- **Damage numbers:** `spawnDamageNumber` — rising digits over the victim, big/red at ≥14 dmg.
- **KO spectacle:** double burst in the victim's colors at the screen-edge exit point, white screen flash, slammed-in "KO!" text, big shake.
- **Intro:** "READY… GO!" (1.3 s, inputs locked via `introUntil` feeding `zeroInput`).
- **HUD:** stock pips (colored squares, one per life) replace the "x2" text; damage % throbs above 100%.

### Animation & readability pass (v0.8)
- **Walk cycle:** sprites alternate walk/idle frames at ~7 fps while moving (was a static walk pose).
- **Air-jump flip:** 360° sprite spin on double jump (visual only — arcade bodies ignore angle).
- **Projectile trails:** fading ghost squares every 50 ms behind tankards/balls/planes/spray.
- **Off-screen arrows:** a colored triangle at the top edge tracks any fighter launched above the screen.
- **Victory stats:** "X dealt N% • Y dealt M%" line under the win banner (via `fighter.damageDealt`).

### Safety net
Every frame, `Fighter.tick` checks: if body bottom is > 6 px below floor surface AND the fighter is horizontally over the stage AND not at death-zone depth, it snaps them up and zeros vertical velocity. Catches rare physics edge cases (e.g., sprite-body offset arithmetic mis-aligning during grab-pull tweens).

## Audio (procedural Web Audio)

No asset files — `SoundManager` builds tones on the fly with oscillators + envelopes, plus filtered noise bursts. Master gain 0.4. Lazy AudioContext creation; resumes on first user gesture.

| Event | Sound |
|---|---|
| Menu navigation | short triangle click |
| Confirm / match start | rising square chord (440 → 660 → 880) |
| Jump | square 240→520 (P1 only — CPU spam-jumps would be noisy) |
| Double-jump | triangle 380→760 (P1 only) |
| Attack swing | filtered noise burst (both fighters) |
| Hit | sine 90→35 + noise crack |
| Dash hit | bigger sine + noise + a square overtone (audible reward) |
| Special: lunge | noise sweep + sawtooth 220→440 |
| Special: projectile | square 800→1600 (zap) |
| Special: grab | sawtooth 280→80 (swoop) |
| Grab connect | low square + noise |
| KO | square 480→80 + noise tail |
| Victory | C-E-G triangle arpeggio |
| Shield raise | sine 300→520 |
| Shield hit | triangle 520→260 + noise tick |
| Shield break | square 900→90 + noise tail |
| Roll / airdodge | noise sweep + sine 220→90 |
| Charge ready | square 660→880 chime |
| Smash hit | deep sine 130→38 + noise + square overtone (biggest hit sound) |

M toggles mute (battle scene only). Hint shown on select screen.

### BGM (v0.5, procedural chiptune)
`SoundManager.startMusic()` runs a 64-step (4-bar) loop in A minor at 138 BPM via a 90 ms `setInterval` scheduler with 350 ms lookahead: triangle bass riff (16-step), square-lead pentatonic melody (64-step), kick on beats, snare on 2 & 4, highpass-noise hats on off-8ths. Routed through a dedicated `musicGain` (0.55) into the master so **M mutes music + SFX together**. Starts in `BattleScene.create`, stops on `endMatch` and on scene `shutdown` (covers ESC and restart).

## Art pipeline

Each character has a `sprite` config in `ROSTER`:
```js
sprite: { sheet: "sprites/<id>.png", frameW: ..., frameH: ..., displayH: ..., feetY: ... }
```

- **Sheet:** PNG file in `public/games/x-bros/sprites/`. Single row of 6 frames in this order: idle, walk, jump, attack, hit, KO.
- **`frameW` / `frameH`:** size of each frame in source pixels.
- **`displayH`:** rendered height in world pixels. Width follows aspect.
- **`feetY` (optional, default 0.96):** fractional y inside the frame where the character's feet sit. Determines body-bottom alignment with the floor.
- **`frameTrim` (optional):** clears N transparent pixels at the left and right of each frame slot. Use when a character pose in one frame extends past its slot boundary and bleeds into the neighboring frame (Chad's overhead racket leaking into the walk frame's airspace).

### Sprite generation workflow

1. Generate sheet in ChatGPT (Plus subscription is enough). **Upload `berserker.png` as a style reference** so the cast stays visually consistent.
2. Use a prompt that specifies: character description, six frames horizontally (idle/walk/jump/attack/hit/KO), 3072×512 image (six 512×512 frames), transparent background, facing right, identical proportions across frames.
3. Save as `<id>.png` in `sprites/`.
4. Add the `sprite:` config to the character's ROSTER entry.

### Chroma-key (transparency at load)

ChatGPT outputs are usually RGB, not RGBA — the apparent transparency is actually a checkerboard. `BattleScene.buildSpriteSheets` samples **32 points along the top row** of each image, clusters them by color, picks the top 1-2 clusters with ≥3 samples each as background colors, and zeros alpha on any pixel within distance 35 of any. Why top-row sampling: corners are unreliable (characters in attack/KO frames sometimes extend to image corners), but the top edge is almost always pure background.

**Pre-keyed skip (v0.6):** if ≥29 of the 32 top-row samples already have alpha < 10, the PNG has real transparency (Wilson/Bigfoot) and chroma-keying is SKIPPED — otherwise the "background" cluster would be the black behind the alpha and the keyer would delete the black pixel-art outlines. `frameTrim` still applies either way.

### Current sprite settings (2026-05-10)

| Character | sheet | frameW × frameH | displayH | feetY |
|---|---|---|---|---|
| Berserker | berserker.png | 512 × 512 | 140 | 0.96 |
| John | john.png | 512 × 512 | 140 | 0.96 |
| Froggo | froggo.png | 512 × 512 | 105 | 0.94 |
| Steve | steve.png | 512 × 512 | 150 | 0.94 |
| Chad | chad.png | 288 × 910 | 280 | 0.66 (also `frameTrim: 28`) |
| Jimmy | jimmy.png | 512 × 512 | 140 | 0.96 |
| Wilson | wilson.png | 560 × 724 | 200 | 0.87 (real-alpha sheet, preKeyed) |
| Bigfoot | bigfoot.png | 560 × 724 | 255 | 0.88 (real-alpha sheet, preKeyed; biggest render on purpose) |

Chad's source is taller-than-tall because ChatGPT outputs varied. Different `displayH` / `feetY` compensate. Chad also uses `frameTrim: 28` because ChatGPT placed his overhead racket so close to the frame boundary that the bottom of it bleeds into the adjacent walk frame.

### Sprite vs rectangle fallback

If a character has no `sprite` config (or its texture failed to load), the Fighter falls back to a colored rectangle with the character's `color` and `accent`. Mixed cast supported.

### Sprite-specific gating
For sprite fighters (`useSprite = true`):
- Hitbox graphics for attack / lunge / grab are created but invisible (frame swap is the visual cue).
- The squash-recoil scaleX/Y tweens are **disabled**. Absolute scaleX values applied to a Phaser body that's already scaled (e.g., 0.27 → 1.15) would explode the body and punch the fighter through the floor.

## Cartridge / launcher

- Cartridge color: `#9ad6ff` (light cyan, matches title text)
- Status in `src/lib/games.ts`: currently `coming_soon`. `cover.png` exists (added 2026-06-09) — flip to `available` after user playtest.

## File layout

```
public/games/x-bros/
├── index.html        — full game in one file (~1.5k lines)
├── SPEC.md           — this file
└── sprites/
    ├── berserker.png
    ├── chad.png
    ├── froggo.png
    ├── jimmy.png
    ├── john.png
    └── steve.png
```

### Pending sprite prompts (ChatGPT pipeline, upload berserker.png as style ref)

- **Wilson** (`wilson.png`): "Cartoon zombie skater kid named Wilson: pale grey-green skin, messy hair, purple hoodie, holding a purple spray paint can, small skateboard under one arm or foot. Six frames horizontally (idle / walk / jump / attack spraying paint forward / hit / KO), each 512×512 (3072×512 total), transparent background, facing right, identical proportions across frames. EVERY frame must clearly show two eyes (one droopy zombie eye is fine) and his mouth."
- **Bigfoot** (`bigfoot.png`): "Cartoon Bigfoot creature: big friendly brown shaggy fur monster, tan face and belly, huge feet, heavy build. Six frames horizontally (idle / walk / jump / attack big two-handed swing / hit / KO), each 512×512 (3072×512 total), transparent background, facing right, identical proportions across frames. EVERY frame must clearly show two eyes and mouth."

## Open items (next session)

- Playtest v0.8: new title screen, platform art, 2P controls comfort, hitstop feel, CPU smash frequency
- Items / power-ups; alternate music melodies per stage (tempo already varies); online play (Tank Wars has the relay pattern)
- Local 2-player (WASD second keyboard player) — currently CPU-only
- CPU use of tilts / smashes (it only jabs + specials + defends)
- Per-character sprite tuning still needs play-test for Chad (displayH=280)

## Done in v0.5 (2026-08-20)

- Shield (C) with HP drain/regen, shield-break stun, HUD shield bar; roll + airdodge with i-frames
- Attack variants: up strike, down tilt, air spike (meteor), charged smash (hold Z past the jab)
- Procedural chiptune BGM (A-minor 4-bar loop, mute-integrated)
- 3 stages with palettes (Sky Plains / Twin Peaks / Sunset Flats), random pick + name banner
- CPU defends (per-swing shield/roll dice by difficulty)
- Headless smoke test: 37 checks (script eval, music loop, CPU defense, data tables)
