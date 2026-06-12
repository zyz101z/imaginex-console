# Divided States — Game Spec

> **Working title:** *Divided States* (a game of US conquest). Name is a placeholder — easy to change.
> **Genre:** Turn-based strategy / area-control (Risk-like).
> **Platform:** Browser (runs by double-clicking an HTML file, or served locally / dropped into a site).
> **Art load:** Minimal by design — an SVG US map + procedurally-styled UI. No sprite art, no asset pipeline.
> (Deliberately fits the "low-art, code-driven game" preference.)

---

## 1. Concept

Each player is a faction fighting for control of the United States. The board is **49 US
states** (all states except Hawaii) as territories connected by a real-border adjacency graph.
Players reinforce, attack across borders with dice combat, and fortify. **Win by controlling
all 49 states** (or by the selected victory variant). 2–6 players, any mix of human and AI.

It's Risk, reskinned onto the US map, with grouped **Regions** (the analog of Risk's
continents) granting bonus reinforcements for holding them whole.

---

## 2. Map & Territories

### 2.1 Territories
- **49 states** (all US states **except Hawaii**, which is dropped — see §8), each a single
  territory holding an integer army count and an owner.
- **Adjacency graph** = real shared land borders between states. This is fixed game data the
  engine owns (a `{stateCode: [neighbors...]}` map). Correctness here is critical — it defines
  every legal attack/fortify, so it's a **Fable-built, carefully-verified dataset.**
