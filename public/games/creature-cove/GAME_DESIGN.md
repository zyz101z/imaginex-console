# CREATURE COVE — Game Design Spec

_Fantasy-creature breeding & idle collection game for ImagineX. Inspired by the breeding
loop of My Singing Monsters. Drafted 2026-07-03 with the user. Name **Creature Cove**
(user pick 2026-07-03; may still change — a rename is one find/replace + folder move)._

---

## 1. Pitch

You tend a magical lair. Two creatures go into the Breeding Den; a mystery egg comes out.
Hatch it, place the creature in your lair, and it earns gold while you're away. Spend gold
on buildings and food, level your creatures to earn faster, and chase the combos that
unlock all 15 species — ending with the four-element **DRAGON**. Then chase them again in
**Rare** and **Epic** form. The joy is the same as MSM: *"what do I get if I breed THESE
two?"* — and sometimes the egg comes out **shimmering**.

Audience: dad + 9-year-old son; check-in play (a few minutes, several times a day).
No real money anywhere — gold is earned, never bought.

## 2. Core loop

```
      ┌───────────────────────────────────────────────────┐
      ▼                                                   │
 CREATURES EARN GOLD (idle, capped — tap to collect)      │
      │                                                   │
      ├─► buy FOOD (Farm) ─► LEVEL UP creature ─► earns more
      │                                                   │
      ├─► buy BUILDINGS / LAIR EXPANSIONS (more capacity) │
      │                                                   │
      └─► BREED two creatures (takes real time)           │
                 │                                        │
                 ▼                                        │
           MYSTERY EGG ─► hatch ─► PLACE in lair ─────────┘
                 │
                 ├─► NEW SPECIES? → Bestiary discovery! 🎉
                 └─► RARE / EPIC variant? → shimmering egg! ✨
```

Every arrow is a reason to come back: collections fill up, breeds finish, food finishes.

## 3. Elements & the 14 creatures

Four elements: 🪨 **EARTH** · ✨ **MAGIC** · 🌙 **NIGHT** · 🐾 **BEAST**

The roster fills the element lattice COMPLETELY (4 + 6 + 4 + 1 = **15 creatures**):

| Tier | Creature | Elements | How you get it | Gold/min (L1) | Breed time |
|---|---|---|---|---|---|
| Base | **Gnome** | 🪨 | Shop, 50g (starter) | 0.8 | — (bought) |
| Base | **Fairy** | ✨ | Shop, 150g | 1.0 | — |
| Base | **Zombie** | 🌙 | Shop, 300g | 1.2 | — |
| Base | **Bigfoot** | 🐾 | Shop, 500g | 1.5 | — |
| Hybrid | **Genie** | 🪨✨ | Gnome × Fairy | 4 | 2 min |
| Hybrid | **Giant** | 🪨🌙 | Gnome × Zombie | 5 | 3 min |
| Hybrid | **Ogre** | 🪨🐾 | Gnome × Bigfoot | 5 | 3 min |
| Hybrid | **Vampire** | ✨🌙 | Fairy × Zombie | 6 | 4 min |
| Hybrid | **Unicorn** | ✨🐾 | Fairy × Bigfoot | 6 | 4 min |
| Hybrid | **Yeti** | 🌙🐾 | Zombie × Bigfoot | 7 | 5 min |
| Rare tier | **Phoenix** | 🪨✨🌙 | e.g. Genie × Zombie | 16 | 20 min |
| Rare tier | **Pegasus** | 🪨✨🐾 | e.g. Genie × Bigfoot | 16 | 20 min |
| Rare tier | **Griffin** | 🪨🌙🐾 | e.g. Giant × Bigfoot | 18 | 30 min |
| Rare tier | **Loch Ness Monster** | ✨🌙🐾 | e.g. Vampire × Bigfoot | 18 | 30 min |
| LEGENDARY | **DRAGON** | 🪨✨🌙🐾 | e.g. Phoenix × Bigfoot, Genie × Yeti | 50 | 2 h |

- **Nessie is the cove's namesake** (user pick 2026-07-03): the lair background includes
  the cove's water — when you own her, she idles IN the water (only creature with a swim
  pad). Discovery moment: she surfaces from the loch. Free flagship flavor.
