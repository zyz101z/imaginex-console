# PIG MERGE TYCOON — Game Design Document

An ImagineX web game modeled on Roblox's **Penguin Tycoon** (Voldex, 127M+ plays) —
same core loop and feel, pig-farm theme. Created 2026-08-30.

## The Penguin Tycoon formula (research summary)
Buy penguins → they drop fish over time → deposit fish for money → buy more penguins →
**drag two same-tier penguins together to merge into a higher tier** (bigger, fancier,
better drops) → eggs occasionally appear and hatch into free penguins → expand the
island, buy upgrades, rebirth for permanent multipliers. Bright, chunky, cartoonish
look; bouncy animations; big rounded buttons; constant little rewards popping.

## Pig translation
| Penguin Tycoon | Pig Merge Tycoon |
|---|---|
| Penguins waddling on an ice island | Pigs trotting around a muddy farm pen |
| Fish drops | **Truffles** dug up from the mud (what pigs actually do!) |
| Deposit fish for cash | Truffles auto-carted to the **Farm Stand** → coins |
| Eggs hatch free penguins | **Mystery Crates** unearthed → crack open into free pigs |
| Island expansions | **Pen expansions** (capacity) |
| Ice/arctic look | Sunny farm: grass, mud wallow, fence, barn backdrop |

## Core loop (60 seconds of play)
1. Tap **BUY PIGLET** — a piglet pops into the pen with a bounce + mud splat.
2. Pigs root around; every few seconds one digs up a truffle (pop + sparkle) which
   flies to the Farm Stand and becomes coins (value by pig tier).
3. Pen fills up → **drag one pig onto a same-tier pig** → they merge with a flash
   into the next tier (bigger pig, new look, better truffles).
4. Occasionally a pig unearths a **Mystery Crate** — tap to crack: free pig
   (usually your mid tier, sometimes +1 above).
5. Spend coins: more piglets (price climbs), upgrades, pen expansion.
6. Reach the deep tiers → **SELL THE FARM (rebirth)**: reset pigs+coins for a
   permanent ×2 profit multiplier and a golden trophy pig statue by the barn.

## Tiers (30)
1 Piglet · 2 Pig · 3 Spotted Pig · 4 Boar · 5 Muddy Champ · 6 Ribbon Winner ·
7 Truffle Hound · 8 Royal Pig · 9 Knight Pig (helmed) · 10 Golden Hog · 11 Crystal Pig ·
12 Star Swine · 13 Rainbow Racer · 14 Moon Boar · 15 Sun Sow · 16 **HOG EMPEROR** ·
17 Volcano Hog (magma cracks) · 18 Storm Sow (cloud + bolt) · 19 Galaxy Boar (nebula) ·
20 COSMIC PIG (redesigned 2026-09-01 — old rainbow+crown+stars look was Rainbow Racer's twin;
now deep-space navy via `cosmic` flag: tilted glowing planet-ring drawn back-pass/front-pass so
the body sits inside it, orbiting moon, constellation star-chart flank, aurora sheen, crown kept) ·
21 Robo Hog (antenna + seams) · 22 Dragon Boar (wings + fire) ·
23 Phoenix Sow (flame crest) · 24 **INFINITY HOG** (∞ halo) ·
25 Frost King (ice crown, icicles, snowflakes) · 26 Shadow Boar (smoke wisps, red eye) ·
27 Tidal Sow (dorsal fin, wave stripe, bubbles) · 28 Titan Hog (stone cracks, moss, runes) ·
29 Seraph Sow (feathered wings, halo) · 30 **OMEGA PIG** (orbit rings, Ω, rainbow — the end)
- ⚠️ SURPRISE RULE (user 2026-08-31): never describe new tiers in chat — Dad + Noah
  want to meet them via the discovery banner. Names live here and in engine.mjs only.
- Every tier 16+ digs its OWN signature truffle (imperial/magma/storm/galaxy/ringed-
  cosmic/robo/dragon/phoenix/infinity); tiers 1-15 use banded styles.
- ~~Shiny pigs~~ — built 2026-08-30, REMOVED same day at Noah's request (he didn't
  like the effect). Old saves scrub shiny flags on load. Don't re-add without asking.
- Merge hints: while dragging, matching pigs get a pulsing gold ring.
- First-ever tier creation = NEW PIG DISCOVERED banner + confetti + fanfare.
- Tier look evolves procedurally: size, palette, accessories (spots, ribbon, crown,
  armor, glow, star particles). Canvas-drawn chunky vector pigs — round body, snout,
  flappy ears, stubby legs, tiny bounce walk. No sprite assets needed.
