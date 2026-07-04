# CREATURE COVE — BUILDLOG

## ⏭️ NEXT SESSION — START HERE
0. **STATE 2026-07-04 EOD: LAUNCHED, PUBLIC ON THE SHELF, art settled, economy patched,
   leaderboard FIXED.** User's cover art on the cartridge. Suites: cctest.js 143 +
   cc_render_audit.js (scratchpad — recreate from BUILDLOG patterns if lost).
1. **Awaiting: family playtest verdict** + first real leaderboard entries (scores flow on
   discoveries + every ~10k gold; console play stamps profile nicknames via postMessage).
2. Queue: creature NAMING (quick, high attachment) · collection milestones · weekly
   featured element · personalities (#3) · weather/rainbows (#4) · fusion · guest-breeding
   share codes · Rare/Epic Meshy art waves (~270cr, user deferred — rings suffice).
3. ⚠️ LESSONS (hard-won, reuse):
   - Aerial bg + front-view sprites = UNFIXABLE perspective mismatch. Bg must be low-angle
     (sky/horizon) for front-view art. Platform-pancake experiment failed — grass-based
     sprites ground themselves on grass; ONE soft AO shadow is enough.
   - "video game sprite" in prompts → pixel-art drift; say "smooth painterly, NOT pixel
     art, no sticker outline". White outlines peel via near-white edge erosion.
   - Terrain-shaped buildings (mound-vault) never sit right on open ground — regenerate
     as ARCHITECTURE (treasury tower) instead of moving them forever.
   - Space by MEASURED sprite widths (barn 190px, vault ~160, den 200); test placement
     with the ALL-buildings demo (?demo=1 builds everything).
   - NEVER store performance.now() on saved objects (_petT bug); save() strips _-fields.
   - Leaderboard contract: games postMessage {type:'imaginex-score', gameId, score,
     nickname} to the console (it stamps profile nickname); API POST field is `nickname`,
     GET returns a PLAIN ARRAY; per-game MAX_SCORE_BY_GAME in route.ts (CC: 100M).

## 2026-07-04 SESSION LOG
- Economy: expedition rebalance (rates .9/.8/.7, cap 1.2× storage — L4 unicorn 1700→880)
  + ELEMENTAL SHRINES sink (4×3 lvls, 5k/25k/100k, +5%/lvl/element, grove left terrace,
  explainer modal on tap) + premium decor (8k/15k/25k). T20.
- Art endgame: background RETHINK (low-angle horizon bg, lanczos+unsharp+grade),
  pancake platforms added→REMOVED same day, vault regenerated as stone TREASURY TOWER
  (~9cr), nursery+farm repainted painterly, building layout by measured widths,
  feet-planted idle. User verdict: "That does look better."
- LAUNCH: status=available on the console shelf + user cover art (creaturecove.png →
  cover.jpg). Phone disabled N/A (web). Leaderboard end-to-end FIX (see lesson above),
  verified against prod API with no-pollution probes.

1. **USER + SON PLAYTEST** (still the gate): balance feel, mobile taps. Play at
   https://www.imaginex.games/games/creature-cove/index.html (`coming_soon` — direct URL).
1b. LATE-2026-07-03 BATCH (all live): daily REQUESTS (date-seeded, chest=25%-rare egg) +
   variant ground rings (user chose over art spend), GREAT COVE TREE (8 lifetime-gold
   stages, +2%/stage, MESHY ART per stage — tree_0..7.png), petting+roamers, feet-planted
   idle (breathing squash at foot anchor + hops w/ grounded shrinking shadow — bob =
   floating, user-confirmed fix), diagnostics (roundRect polyfill, drawScene try/catch
   toast, ?safe=1 bisect). ⚠️ BUG CLASS FENCED: NEVER store performance.now() on saved
   objects (_petT leak scaled creatures 100x after reload — "giant flashing creatures");
   save() strips _-prefixed fields; render audit (cc_render_audit.js pattern) replays
   stale-_petT with huge-scale tripwire.
2. From playtest → M3 remaining: variant Meshy art waves (image-to-image restyles, ~270cr),
   decorations as sprites (~45cr). DONE since v1: sell mechanic, parent-shy odds (T14),
   egg-flight transition + hatch ceremony + sound design, front-view buildings,
   coin badges + Collect All (Vault=+50% storage now), DAY/NIGHT (real-clock tint,
   fireflies, night-element glow; ?hour=22 to force), EXPEDITIONS (Wilds signpost
   bottom-left: 3 destinations 30m/1h/2h, gold+food = gpm-scaled, wild-egg/decor
   bonus rolls, creature leaves the lair + fully busy-locked while away).
   Retention roadmap from design review: daily Cove Requests, naming, collection
   milestones, weekly featured element, coin-chase micro-game, placement+harmony (big).
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