- Flavor notes: Giant sleeps beneath the hills (earth+night); Phoenix dies in the night
  and rises from the ashes (earth+magic+night); Yeti haunts the dark peaks (night+beast);
  Nessie only surfaces after dark (magic+night+beast).
- _Naming note: "Rare tier" above = 3-element species (harder to breed). Distinct from
  **Rare variants** (§4) which any species can be. In UI, call 3-element species
  "Mythic tier" to avoid collision with variant Rares._

### Breeding rules (the MSM-style heart)

1. Pick any two placed creatures (two of the same species is fine if you own two).
2. **Union** their element sets → the *pool* = every species whose elements ⊆ union.
3. Outcome is a weighted roll over the pool — **you can get one of the parents back, or
   something new** (user requirement; also how MSM works). Rarer = less likely:
   - Gnome × Fairy → usually Genie, sometimes a Gnome or Fairy back.
   - Genie × Yeti (union = all 4) → Dragon at ~2%, triples ~8% each, else hybrids/bases
     from the pool. Failed dragon rolls still give something useful.
4. Species weights (TUNED 2026-07-03): base 30, hybrid 25, triple 12, dragon 5, and the
   two PARENT species roll at 40% weight ("the den likes making something new" — user
   asked for higher non-parent odds). Real numbers: Gnome×Fairy → Genie 51%; an
   all-element pair → Dragon ~1.7%, any triple ~16%.
5. Breed time = the *result's* time (a failed dragon attempt that rolls Ogre takes
   Ogre's 3 min, not 2 h — fast retries, and a long timer becomes the tell: something good!).
   Base-species results (a parent coming back) take 1 min. **Timer scale (user-set
   2026-07-03): ~1-2 min easy results, scaling to 2 h for Dragon.**
5b. **Variant time multiplier (user-set): Rare = 2× the species time, Epic = 3×.**
   A Rare Genie is 4 min; an EPIC DRAGON is 6 hours — the longest timer in the game,
   and the timer itself leaks the news (pairs with the shimmering egg).
6. One Breeding Den at start = one breed at a time. (Second den = late-game building.)

## 4. Variants: Normal / RARE / EPIC (user requirement)

Every species exists in three variants — same creature, fancier form, bigger income:

| Variant | Gold/min | Breed time | Look | How |
|---|---|---|---|---|
| Normal | 1× | 1× | standard sprite | default outcome |
| **Rare** ✨ | **2×** | **2×** | alt palette + sparkle drift | small chance on ANY breed |
| **Epic** 🌟 | **4×** | **3×** | dramatic palette + aura + slightly larger | only from breeding **Rare × Rare** (or better) |

**Variant roll** happens AFTER the species roll, based on the *parents' variants*:

| Parents | Rare chance | Epic chance |
|---|---|---|
| Normal × Normal | 5% | — |
| Rare × Normal | 12% | — |
| **Rare × Rare** | 30% | **10%** |
| Epic × Normal | 15% | — |
| Epic × Rare | 30% | 15% |
| Epic × Epic | 30% | 25% |

- Epics ONLY come from rare-or-better pairs (user: "breed rares together to get epics").
- The variant applies to whatever species was rolled — an Epic *Gnome* is possible and
  is a proud, absurd flex (3.2 g/min ×4 at L10... a genuinely good earner).
- **Shimmering egg tell**: rare eggs glitter, epic eggs glow — the reveal starts before
  the hatch (dopamine engineering).
- Bestiary: each species card gets three pips (N/R/E) → the full collection is
  **45 discoveries** (15 species × 3 variants). Epic Dragon (200 g/min at L1) is the crown.
- Bought shop creatures are always Normal — variants must be bred (keeps breeding king).
- Art: variants get REAL Meshy art (image-to-image restyles of the base sprite — same
  pose, elemental/ornate re-dress; see §10). v1 may ship with rich code fx (palette remap
  + particles + aura) while the 30-image variant waves land post-launch.

## 5. Economy

### Gold
- Each creature accrues gold continuously (real time, works offline via timestamps).
- **Storage cap** per creature = 60 min of its own production at L1, +10 min per level.
  Full creature stops earning → the reason to come back and tap.
- Tap a creature (or its pad) to collect; **Collect-All** unlocked as a building (Vault).

### Food & leveling (L1 → L10)
- **Farms** convert gold → food over time: pick a batch (e.g. 50g → 25 food, 5 min;
  bigger batches are better g/food and longer). One farm slot each; more farms = parallel.
