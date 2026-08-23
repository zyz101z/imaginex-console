# GRIDIRON GM — Changelog / State of the Game

## 2026-08-23 (later) — Audio pile-up fix (user report: "too many sounds at once")
Cause: crowd.mp3 became the per-score cheer sample ON TOP of airhorns + the new gameday bed, with drive events every ~1.2s. Fix: `setDuck(f)` in sfx (cheer intensity + airHorn gain × duck); ticker sets duck 0.45 while its music bed plays (restored to 1 in both close handlers); gameday vol 0.2→0.14 (bowl 0.3→0.22); `updateMusic` now refuses to switch tracks while the ticker overlay is visible ("the ticker owns the speakers"). Batteries green.

## 2026-08-23 — THE BIG ONE: live decisions + deadline drama + storylines + Suno music
1. **🧠 LIVE COACH'S CALLS** (the ticker is now participatory): simGame gains optional `hooks` — when the USER's team trails by 1-9 in crunch time (lateGame, remaining≥2), the drive is MARKED (`log[].ask`) and the ticker PAUSES before revealing it: **GO FOR IT / TAKE THE POINTS / PLAY IT SAFE** (go = all-out td/to reshape + noPunt; fg = kick-bleed; safe = skip the trailing override entirely — punting stays live). Max 2 calls/game. Architecture: `rng.state()/setState` (new, additive) + `playWeek(..., hooks)` captures rng state + FULL two-roster snapshot (stats/injuries) before the user's game → `replayUserGame` reverts stats/standings/scores, re-sims from the same dice with `decisions{drive:choice}`, re-applies, redoes the weekly heal tick for those rosters. Pre-decision drives replay IDENTICALLY (battery-verified). genWeeklyNews/lastBox/weekly security moved POST-ticker so a flipped result flips everything. Skip abandons the call (auto-coach). **Batteries: hooks default null → engine paths byte-identical; sim battery now 2,995 (§7: mark context, prefix determinism, standings/score/gp conservation incl. bye weeks, replay determinism)**.
2. **🔥 TRADE DEADLINE DRAMA (weeks 7-9)**: `evalTrade(..., discount)` + `genAIOffer(..., opts{preferTeams, premium})` (defaults = old behavior). Buyers: offer rate 0.22→0.5, contenders (±2 record) preferred, premium 1.15-1.35, "🔥 DEADLINE:" news. Sellers (record ≤ -2): accept 20% under value; Trade Center gets a deadline banner + 🏷️ FIRE SALE shelf (vets 29+/expiring, ovr 74+, SHOP button pre-loads the trade UI). Week-6 heads-up news. (Hard week-9 deadline already existed.)
3. **📖 STORYLINES**: 💢 HOLDOUTS — season open, a GREEDY/MERCENARY star (ovr≥82) paid <60% of his ask has a 60% chance to demand a deal; banner on the schedule view: PAY (cap-checked) or LET HIM SIT (3 weeks via injuredWeeks). 🏈 FRANCHISE PLAYER — one tag, set from the player card (ovr≥78): 0.85× extension ask, holdout-immune, green card badge, news. 🕯️ RETIREMENT WATCH — up to 3 league legends (34+, hofScore≥200) flagged at season open.
4. **🎵 SUNO MUSIC**: user-generated mp3s (menu/gameday/bowl/draft/offseason/victory + crowd.mp3 which auto-worked via the existing loader). `playMusic/stopMusic` in sfx.mjs (autoplay-retry on first click, missing files fail silent, mute-integrated); app `updateMusic()` director: menu ↔ draft ↔ offseason, gameday/bowl beds under the ticker, victory fanfare after a championship (pendingVictoryMusic + lock).
- gm battery 17,543 ✓. Copies synced.

## 2026-08-23 — Personalities + save backup + GM legacy
1. **Contract personalities** (app-layer ONLY — engine contract math untouched, batteries hold): `personaOf(p)` hashes player id → 💰 GREEDY (ext ×1.25, FA ×1.15) · 🤝 LOYAL (ext ×0.90; extra ×0.85 on re-signs) · 💍 RING CHASER (reads your recent record via `myRecentWins`: ≥11 wins ×0.85, ≤5 ×1.18) · 🧳 MERCENARY (×1.12/×1.05) · 😐 STEADY. Applied via `askOf` in the FA market/re-sign tables + `userSignFA` charge + `extensionAsk`; icons in FA rows (tooltip blurbs), badge on the player card. Street FAs stay flat (already discounted vets). Deterministic — no save migration.
2. **💾 Franchise backup**: EXPORT (clipboard, prompt fallback) / IMPORT (validated paste → reload) buttons atop Finances.
3. **🏈 GM legacy line** above franchise history: seasons · titles · best record · average wins.
- Batteries green (2,985 + 17,543). Copies synced.