- Truffle value: `v(t) = 2 · 2.05^(t-1)` (t16 ≈ 130K/dig before multipliers).
- Dig interval: ~6s per pig (upgradable), small jitter so drops feel organic (slowed from 4.5s after playtest: 'you kind of have to rush').

## Economy
- **Coins** (single currency, v1). Piglet price: `12 · 1.22^n` (n = piglets bought
  this rebirth) — forces merging over hoarding piglets.
- **Upgrades** (each 8 levels, cost ×2.1/level):
  - 🥕 **Feed Quality** — dig interval −7%/level
  - 🛒 **Market Cart** — truffle sell value +15%/level
  - 🍀 **Lucky Snouts** — crate chance +20%/level (relative)
  - 🏆 **Prize Breeds** (9 levels, ×4.2 cost) — raises the TIER the shop sells
    (Piglet → Pig → … → Golden Hog); each level resets buy-price inflation.
    Playtest fix: late-run piglets stopped being worth buying vs crates.
- **Pen expansions**: capacity 6 → 9 → 12 → 16 → 20 → 25, escalating cost. Pen
  visually grows (fence moves out).
- **Mystery Crates**: base ~1/45 digs; tier = your median pen tier (20% chance +1).
  Crates wait 5 MINUTES (playtest: no rushing); opening costs coins and shows the odds first.
  Pull tables (relative to median pen tier, nerfed 2026-08-30 — they scaled too hard):
  🪵 wooden −2/−1/0 (35/50/15%) · ⚙️ iron −1/0/+1 (40/45/15%) · 🌟 golden 0/+1/+2 (40/45/15%).
- **Rebirth (Sell the Farm)**: needs tier 10 first time (+1 tier requirement each
  rebirth, max requirement 14). Each rebirth: ×2 permanent sell multiplier,
  golden statue added, pigs/coins/upgrades reset (expansions keep 1 level).
- **Offline earnings**: away-time truffle income at ~13% rate (40% ÷ 3, user nerf
  2026-08-31: offline was too generous), capped at 8 hours,
  presented as a "While you were away…" welcome-back chest.

## Look & feel (the Penguin Tycoon vibe, 2D)
- Bright, saturated, chunky. Sky-blue top, rolling green field, brown mud wallow
  center-pen, wooden fence, big red barn + farm stand at top. Soft round shadows
  under everything.
- **Juice**: pigs bounce as they trot; truffle pop + arc flight to the stand; coin
  count ticks up with a wobble; merge = white flash + ring + confetti + the new pig
  landing with a THUD and mud splat; crate wobbles and shakes until tapped.
- Big rounded UI buttons with drop shadows (BUY PIGLET front and center), coin pill
  top-left, tier-book button (collection log of discovered pigs), upgrade drawer.
- WebAudio SFX: oink (pitch by tier), truffle pop, coin chime, merge fanfare,
  crate crack, rebirth jingle. Mute button.
- Touch-first: drag-to-merge works with finger or mouse; buttons are fat.

## Pass 6 additions (2026-08-30, user+Noah picks)
- 🎨 **Farm themes**: Classic (free) · Winter 200K (snow, frozen wallow) · Night 2M
  (stars, moon, fireflies, glowing barn windows) · Beach 20M (sand, water-pool pen,
  foam). Buy once → switch free, in the upgrades drawer; SURVIVE rebirth.
- 🐷 **Pig names**: double-tap a pig → name dialog (12 chars); name floats above the
  pig, survives merges (merged pig keeps whichever parent was named) and saves.
- 🎪 **Pig tricks**: single-tap a pig → random trick: hop, spin, mud roll, or an
  ascending three-oink solo with floating notes. Pure toy, no economics.
- Approved-for-later backlog: daily gift crate, farm goals/quests, Farmhand
  auto-merger, statue bonuses, save slots, County Fair, Mythic Barn (25+).

## 🎨 Farm Customization pass (2026-09-01, user+Noah picked 1/2/7/9/10 from rec list)
- 🪴 **Decor Shop**: 10 placeable pieces (hay bale 25K → golden fountain 1B), duplicates
  allowed, 40-piece cap, sell-back at half price. ARRANGE mode: drag anywhere on the
  farm (0..1 space, y-sorted with pigs so they walk behind the oak); double-tap sells.
