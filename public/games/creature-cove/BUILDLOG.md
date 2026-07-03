# CREATURE COVE — BUILDLOG

## ⏭️ NEXT SESSION — START HERE
1. **USER + SON PLAYTEST** (the M2 gate): balance feel (gold rates, food costs, breed
   times), hatch-moment juice, mobile taps. Play at
   https://www.imaginex.games/games/creature-cove/index.html (registered `coming_soon` —
   not on the console shelf yet; direct URL works).
2. From playtest → M3 remaining: variant Meshy art waves (image-to-image restyles, ~270cr),
   decorations as sprites (~45cr). DONE since v1: sell mechanic, parent-shy odds (T14),
   egg-flight transition + hatch ceremony + sound design, front-view buildings,
   coin badges + Collect All (Vault=+50% storage now), DAY/NIGHT (real-clock tint,
   fireflies, night-element glow; ?hour=22 to force).
3. M4 launch: user cover art, flip `coming_soon` → `available`, announce.
4. Known nit: leaderboard POST shape assumed from siblings — verify once real scores flow.
5. GROUNDING PASS shipped (user feedback: buildings hovered/scale off): dscale(y) depth
   perspective + radial contact shadows + plots anchored to bg features + painter order.
   LESSON for sprite-on-painting scenes: depth-scale EVERYTHING or it floats.

## STATE (2026-07-03, commit c19b0e7) — M0+M1+M2 SHIPPED IN ONE SESSION
- **M0 engine**: 15-species element lattice, union→weighted-roll breeding (parents can
  return), Normal/Rare(2×)/Epic(4×) variants (epics ONLY from Rare×Rare+ pairs, odds
  table in GAME_DESIGN §4), timers 1min→2h ×2/×3 variant mult, gold accrual w/ storage
  caps via absolute timestamps (offline works), food farms → L1-10 feeding (+25%/lvl),
  pads 6→20, vault/den2/decor. **80 headless checks green** (scratchpad cctest.js — VM
  boot + __CC driver with setNow/setRng hooks).
- **M1 UI**: canvas lair scene (pan-drag) + DOM overlays: breed picker w/ element-union
  preview, egg→nursery→tap-to-crack hatch reveal (variant shimmer tell), 4-tab shop,
  bestiary w/ N/R/E pips (45 discoveries), leaderboard modal, tap-collect w/ coin puffs,
  feed panel, procedural SFX, toasts, day-1 tutorial toasts.
- **M2 art**: 22 Meshy pieces (~180cr, balance 845): 15 creatures + egg + den/nursery/
  farm/vault + painted cove background. Style anchor: "chunky cute cartoon fantasy
  creature with big expressive eyes…" (reuse VERBATIM for any regen). Hardened key
  pipeline: strict chroma + border flood-fill (loose magenta) + despeckle — fixed the
  dragon's noisy-magenta bg. Variants = hue-rotate filters + sparkle/aura fx in code
  (Meshy restyles deferred to M3).
- **GOTCHAS**: Meshy 429s on >10 rapid creates → pace 12s + recover in-flight tasks via
  GET list + full-prompt matching (script meshy_finish.py pattern). "genie with lamp"
  prompt = moderation_blocked (twice) → reworded to "blue spirit wizard, misty spiral
  tail" (no genie/lamp words). ?demo=1 = showcase state (save disabled).
- Registered: games.ts `coming_soon` + KNOWN_GAMES + GAME_SCORE_LABELS "Lifetime Gold"
  (committed WITH the firewall strip/restore dance — BREACH stays uncommitted).
- Save: localStorage `creaturecove_save` (v:1). Design: GAME_DESIGN.md (same folder).
