# Divided States — Changelog

A Risk-style browser game: US states battle to control the whole country (49 states,
Hawaii out of play). Lives in the ImagineX console; deploys to www.imaginex.games.

---

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