## 2026-08-22 — Yearbook + milestones + HOF plaques (season-narrative pass)
1. **📖 Season Yearbook** (`buildYearbook`, snapshotted at the offseason turn WHILE season stats are live, stored as `S.yearbook` + rendered in the offseason view): signature win / toughest loss / longest streak read from the schedule, team leaders (pass/rush/rec/defense, clickable), **🎓 rookie report card** (A–D grades by production score; "did not play" = —), your hardware + All-Pros.
2. **🎉 Milestone news** (`milestoneNews` weekly before `S.week++`): 4,000 pass yds · 30 pass TD · 1,000 rush · 1,000 rec · 10 sacks · 8 INTs — once per player per season (`p.mstone`, reset in startOffseasonPipeline), "— that's your guy!" for your roster.
3. **🏛️ HOF plaques** (`hofCard`): Hall of Fame names clickable → gold-trimmed career card (career statLine from the archived `totals`, games/seasons, HOF score, retirement season).
- Batteries green (2,985 + 17,543). Copies synced.

## 2026-08-22 — Player cards + Gridiron All-Pro Team
1. **Player cards everywhere**: click any dotted-underlined name (roster, leaders, FA market/street/expiring, awards, All-Pro) → `showPlayerCard` overlay: big ovr, team, attribute BARS (color-coded ≥88/≥75), contract, THIS SEASON + CAREER statlines (shared `statLine(pos, stats)` extracted from computeAwards — tolerant of missing keys for career totals), badges (★ ALL-PRO ×N / ROOKIE / INJURED Nw). Lookup via `findPlayerById` (league + FA pool; **draft prospects excluded on purpose** — the card would leak true ratings past scouting fog). `pn(p)` helper wraps names; `__gm.pcard/pcardByName/closePcard`.
2. **★ GRIDIRON ALL-PRO TEAM** (`computeAllPro` in gm.mjs): 9 spots (QB/RB/WR/TE/DL/LB/CB/S/K) by award-family scoring, locked at week 18 with the awards; winners get persistent `p.allPro` count (card badge). Awards Night gains a finale slide (roster list + "N OF YOURS MADE THE TEAM!"); offseason awards view lists it with clickable names.
- Batteries: sim 2,985 ✓ · gm **17,543** (6 new all-pro/statLine checks). Copies synced.

## 2026-08-22 — "Moments" pass (designer session): the game's payoff beats
1. **Player of the Game** (`playerOfTheGame` in app.mjs): best statline on the WINNING side (whole game on tie), award-family weighting, min score 40 or no honor. Gold ⭐ line atop the drive log at FINAL.
2. **Draft-pick reveal** (`showPickReveal`, user picks only): full-screen "THE PICK IS IN" card over the draft-stage art — round/pick, team, name, pos/age/scouted range/ceiling — with new `sfx.draftPick` (snare roll → horn + pop).
3. **Awards Night ceremony** (`runAwardsNight`): once per season when the offseason begins (guard `S.awardsCeremonySeason`), steps ROY → DPOY → OPOY → MVP (MVP last) over new `img/awards.png` (spotlit golden podium, navy curtains) with `sfx.fanfare`; "⭐ THAT'S YOUR GUY!" when the winner is yours. Offseason view's awards table unchanged (the ceremony is additive).
4. **THIS WEEK narrative lines**: 🏈 division rivalry tag, 😤 revenge game (they beat you earlier — week + score), 🔥/🧊 3+ game win/loss streaks. Flavor only, zero sim impact.
- CSS: `#pickReveal`/`#awardsNight` overlays + `.revealcard`/`.revealbtn`/`.potg`. Batteries green (2,985 + 17,537); copies synced.

## 2026-08-21 — Draft night + Gridiron Bowl scenes (approved follow-up)
- **Draft-day banner**: `viewDraft` header is now a `.draftbanner` div over `img/draft.png` (draft-night stage painting) with scrim + text-shadow — round/pick/on-the-clock line unchanged inside it.
- **Gridiron Bowl scene**: playoff `myGame` carries `bowl: P.stage === 3`; ticker scene picker puts `img/stadium_bowl.png` (fireworks + gold confetti championship stadium) first, plus a "🏆 THE GRIDIRON BOWL — neutral site" line atop the drive log (the Bowl has no weather line otherwise).
- Batteries green (2,985 + 17,537); copies synced.