- **Sea route** (Risk's Kamchatka–Alaska trick), the only non-land connection:
  - **Alaska (AK) ↔ Washington (WA)** — Alaska's single link to the mainland.

### 2.2 Regions (continent analog) & reinforcement bonuses
Hold every state in a region at the start of your turn to earn its bonus. Bonuses are tunable
in playtest; starting values:

| Region | States | Count | Bonus |
|---|---|---|---|
| **Northeast** | ME, NH, VT, MA, RI, CT, NY, NJ, PA | 9 | +5 |
| **South Atlantic** | DE, MD, VA, WV, NC, SC, GA, FL | 8 | +4 |
| **Great Lakes** | OH, IN, MI, IL, WI, MN, IA | 7 | +4 |
| **South Central** | KY, TN, AL, MS, AR, LA, MO | 7 | +4 |
| **Great Plains** | ND, SD, NE, KS, OK, TX | 6 | +3 |
| **Mountain West** | MT, ID, WY, CO, UT, NV, AZ, NM | 8 | +5 |
| **Pacific** | WA, OR, CA, AK | 4 | +3 |

Total = 49 states (Hawaii excluded). (Mountain West is large but has many internal borders →
defensible, hence the higher bonus; Plains/Pacific are more exposed. AK only connects via the
WA sea route, so the Pacific is a natural chokehold to hold.)

---

## 3. Core Rules

### 3.1 Setup
1. Choose player count (2–6) and which are human vs AI (and AI difficulty).
2. **Claim phase (player draft):** players take turns picking one unowned state at a time, going
   around the table until all 49 are claimed (1 army each).
3. **Initial placement:** each player places a starting army pool (scaled to player count, Risk-style:
   e.g. 2p≈40 each, 3p≈35, 4p≈30, 5p≈25, 6p≈20) one-or-more at a time onto owned states.

### 3.2 Turn structure (active player)
Three phases, in order:

1. **Reinforce** — receive new armies =
   `max(3, floor(ownedStates / 3))` + sum of completed **Region bonuses** + any **Mandate card set** turned in.
   Place them on owned states.
2. **Attack** — repeatedly attack an adjacent enemy state from an owned state with ≥2 armies.
   - Attacker rolls up to **3 dice** (one fewer than attacking armies, max 3).
   - Defender rolls up to **2 dice** (max of defending armies, max 2).
   - Sort each side's dice descending; compare highest-vs-highest and (if both have a second) second-vs-second.
   - **Defender wins ties.** Each comparison loss removes 1 army from that side.
   - If the defending state hits 0, attacker **captures** it and must move ≥ (dice rolled) armies in.
   - Capturing ≥1 state in a turn earns **one Mandate card** at end of turn.
3. **Fortify** — one move: shift armies between two **connected** owned states (along a path of owned
   states), leaving ≥1 behind. (Pick "single move" vs "connected-path" rule; default connected-path.)

### 3.3 Mandate cards (Risk cards, reskinned)
- Deck of cards each showing a state + a symbol: **Recruits / Cavalry / Artillery** (3 symbols), plus wild cards.
- A **set** = 3-of-a-kind or 1-of-each (or a wild). Turn in for escalating reinforcements:
  4, 6, 8, 10, 12, 15, then +5 each subsequent set (standard Risk escalation; tunable).
- Holding a card matching a state you own → small bonus armies placed there on turn-in (+2, Risk rule).
- **Eliminating** a player: you take all their cards. If that pushes you ≥6 cards, you must immediately
  turn in sets until <5.

### 3.4 Win & elimination
- **Domination (default):** own all 49 states.
- A player with no states is eliminated.
- **Variants (selectable):**
  - **Region Rush:** first to hold N complete regions for a full round wins (faster games).
  - **Capital Mode:** each player has a secret/known capital state; take all enemy capitals to win.
  - **Turn limit:** most states after K rounds wins (for bounded sessions).

---

## 4. AI Opponents

Three difficulty tiers (the AI is the hardest part to make *fun*, so it's **Fable-owned**):

- **Recruit (easy):** places reinforcements on borders semi-randomly; attacks only at clearly
  favorable odds; rarely chains. Predictable.
- **Officer (medium):** values completing/holding regions; concentrates force on one front; attacks
  when odds ≥ threshold; fortifies toward the active border; manages cards.
- **General (hard):** threat-maps the board (border pressure, region-bonus denial), plans multi-step
  captures, opportunistically eliminates weak players to grab cards, defends choke states, times card
  turn-ins. Should feel deliberate, not random.

AI must run **asynchronously with visible pacing** (small delays + animation) so the player can follow
its moves, with a battle-log narration of what it did and why (light reasoning text).

---

## 5. UI / UX

- **SVG US map**, states as clickable paths; fill = owner color; centered label = army count.
- **Selection flow:** click source → highlight legal targets (attack) or reachable states (fortify) →
  click target → confirm/quantity.
- **HUD:** current player, phase, reinforcements remaining, card count, region-bonus tracker, end-phase button.
- **Combat feedback:** dice roll animation, per-roll result, army deltas, capture flash.
- **Battle log** panel: scrollable history ("CA attacks NV: 3v2 → NV loses 2"; AI narration).
- **Menus:** new game (player count, human/AI mix, difficulty, variant), rules/help overlay, win screen.
- **Audio:** light Web Audio SFX (dice, capture, eliminate) — optional/mutable. No music required.
- **Responsive-ish:** target desktop first; the SVG should scale; mobile is a stretch goal.

---

## 6. Tech Stack & Architecture

Plain web, no build step or framework dependency required (can add Vite later if desired).
**Modular** (unlike the single-file arcade games) because the engine + AI are substantial and the
module boundaries map cleanly onto the multi-model build plan.

```
DividedStates/
  index.html            # shell: canvas/SVG mount, loads modules
  src/
    data/
      states.js         # 50 states: code, name, region, SVG path, label anchor
      adjacency.js      # { stateCode: [neighbors] } incl. AK-WA, HI-CA sea routes
      regions.js        # region groupings + bonus values
    engine/
      gamestate.js      # players, ownership, armies, phase, turn order, RNG
      combat.js         # dice resolution + odds helpers
      rules.js          # reinforce calc, legal-move generation, win/elim, card sets
      cards.js          # Mandate deck, draw, set detection, escalation
    ai/
      ai.js             # difficulty tiers, decision policies, async driver
    ui/
      map.js            # SVG render + state interactions
      hud.js            # panels, phase controls, counters
      combatfx.js       # dice + capture animations
      log.js            # battle log
      menus.js          # new-game / help / win screens
      audio.js          # Web Audio SFX
    main.js             # wires engine + ui + ai; game loop / phase orchestration
  SPEC.md
  BUILD_PLAN.md         # (this file's §7, extracted if we want it standalone)
```

**Key principle for the multi-model build:** the **engine defines a stable data model + API**
(a `GameState` object, pure functions like `resolveAttack`, `legalAttacks`, `reinforcementCount`).
Once that contract is frozen, the **UI/cosmetic modules just consume it** — which is exactly what
makes the lower-risk parts safe to delegate.

---

## 7. Build Plan — Fable core / Opus 4.8 periphery / Fable review

You asked to build the important parts with **Fable 5**, the less-important parts with **Opus 4.8**,
then have **Fable** check everything at the end. Here's how that works in practice and which pieces
go where.

### 7.1 How the model split is actually executed (in Claude Code)
- I run as **Fable** in the main session. I can spawn **subagents with a model override** (the Agent
  tool takes `model: "opus"`), so I delegate well-specified peripheral modules to **Opus 4.8**
  subagents, collect their output, and integrate it.
- The division works *because the engine is built first and freezes the API* — Opus subagents get a
  precise contract ("here's the `GameState` shape and these function signatures; build the HUD that
  renders them"), which is exactly the kind of bounded, lower-risk task to hand off.
- At the end I do a **Fable review pass** over everything (engine correctness, AI quality, UI↔engine
  wiring, a bug sweep, balance sanity) — same as the ImagineX review, ideally with a headless test
  harness for the combat math and rules.

### 7.2 Who builds what

**🔵 Fable (correctness-critical / hard / high-blast-radius):**
- The **data model & architecture** (the `GameState` contract everything else depends on).
- **Adjacency graph** (a wrong border silently breaks legal moves — must be verified).
- **Combat resolution** (`combat.js`) and odds — the math has to be exactly right.
- **Rules engine** (`rules.js`): reinforcement counts, legal-move generation, win/elimination.
- **Card system** (`cards.js`): set detection + escalation.
- **AI** (`ai.js`): the part most responsible for whether the game is fun.

**🟣 Opus 4.8 (peripheral / well-specified / lower-risk, delegated once the API is frozen):**
- **SVG map rendering + click interactions** (`map.js`) — consumes ownership/army data.
- **HUD panels, phase buttons, counters** (`hud.js`).
- **Dice/capture animations** (`combatfx.js`).
- **Battle log** (`log.js`) and **menus / win screen** (`menus.js`).
- **Audio SFX** (`audio.js`).
- The **states.js SVG paths/labels** data entry (mechanical, verifiable against a reference map).

**🔵 Fable (final review):** correctness of the engine, AI behavior quality, that the Opus-built UI
wires to the engine correctly, a full bug sweep, and a balance/playability sanity check.

### 7.3 Phased build order
1. **Phase 1 — Engine spine (Fable).** `states.js` skeleton + `adjacency.js` + `regions.js` +
   `gamestate.js` + `combat.js` + `rules.js` + `cards.js`. Headless-testable; no UI yet. **Freeze the API.**
2. **Phase 2 — Playable core loop (Fable).** `main.js` orchestrates a full turn cycle headlessly /
   with a placeholder UI, so the rules are provably correct before art goes on top.
3. **Phase 3 — UI & polish (Opus 4.8, parallel).** Map, HUD, animations, log, menus, audio — each a
   bounded subagent task against the frozen API.
4. **Phase 4 — AI (Fable).** Build the three tiers against the real engine; tune for "fun, not random."
5. **Phase 5 — Fable review + playtest.** Integration review, headless combat/rules tests, bug sweep,
   balance pass on region bonuses / card escalation / starting armies.

### 7.4 Why this split is sound
- The risky, correctness-sensitive, hard-to-verify logic (combat math, adjacency, AI) stays with the
  strongest model.
- The bounded, well-specified, easy-to-verify work (rendering a frozen data model, animations, menus)
  is delegated — and it's parallelizable, so multiple Opus subagents can run at once.
- A single strong-model review at the end catches integration seams, which is where multi-author work
  usually breaks.

---

## 8. Decisions (locked 2026-06-11) + remaining
**Locked:**
- **Name:** *Divided States* (placeholder, fine for now).
- **Claim phase:** **player draft** — players take turns picking states one at a time until all are
  claimed, then place starting armies. (More strategic than random distribution.)
- **Default victory:** **Domination** (own every state).
- **Sea routes:** **AK ↔ WA only.** No Hawaii↔CA, no AK↔HI.
- **Fortify rule:** connected-path move (spec default, kept).

- **Hawaii:** **dropped.** Map is **49 states**; Pacific region = WA/OR/CA/AK. (HI had no
  connection without a sea route, which would make Domination unwinnable.)

**Remaining:**
- Whether this stays standalone or later slots into **ImagineX** as a cartridge (modular layout
  doesn't preclude it).

## 9. Stretch Goals
- Online/hotseat multiplayer; save/resume; map editor; alternate maps (world, single-state counties);
  fog-of-war / capital secrecy; campaign vs escalating AI; stats/leaderboard (could reuse ImagineX's).
