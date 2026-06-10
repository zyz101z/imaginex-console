# X-Bros — Design Spec

**Game ID:** `x-bros`
**Version:** 0.4
**Last updated:** 2026-05-10
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

## Controls (single player, P1 only)

| Input | Action |
|---|---|
| Arrow Left / Right | Move |
| Arrow Up | Jump (light fighters get a second air-jump) |
| Z | Light attack |
| X | Special move |
| M | Mute / unmute sound |
| Esc | Back to character select / title |

P2 is always CPU.

## Scenes

1. **Title** — animated logo + roster preview. Enter to continue.
2. **Select** — character + difficulty picker. Arrows pick fighter, Up/Down change CPU difficulty (Easy / Normal / Hard). Z or Enter starts the match. CPU character is chosen at random (never duplicates P1).
3. **Battle** — 16:9, 1280×720 internal canvas, 3 stocks each, side+bottom death zones.

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
If a fighter swings while moving at ≥ 60 % of their `walkSpeed`, the hit deals **+25 % damage and knockback** and shows a yellow "DASH!" cue. Main reason `walkSpeed` matters in combat.

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

Key tactical behaviors implemented in `CpuController.poll`:
- Paces toward opponent until in attack range. With `crowd: false` it backs off if it overshoots; with `crowd: true` (Hard only) it stays in your face.
- `faceLock` forces facing toward opponent when in (or just outside) range. Without this, the idle wiggle would point the bot away half the time and waste its attack chances.
- Combo punish: while opponent is in hitstun, attack chance and cooldowns shift to the combo set — Hard guarantees ~5 follow-up hits in a row.
- Whiff punish: when opponent's `attackCooldownUntil > now` (they just swung and missed), the bot lunges in.
- Air chase: jumps onto platforms above; uses air-jumps to chase and to recover from off-stage falls.
- Special-move usage in `CpuController.poll` chooses lunge / projectile / grab based on horizontal range to opponent.

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

M toggles mute (battle scene only). Hint shown on select screen.

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

### Current sprite settings (2026-05-10)

| Character | sheet | frameW × frameH | displayH | feetY |
|---|---|---|---|---|
| Berserker | berserker.png | 512 × 512 | 140 | 0.96 |
| John | john.png | 512 × 512 | 140 | 0.96 |
| Froggo | froggo.png | 512 × 512 | 105 | 0.94 |
| Steve | steve.png | 512 × 512 | 150 | 0.94 |
| Chad | chad.png | 288 × 910 | 280 | 0.66 (also `frameTrim: 28`) |
| Jimmy | jimmy.png | 512 × 512 | 140 | 0.96 |

Chad's source is taller-than-tall because ChatGPT outputs varied. Different `displayH` / `feetY` compensate. Chad also uses `frameTrim: 28` because ChatGPT placed his overhead racket so close to the frame boundary that the bottom of it bleeds into the adjacent walk frame.

### Sprite vs rectangle fallback

If a character has no `sprite` config (or its texture failed to load), the Fighter falls back to a colored rectangle with the character's `color` and `accent`. Mixed cast supported.

### Sprite-specific gating
For sprite fighters (`useSprite = true`):
- Hitbox graphics for attack / lunge / grab are created but invisible (frame swap is the visual cue).
- The squash-recoil scaleX/Y tweens are **disabled**. Absolute scaleX values applied to a Phaser body that's already scaled (e.g., 0.27 → 1.15) would explode the body and punch the fighter through the floor.

## Cartridge / launcher

- Cartridge color: `#9ad6ff` (light cyan, matches title text)
- Status in `src/lib/games.ts`: currently `coming_soon`. Flip to `available` once a `cover.png` exists.
- No cover image yet — TODO.

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

## Open items (next session)

- Cover art → flip launcher status to `available`
- Shield + dodge (defensive button)
- More attack inputs (up / down / dash tilts, smash attacks)
- Music (currently silent except SFX)
- Stage variety (currently one stage)
- Per-character sprite tuning still needs play-test for Chad (recently bumped to displayH=280)