- 🚧 **Fence styles** (classic/picket 250K/stone 10M/neon 500M) + 🏠 **barn paints**
  (red/blue 1M/green 1M/teal 25M/purple 25M/gold 2B) — buy once, switch free, independent
  of theme (render gets fence + barnCols via drawScene opts).
- 🐔 **Critters**: chickens 200K / ducks 1M / barn cat 10M / goat 100M — ambient,
  deterministic paths from time, no save state beyond ownership.
- 🎵 **Music box**: nature 500K (birdsong day / crickets on night theme), pig choir 5M
  (periodic oink chord), DJ Hog 50M (lo-fi WebAudio beat — PAUSES the mp3 while on).
  Own once, toggle each independently.
- 👨‍👦 **Farm slots + visits**: 2 slots (slot 1 = legacy save key), rename, SWITCH
  (reload-swap), 👀 VISIT renders the other slot read-only (their theme/paint/decor/
  critters/pigs idle at saved spots; HUD hidden; banner shows best TIER NUMBER — never
  the name, surprise rule). Meta in `pigmerge_slots`.
- All cosmetics survive rebirth + migrate onto old saves. Battery 215.

## 💸 Sell a pig (2026-08-31, user request: stranded odd-one-out pigs)
- Double-tap a pig → the name dialog now also has **SELL** (two taps: arm → "REALLY
  SELL?" → gone; a stray double-tap can't lose a pig).
- Price = `min(truffleValue(tier) × 4 digs, ½ × shop base price for that tier)`. The
  cap is the anti-exploit: rebirth mult inflates truffle value but not shop price,
  so buy→sell must never profit (test sweeps mult/market/stock combos).
- Tracked in `stats.sold` (no ribbon yet).

## 🎀 Blue Ribbons (2026-08-31)
- ~41 farm milestones in `RIBBONS` (engine): merges (1→2000), best tier (5→24, MAX_TIER),
  book size, lifetime coins (1K→1T), digs, crates (+golden), shop buys, maxed upgrade,
  Prize Breeds 5, full pen, 25 pigs at once, 4-of-a-kind, 5 names, all themes,
  rebirths (1→10). Each has a live `progress(s)` → bar + "x / y" in the panel.
- Reward = `truffleValue(bestTier) × STAGE_DIGS[stage]` — stages early 3 / mid 15 /
  late 80 / end 400 / ultra 1500 digs (2026-08-31 rebalance after user playtest: a
  flat curve felt too rich early and worthless late; the ⅓ global nerf that preceded
  it is gone). Still auto-scales with the economy; coins count toward lifetimeCoins.
- Lifetime `stats` counters (merges/crates/goldenCrates/bought/names) + `ribbons` ids
  are saved and NEVER reset by rebirth. Old saves migrate (counters at 0) and
  back-award anything the save already proves (best tier, coins, digs, rebirths).
- UI: 🎀 button under ♪ shows earned/total; panel sorts earned first, then closest.
  Earn = queued toast + confetti + jingle (one at a time, 2.8s apart; waits for the
  rebirth toast). Barn wall grows a ribbon board (12 rosettes, then "+N").
- ⚠️ Surprise rule: ribbon names/descs use tier NUMBERS only, never pig names —
  enforced by a test. New pigs must stay a surprise for Noah + Dad.

## ImagineX integration
- Folder `public/games/pig-merge-tycoon/`; ES modules (engine pure + UI), served
  statically like divided-states.
- Save: localStorage `pigmerge_save_v1`, autosave every action + 5s tick.
- Score → postMessage `{type:'imaginex-score', gameId:'pig-merge-tycoon', score}`;
  score = bestTier×10,000 + rebirths×2,000 + ribbons×20 + floor(log10(lifetimeCoins)×10)
  (single climbing number; 2026-08-31 reformulated — old tier×100+rebirths tied Dad and
  Noah at 1702. New scores are always > old ones so the server's keep-max supersedes).
- games.ts registry entry stays UNCOMMITTED until user playtest (BREACH pattern).
- Cover art: TBD at flip time (screenshot montage or Meshy).

## v1 scope (this build)
Everything above EXCEPT: gems/premium currency, pig cosmetics/accessory shop,
minigames, visiting other farms (no multiplayer), pets. Those are v2 candidates.

## Tests
`test/engine.test.mjs` — pure-engine battery: tier math, buy pricing, merge rules
(same tier only, capacity respected), crate tier weighting, upgrade effects,
rebirth gates/multipliers, offline earnings cap, save round-trip, and a scripted
bot playing to rebirth ×2 with invariants (coins never negative, pen never over
capacity, tiers within 1..20).