## 2026-08-21 — Game-day atmosphere pass (Meshy art)
- **Weather-matched stadium backdrops**: 5 Meshy paintings in `img/` (stadium_{clear,snow,rain,cold,dome}.png) shown behind the ticker overlay. `runTicker` picks by `STADIUM.dome` + `myGame.weather.type` (snow/rain; cold+wind share the overcast scene; else clear) and sets a `linear-gradient(.82/.93) + url()` backgroundImage — flat-dark fallback if a file is missing. CSS: `#ticker` got background-size cover.
- **Trophy art**: `.champbox` (champion banner) now layers `img/trophy.png` (confetti trophy painting) under a scrim + text-shadow.
- No sim/gm logic touched; batteries green (2,985 + 17,537). Copies synced (~/GridironGM ↔ console gridiron-gm), pushed `5d465a2`. Deliberately did NOT art up tables/menus — user prefers systems-first UI; art is scoped to game-day + championship moments.

## 2026-07-22 — Autonomous improvement pass (3 features)
1. **Weather & stadium engine** (`sim.mjs`): STADIUM map (11 domes / 14 cold cities / rest mild). `gameWeather(seed, season, week, home)` is hash-deterministic — the THIS WEEK forecast IS the game's weather. Snow (pass −3.5, run +1, kick −10%, TO +1.5%), freezing, rain, wind; cold-city home teams get +1 run in snow/freeze ("built for it"). Ramps weeks 9→17; playoffs use week 18+stage; Gridiron Bowl is neutral/clear. Effects are symmetric so chalk holds. UI: forecast line + tooltip in THIS WEEK card, ❄️ icons on the schedule, conditions line atop the ticker. Season battery now runs weather-ON.
2. **Future draft picks in trades** (`gm.mjs`/`app.mjs`): `S.futurePicks` book; next-year R1–R7 tradeable at `FUTURE_DISCOUNT` 0.6× value. Trade Center has a "Next-year picks" row per side; AI offers sweeten with future 1s–3s when short (`genAIOffer` 5th param). `execTrade(..., futurePicks)` moves them; at `finishOffseason` the future book **conveys** and becomes `S.picks` (slot builder resolves `from` ownership unchanged). Save migration included.
3. **4th-down aggression dial** (`sim.mjs`/`app.mjs`): second gameplan slider (20–80%, Roster view). Riverboat converts punt probability into TDs AND turnovers-on-downs (ticker: "TURNOVER ON DOWNS — the gamble fails!", no INT charged); conservative punts/kicks more and protects the ball. Neutral 0.5 = zero sim change (batteries unaffected). AI coaches: AIR 0.58 / GROUND 0.46 / DEFENSE 0.42. Late-game situational logic still overrides.

Tests: sim battery 2,985 ✓ (new §5 weather + §6 aggression), gm battery 17,537 ✓ (future-pick value/exec/conveyance). No chalk retune needed.

**As of 2026-07-21.** Personal-use browser franchise sim (real NFL teams/players). Feature-complete through P4 + ~15 playtest-feedback rounds. Run: `cd ~/GridironGM && python3 -m http.server 8080` → localhost:8080. Tests: `node test/sim.test.mjs` (2,976 checks) + `node test/gm.test.mjs` (17,531 checks) — keep both green after ANY engine change (chalk/stat bands are regression-locked).

## Core sim engine (`src/sim.mjs`)
- Drive-based game sim, deterministic per seed. Chalky tuning (user pick): big favorites win 72–80% (EDGE_SCALE dial — ⚠️ every big data/logic change shifts it; recalibrate on the 4,000-game battery sample).
- **Field position**: turnovers hand the ball over AT THE SPOT; punts net ~38; missed FGs = spot of kick; TD drive length = actual field crossed; FG distance real (distance+kicker-based make prob).
- **End-game situational logic**: trailing = hurry-up, no punting down 4+ (go-for-it → convert or TO-on-downs), FG-hunting down 1–3; leading = conservative + clock-grind + **kneel-out** ("That's the ballgame", 56% of games). Clock stamped per-drive (hurry ×0.55, milk ×1.45).
- **2-pt conversions**: late game, classic chart (down 2/5/10/16, up 1/4/12), 48% success.
- **Safeties**: pinned ≤ own 8 → ~5.5% (+ vs live pass rush); 2 pts to defense + free-kick field position (~0.12/game).
- **Matchup engine** (`matchupEdges`): WR1 (speed/route) vs CB1 (coverage); top DL passRush vs WEAKEST starting OL passBlock. Capped effects (±2.6 rating pts) + star attribution (mismatch WR1 extra targets, mismatch rusher eats sack reps). Engineered mismatch = ~65% win rate, ~114 ypg for the WR; hard caps prevent cartoons (verified max game: ~200 rec yds, ≤6 sacks).
- Momentum, Q4 clutch variance, OT (points logged correctly), injuries (durability-weighted; +1 offset so short injuries really sit; heal weekly incl. per playoff round).
- Stat attribution coherence (battery-guarded): yards imply catches, TD catches are receptions, TD runs are carries; ~0.93 stat factor (penalties/incompletions).
- **QB mobility** (4th QB attr): generated INDEPENDENT of overall (pocket ~62; ~25 real dual-threats authored — Lamar 96, Daniels 93…). Mobile QBs take scramble share of rushing (Lamar season verified: ~4,200 pass + ~790 rush + rush TDs "TD scramble"), feed the offRun unit (Ground-scheme synergy).