- Feeding: each level costs `tier_base × 2^(level-1)` food
  (base tier_base=10, hybrid 25, triple 60, dragon 150). Variants don't change food cost
  (a Rare levels for the same food but earns 2× — feed your rares first, kids figure
  this out themselves and feel smart).
- Each level: **+25% gold/min** (L10 = 3.25× base) and +10 min storage cap.
- L10 creature gets a ⭐ and a visual glow (prestige, screenshot bait).

### Sinks & pacing targets
- Day-1 (first 30 min): buy Gnome+Fairy → first breed (Genie, 5 min) → farm → feed →
  second breed. Player should discover 3–4 species in session one.
- Week-1: all 6 hybrids + first triple + probably a first Rare variant; Dragon lands
  within week 1-2 with daily check-ins (2h timer, ~2% roll); Epic hunting (Epic Dragon =
  6h timer, the game's crown) is the long tail after that.
- Lair expansions gate hoarding: pads 6 → 8 → 10 → 13 → 16 → 20
  (500g / 2k / 8k / 25k / 75k). Duplicates are GOOD (parallel earners + breeding stock —
  and you NEED same-species dupes to hunt Rare×Rare epics).
- Once discovered, a species can be **bought** in the shop for gold (dupes without RNG):
  hybrid 1.5k, triple 8k, dragon 50k. (Normal variant only.)

## 6. Buildings (gold sinks with jobs)

| Building | Cost | Function |
|---|---|---|
| **Breeding Den** | free (starter) | The core. One breed at a time. |
| **Nursery** | free (starter) | Holds the egg; hatch timer = ½ breed time. Tap to hatch. |
| **Farm** | 200g (max 3: 200/1k/5k) | Gold → food batches. |
| **Vault** | 3k | Unlocks Collect-All button + offline cap 4h → 8h. |
| **Second Breeding Den** | 30k | Two parallel breeds (late-game). |
| **Decorations** | 100g+ | Pure cosmetics (fountains, mushrooms, torches, banners) — kid catnip, gold sink, no stats. |

## 7. The Lair (presentation)

- One wide scrolling scene (like a MSM island): painted background (Meshy), a grid of
  **pads** (creature slots) on gentle terraces. Buildings sit on their own plots.
- Creatures = Meshy sprites with cheap code-driven idle life: bob/sway loops, occasional
  blink/hop, gold-coin puff when collecting. NO skeletal animation — sine-wave transforms
  (the Tank-Wars-proven "juice over rigging" approach). Rares sparkle; Epics have auras.
- Tap creature → radial popup: Collect · Feed · Info (bestiary card).
- Ambient: parallax clouds, fireflies at night (real-clock day/night tint — creatures of
  🌙 glow after dark; pure flavor).
- Sound: soft ambient loop + per-species chirp on tap (procedural, BREACH-style SFX).

## 8. Screens

1. **LAIR** (home) — the scene above. Top bar: gold, food, pad count. Buttons: Breed 💕,
   Shop 🏪, Bestiary 📖, Leaderboard 🏆.
2. **BREED** — two slots + your creature roster; shows the element union; START. While
   active: timer on the Den. Result: egg with "????" — the reveal happens at hatch
   (shimmer/glow leaks the variant early — that's intentional).
3. **SHOP** — tabs: Creatures (discovered only) / Buildings / Decorations / Expansions.
4. **BESTIARY** — 15 cards, silhouettes until discovered; card shows elements,
   lore line, gold rate, N/R/E variant pips, times-bred count. Discovery = confetti + fanfare.
5. **HATCH moment** — full-screen egg-crack reveal with sting; extra fireworks for
   first-discoveries and variants. THE dopamine hit; overdo it.

## 9. ImagineX integration

- Folder `public/games/creature-cove/`; single-file `index.html` like siblings.
- Registry: `games.ts` entry (start `coming_soon`, flip on launch) + `KNOWN_GAMES` +
  `GAME_SCORE_LABELS`.
- **Leaderboard metric: "Lifetime Gold"** (submit on milestones: every discovery + every
  10k earned). Discoveries cap at 45 → tie-prone; lifetime gold climbs forever and
  rewards active lairs.
- Save: localStorage `creaturecove_save` — creatures (species/variant/level/lastCollect),
  buildings, gold/food, breeding/nursery state, discoveries (species×variant), lifetimeGold,
  lastSeen (offline accrual). Schema version field from day 1 (`v:1`).
- Mobile: tap-first design (all taps — best mobile fit of any ImagineX game yet);
  drag to pan the lair; UI buttons ≥ 44px.

## 10. Art plan (Meshy-first — **graphics are a stated priority**, ~460 credits total)

User directive 2026-07-03: *"good graphics — creatures and buildings should look sharp
and be generated on Meshy."* Art budget is real, not an afterthought:

- **15 creature sprites** (text-to-image, magenta-key pipeline, proven ×3): chunky
  cute-but-cool cartoon, ¾ front view, strong silhouettes, crisp edges. A **style anchor
  phrase reused verbatim in every prompt** keeps the set cohesive. Generated large,
  displayed ~200-280px — sharp on retina. ≈ 126cr.
- **Rare + Epic variant art** (30 images): **image-to-image restyle** of each normal
  sprite — same pose/silhouette, new dress (Rare = elemental crystal/flame skin; Epic =
  ornate armor/aura details baked into the art). Particles + glow still layered in code
  on top. ≈ 270cr, generated in waves AFTER launch validates the game (v1 ships with
  high-quality code fx as placeholder variants; art waves upgrade them).
- **Buildings, all Meshy** (6): Breeding Den, Nursery, Farm, Vault, 2nd Den (restyle),
  plus the egg. Same style anchor. ≈ 55cr.
- **Decorations** (4-6 sprites: fountain, mushroom cluster, torch, banner...) ≈ 45cr.
- **Lair background**: 1-2 wide painted scenes (terraced fantasy hollow) ≈ 18cr.
- Rendering rules for sharpness: never upscale (generate big, downscale only),
  `imageSmoothingQuality: 'high'`, devicePixelRatio-aware canvas, drop shadows under
  every sprite so pieces sit IN the scene rather than on it.
- Budget: ~210cr for v1 (creatures/buildings/scene) + ~250cr variant waves.
  Balance ~1,025 today — fits with headroom.

## 11. Tech notes

- Single-file `index.html`, canvas scene + DOM overlays for menus (Bloot/Froggo pattern).
- All timers are **absolute timestamps** (`readyAt`), never countdowns — offline
  progression falls out for free. On load: `accrue(now - lastSeen)` per creature, capped.
- Pure Math.random for rolls (single-player, no server; anti-cheat is a non-goal).
- Headless test harness (tanktest-style IIFE injection) from M0: breed-pool math, variant
  odds table, weight normalization, offline accrual cap, food/level curves, save/load
  roundtrip (incl. variant field), shop gates.

## 12. Milestones

- **M0 — Engine spine** (no art): state, save/load + offline accrual, breed pool + species
  roll + variant roll, food/level math. Headless tests green before any pixels.
- **M1 — Playable gray-box**: lair scene w/ placeholder blobs, tap-collect, breed→egg→
  hatch→place flow, farm/feeding, shop. Feature-complete with programmer art.
- **M2 — Meshy art wave 1**: bases + hybrids + egg + background; hatch reveal; bestiary.
  *(First user/son playtest here.)*
- **M3 — Full roster + polish**: triples + dragon art, variant fx, decorations, Vault/2nd
  den, day/night, SFX, discovery fanfares, leaderboard wiring.
- **M4 — Launch**: registry flip, cover art (user), balance pass from playtest data.

## 13. Decisions log

1. Name: **Creature Cove** (2026-07-03; tentative, cheap to change).
2. Timer scale: 1-2 min easy → 2 h Dragon; **Rare ×2, Epic ×3** breed time (2026-07-03).
3. 15th creature: **Loch Ness Monster** (✨🌙🐾) — the cove's namesake (2026-07-03).
4. Variant odds table (§4) — drafted, tune in playtest.
5. Graphics: Meshy-first, creatures AND buildings, sharp (2026-07-03).

## 14. Future hooks (post-launch, NOT in v1)

- 5th element expansion (new base + new lattice branch); daily quests; creature mood bonuses (place 🌙 creatures together =
  +10%); lair themes; gifting/trading between dad & son profiles (the WebRTC muscle from
  Tank Wars exists); seasonal decoration packs.
