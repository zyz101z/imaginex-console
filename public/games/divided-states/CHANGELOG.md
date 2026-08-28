# Divided States — Changelog

A Risk-style browser game: US states battle to control the whole country (49 states,
Hawaii out of play). Lives in the ImagineX console; deploys to www.imaginex.games.

---

## 2026-08-27 — Win Variants, Save & Resume, Match Stats

### Two new ways to win
A **Victory** selector on the start screen picks the mode:
- **Domination** — the classic; last commander (or team) standing. Unchanged, still
  the default.
- **Region Rush** — first player/team to control **4 full regions at once** wins.
  The win triggers the instant the 4th region is completed (mid-attack included).
  A gold **⚑ Regions 2/4** chip in the top bar tracks your progress.
- **Blitz** — the war lasts **15 rounds**; whoever holds the most states when time
  runs out wins (total armies break ties, so a stalemate still resolves). A
  **⏳ Round 8/15** chip counts down. In team games both modes score at the
  alliance level.
- Losing to an objective now shows a proper **Defeat** screen naming who out-raced
  you and how — an AI can beat you without wiping you off the map.

### Save & Resume
- The game **autosaves after every action** (including mid-draft and mid-placement).
  Close the tab any time; the start screen offers **⟳ Resume Saved Game** and the
  match continues exactly where it left off — same board, same hand, and the same
  dice you would have rolled (the RNG's internal state is saved too). The save
  clears when a match ends or a new one starts.

### Match stats
- Victory and Defeat screens now show a **scoreboard**: states held, captures,
  eliminations, and Mandate sets traded per commander, plus how many turns the
  war took. The headline also says *how* the game was won.

### Juice
- Eliminating a commander now fires a **full-screen red flash and board shake**
  on top of the existing capture effects (skipped for reduced-motion users).

*Under the hood:* engine gained `winMode`/`winTarget`/`turnLimit`, a round
counter, per-player stats, and `serializeGame`/`deserializeGame`; new
`test/winmodes.test.mjs` (32 checks — region/blitz wins, team scoring, RNG-exact
save round-trip, full greedy-bot Region Rush games). `npm test` now runs all five
suites (100 checks).

---

## 2026-06-12 — Touch fix: region highlight on iPad
- Region Control rows now **tap-to-pin** on touch devices (iPad has no hover, so tapping
  a region previously highlighted nothing). Tap a region to highlight its states on the
  map; tap again (or another region) to switch/clear. The pinned row shows an accent bar.
  Desktop hover is unchanged.

## 2026-06-12 — Team Mode

Full alliance play, built in four shipped batches.

### Teams (`956f83e`)
- **Flexible team assignment** on the start screen — toggle Teams on, then put each
  player (human or CPU) on team A/B/C/D however you like.
- **Win = last team standing.** A team wins once it's the only alliance left.
- **No attacking teammates** — allied borders aren't valid targets.
- **Through-only fortify** — you may route armies *across* a teammate's territory to
  reach your own cut-off states, but you can't hand armies to an ally.
- **Region bonuses are team-shared**, split proportionally by how many of the region's
  states each ally holds (remainder to the biggest holder); the region's total is
  unchanged.
- Team victory screen ("Team A Victory") and team-grouped Commanders panel.

### AI team coordination (`da73c72`)
- Allied AIs play as a unit at **Officer+** (and only when they actually have a living
  ally, so free-for-all is unchanged):
  - Draft and attack toward **shared regions**.
  - **Generals focus-fire** — every ally independently targets the same enemy team (the
    one closest to elimination) and concentrates reinforcement, attacks, and fortify on
    that front. No coordination messaging; convergence is emergent.
  - Recruit stays uncoordinated.

### Defeat screen (`70340f1`)
- When every human commander is eliminated, the game now shows a **Defeat** screen
  instead of silently playing on CPU-vs-CPU. Takes priority over an AI win, so a 1v1
  loss reads as your Defeat rather than the winner's Victory.

### Team-aware Region Control + per-player bonuses (`d3653b0`)
- In team mode the side panel now reads at the **team** level:
  - Region rows light up complete when your **alliance** owns the whole region.
  - **Two-tone progress bar** — your states solid, allies' lighter.
  - Bonus shows **your share / team total** (e.g. `+4 /5`) with a contributor
    breakdown line ("You +4 · Ally Bot +1").
  - Commanders panel shows each player's total region bonus as a green `+N` badge.
- Free-for-all display is unchanged.

---

## 2026-06-12 — Pre-team updates
- **Player names** for hotseat games (name each human when 2+ humans). (`c94eb7e`)
- **Interactive Draft** as an optional setup (take turns claiming states), followed by
  an **interactive army-placement** phase. Random distribution remains the default for
  quick games. (`a7c798f`, `40c852a`)

## 2026-06-11 — Mobile + polish
- **iPad**: always-visible End Turn bar and a collapsible side panel for a full-size
  map. (`8edd330`, `f1b73db`)
- Card balance dialed in (capped, escalating 3–8) and card labels clarified to show only
  the **type** (Recruits/Cavalry/Artillery/Wild) — sets are 3-of-a-kind or one-of-each;
  the state on a card never matters. (`937db17`)
- **Combat sounds** — rifle volleys per attack round + an explosion on capture.
  (`ec40f35`)

## 2026-06-11 — Launch
- Released into the ImagineX console with a cover and a **Wins** leaderboard. (`e5522c7`)
- Real US map (authentic state SVG paths), clean "war-room" UI, dice/capture animations.
- Three AI tiers (Recruit / Officer / General); seeded engine with a headless test suite.
- Regions with reinforcement bonuses, escalating Mandate cards, AK↔WA sea route.