## League / players (`src/players.mjs`, `src/data_*.mjs`)
- All 32 real teams + **809 authored real players** (~2025-26 rosters, Madden-style ovr; editable data file).
- **Position attributes are the real ratings** (OL passBlock/runBlock, RB spd/pow/hnd, etc.); overall is the blend; **teamUnits computes from attributes** → lineup/scheme choices matter (the 80-ovr run-mauler guard genuinely helps a run team).
- Manual **depth chart** (▲ promote; injury-independent order — injured starters return to their slot).
- Aging moves attrs WITH ovr (critical fix — sim reads attrs); dev leaps ≤25, positional decline curves, retirement, careers archived → **Hall of Fame** (threshold 320).

## GM layer (`src/gm.mjs`)
- Contracts (staggered 1–4yr → healthy rolling FA pools), 3 cap modes (strict $250M / soft +15% / none), payroll/dead money (cuts = 30% dead).
- **Free agency**: AI re-signs stars, then 3 market rounds (AI capped 1 hole-fill+1 upgrade per round — pool drains 217→~110, not to zero); leftovers become in-season **street FAs** (1-yr deals).
- **Draft**: 224-prospect classes with scouting fog + **~10 hidden sleepers** (true 76-88 hiding late) + ~7 busts (top-board frauds); pick trading with real slot conveyance ("via TEAM"); rookie-pool cap projection warning.
- **Scouting**: +2 pts/week (cap 24, start 8); 1 pt tightens range (re-centers on TRUTH — the sleeper-reveal moment), 2nd = exact + ceiling read; class browsable all season w/ position filters.
- **Trades**: full-roster picker, picks R1–7, AI valuation (age/upside/injury-discounted), depth-gutting guards both sides, **salary-shedding trades always legal** (cap-hell escape); **AI-initiated offers** (~22%/wk ≤ wk8, premium-priced, expiring).
- **Extensions**: expiring players extendable in-season (fixed seeded ask, 1.15 premium).
- **Coaches = team identity**: AIR/GROUND/DEFENSE/BALANCED schemes, 1–3★, roster-fit-scaled unit bonuses; hire market each offseason; AI teams play their schemes (pass-lean) and churn coaches.
- **Training focus** 🎯: click attrs on roster (max 3); applies at END of offseason (settable through FA/draft, incl. rookies); topbar chip + FA reminder so it can't be missed; ovr recomputes from attrs.

## Living world (`src/app.mjs`)
- Weekly **news feed** (blowouts/upsets/milestones/star injuries/trades/records/playoffs/champion).
- **Owner goals + job security** → firings (grace season 1) → take over a bottom-10 team.
- Awards (MVP/OPOY/DPOY/ROY) + **Records Book** — locked at week 18 (regular season only, playoff stats excluded).
- **Steppable playoffs**: one round per click, YOUR games on the ticker, live Playoff Picture (preview matchups w/ records + ⭐, scored results, 🎉/💔), champion banner FIRST in History view + news headline.
- Weekly **THIS WEEK card**: opponent units, coach scheme, gameplan hint + 🔥/⚠️ **matchup intel** both directions.
- Gameplan **pass-lean slider** (30–75%) feeding the sim.
- Leaders view with **NFL/NFC/AFC filters**; per-game **box scores** (carries/ypc included) via ticker button + nav.

## Presentation
- Ticker ~30s, clock + quarter, scorer names, SHORT FIELD/backed-up/HURRY-UP/grinding-clock tags, kneel-outs, safety calls, 2-pt callouts.
- Procedural WebAudio SFX: tackle thud (punt/kneel), boot+flight (FG, roar/groan), catch-smack vs footsteps+smash (pass/run TD), whistle (TO/safety), **air horns** on scores, vocal-chorus crowd (⚠️ noise-based crowds failed twice: white=static, brown=wind — pitched voices only), optional `crowd.mp3` auto-detect, 🔊/🔇.
- Real logos (ESPN CDN), team-color topbar, zebra tables, clickable (?) tooltips, onboarding card.
- **NFL-formula schedule**: 6 div (only repeats) + 4 rotating same-conf + 3 other same-conf + 4 rotating cross-conf; zero non-division repeats, zero back-to-back rematches (whole-week-reorder spreader).

## Parked ideas
Pro Bowl, save slots/export, deeper glossary, per-quarter box lines, multi-team trades, future-year picks.
