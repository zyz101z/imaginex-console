# GRIDIRON GM — Game Design Document

**v0.1 — 2026-07-20 (draft, pre-build)**
Browser-based pro-football franchise management sim for ImagineX (www.imaginex.games). You are the GM/head coach: build the roster, set the strategy, then **watch the games play out — you don't control the players**. Text/2D-panel presentation, zero art pipeline, all systems. (Deliberately in the Football Manager / Basketball GM lineage, not Madden.)

---

## 1. Vision

**One line:** Draft, sign, scheme, simulate — build a dynasty in a living fictional football league where every decision compounds across seasons.

**Pillars:**
1. **Decisions, not dexterity.** The fun is roster construction, cap tetris, draft gambles, and strategy calls. Zero reflex gameplay.
2. **The sim must tell stories.** Games produce drives, momentum swings, injuries, breakout rookies, busts — readable narratives, not just final scores.
3. **Numbers you can trust, fog you can't.** Player ratings exist under the hood, but you see *scouted estimates* with error bars that shrink with exposure. Finding gems is the game.
4. **Seasons in one sitting.** A full season (draft → playoffs) playable in ~30–60 min at default speed. Multi-season dynasties are the retention loop.

**Explicitly NOT in scope:** play-calling per snap, animated field graphics beyond a simple drive ticker, multiplayer leagues (v1).

**REAL NFL MODE (decided 2026-07-20):** real 32 NFL teams + real current players (user decision — personal-use game, not published for distribution; do NOT register it publicly on the ImagineX shelf without revisiting this). Implications:
- Rosters/ratings ship as a **bundled data snapshot** (authored from knowledge, Madden-style ratings; ~2-deep depth per position ≈ 800–1000 rated players) + team identities/colors. No live API.
- **Future draft classes are procedurally generated** (real prospects unknowable) — the league organically becomes a real/fictional hybrid as seasons advance, which is standard franchise-mode behavior.
- Scouting-fog mechanic now applies mainly to generated rookies; veteran ratings are known quantities (light fog on low-profile players only).
- No logos (team names + colors only, procedural monogram chips) — keeps it clean even for personal use.

---

## 2. The League (fictional, NFL-shaped)

- **Real NFL structure:** 32 teams, real divisions/conferences (AFC/NFC), real team names + colors. User picks their team; relocate/rebrand still available as an endgame perk.
- **17-game season** + playoffs (7 seeds/conference, wild-card → super bowl equivalent: **"The Gridiron Bowl"**).
- **Rosters:** 53 players; gameday relevance concentrated in ~2-deep depth chart per position to keep management tractable.
- **Positions:** QB, RB, WR, TE, OL (generic, 5 starters), DL, LB, CB, S, K/P (combined "K"). 11 buckets — simplified from real football but preserves every meaningful roster decision.
- **Calendar loop:** Offseason (retirements → re-sign window → free agency → draft → training camp) → Preseason (2 games, evaluate rookies) → Regular season (17 wks) → Playoffs → repeat. Each phase is a screen with clear "advance" gating.

## 3. Players (the content engine)

Procedurally generated, persistent, aging:
- **Ratings (0–99):** per-position core attributes (QB: arm, accuracy, decision, mobility; RB: speed, power, hands, vision; etc. — 4 per position + universal: durability, discipline, clutch). Overall = weighted blend.
- **Hidden true ratings vs scouted ratings.** Scouting reveals ranges ("72–88 arm") that tighten with combine, film (weeks on roster), and scout spend. Draft busts/steals emerge naturally from the error model.
- **Development:** age curves by position (RBs peak ~25, QBs ~29, OL long plateau), growth spurts driven by hidden *potential* + playing time + coach quality; regression cliffs late.
- **Personality dice:** work ethic, ego, injury-proneness — surfaced through scouting reports as flavor text ("gym rat", "locker-room concern").
- **Names/faces:** generated name pools; identicon-style procedural avatars (colored geometric "cards") — zero art needed, distinct at a glance.

## 4. The Sim Engine (the heart)

**Drive-based simulation** (not per-snap): each game = alternating possessions resolved by matchup math + variance.

- Per drive: compute offense-vs-defense edge from position-group strengths (OL vs DL, QB+WR vs CB+S, RB vs LB), modified by **team strategy sliders**, home field, weather, fatigue, injuries, clutch in close 4th quarters.
- Drive outcomes: TD / FG / punt / turnover / downs, with yardage + time-of-possession so box scores look real. Big-play chance scales with speed mismatches.
- **In-game momentum:** small compounding modifier after turnovers/scores — creates comebacks and collapses (capped so it flavors, not dominates).
- Injuries roll per game weighted by durability + usage; out 1–8 wks, next-man-up from depth chart.
- Output artifacts: score by quarter, drive log ("Q3 7:42 — 9 plays 74 yds, Marek TD pass 23 to Boone"), player stat lines (passing/rushing/receiving/tackles/sacks/INTs), season-long stat accumulation → awards, records, league leaders.
- **Watch modes:** instant result / ticker (drive-by-drive text crawl, ~45s a game, skippable) / full week auto-sim. User's game defaults to ticker; league games instant.
- Deterministic given seed + inputs → **fully headless-testable** (same harness philosophy as Divided States/BREACH: `node test/sim.test.mjs` batteries for balance distributions — league-average scores, pass/run splits, injury rates vs targets).

## 5. Team Strategy (the coaching layer)

Set weekly (or set-and-forget):
- **Offense:** pass/run lean, tempo (bleed clock ↔ hurry-up), aggression (4th-down/2-pt tendencies, deep-shot rate).
- **Defense:** blitz rate (sacks/TOs ↔ big plays allowed), coverage shell (man ↔ zone; counters opponent WR/TE profile).
- **Usage:** feature-back vs committee, target distribution, rest starters (late season, clinched).
- Strategy interacts with personnel (heavy blitz needs LB/CB quality) and matchup preview screen shows opponent tendencies — the weekly "gameplan" decision in 30 seconds.
- **Coaches (v1 light):** one head coach + OC/DC as hireable staff with scheme identities (+dev speed, +scheme fit bonuses). Deep staff trees deferred.

## 6. Roster Management (the GM layer)

- **Salary cap — new-game option (user decision 2026-07-20):**
  - **Strict cap** (default, ~$250M): hard ceiling, AI and user both bound. The "real GM" experience.
  - **Soft cap:** can exceed cap with a luxury-tax-style penalty (escalating dead-money surcharge + owner-goal pressure). Sandbox-with-consequences.
  - **No cap:** pure fantasy roster building; AI teams still spend semi-realistically so the league isn't uniformly stacked.
  - Contracts (years/salary/signing bonus with simple dead-money on cuts), rookie scale by pick. Cap screen always visible in capped modes.
- **Draft:** 7 rounds × 32. Pre-draft: combine results + scout allocation (you have limited scouting points to spend across prospects). Draft day: pick or trade picks (AI teams draft by need+BPA with error). Rookie class quality varies by year.
- **Free agency:** offseason market with AI bidding (offers reflect player ego/winning desire/money), plus in-season street FAs (injury replacements).
- **Trades:** players+picks, AI valuation with team-context modifiers (contender buys, rebuilder sells), trade-finder UI ("shop this player"). Deadline week 9.
- **Re-sign window:** expiring contracts, franchise-tag-like "priority tag" (1/yr).
- AI GMs run the other 31 teams through the same systems (draft, sign, trade, cut) with archetype personalities (win-now, analytics, hoarder).

## 7. Season Feel & Narrative

- **League news feed:** weekly headlines auto-generated from sim events — trades, injuries, streaks, records, award races. This is the "living world" glue.
- **Standings/playoff picture** with tiebreakers; clinch/eliminated flags.
- **Awards:** MVP, OPOY/DPOY, ROY, All-League teams; **Hall of Fame** for retired greats (dynasty history screen).
- **Owner goals:** soft objectives (make playoffs in 3 yrs / stay under cap / develop a franchise QB) → job security meter. Getting fired = game over (or takeover another team — roguelike-ish continuity).
- **Franchise history:** every season archived (records, champions, your draft history with hindsight grades — "you passed on…").

## 8. UI / Presentation

- **Single-page app, panel-based** (same iframe pattern as the ImagineX shelf): left nav (Roster / Depth Chart / Strategy / Schedule / League / Draft / Finances), central content tables, top bar (date, cap space, record, ADVANCE button).
- Aesthetic: clean sports-almanac — dark theme, team-color accents, dense readable tables, procedural avatar chips. Zero image assets.
- **The ADVANCE button is sacred:** one obvious way to move time forward; everything else is optional depth. New players can just mash advance and watch their team play.
- Game ticker: scoreboard + drive-log text crawl + win-probability sparkline (dataviz skill for charts).
- Mobile: tables collapse to cards; it's a menu game — inherently touch-friendly.

## 9. Tech

- **Stack:** ImagineX standard — self-contained game folder `public/games/gridiron-gm/` (`index.html` + modules), TypeScript-free vanilla JS or ES modules per house style, localStorage saves (slot per franchise; export/import JSON like other shelf games).
- **Sim core as pure functions** (state in → state out, seeded RNG): headless test batteries for stat realism (e.g., league passing yds/game within 210–260 target band across 100 sim-seasons, injury frequency, draft-class value curves).
- **Save size:** full league (32 teams × 53 players × history) ≈ a few hundred KB JSON — fine for localStorage; prune deep history past N seasons.
- **Leaderboard hook (ImagineX Upstash):** "Dynasty Score" (weighted: titles, playoff apps, seasons survived) — one number for the shelf leaderboard via the standard postMessage contract.
- No external APIs, no backend beyond the existing leaderboard route.

## 10. Build Phases

| Phase | Deliverable | Exit test |
|---|---|---|
| **P0 — Sim kernel** | Player/team generation + drive-based game sim + box scores, headless only. | Stat-realism battery green (score dists, stat lines pass eyeball + band tests). |
| **P1 — Season loop** | Schedule, standings, playoffs, awards; minimal UI (advance + tables + ticker). | Play a full season in-browser; ticker readable; season < 45 min. |
| **P2 — GM layer** | Cap/contracts, draft (+scouting fog), free agency, trades, re-signs, AI GMs. | Multi-season dynasty holds together; AI rosters stay sane over 10 sim seasons (headless league-health test). |
| **P3 — Living world** | News feed, owner goals/firing, HOF/history, strategy depth, coach hires. | A stranger can follow their team's story season to season. |
| **P4 — Polish pass** (user-flagged items) | **Visuals:** logos throughout (ESPN CDN pattern already in app.mjs), team-colored headers, prettier tables, general look upgrade. **🔊 SFX (user request 2026-07-20):** per-drive-result ticker sounds — PUNT = tackle thud, FG/FG-MISS = ball-kick foot impact, **passing TD = catch sound** (distinct), **rushing TD = its own sound** (crowd-pop/grunt-and-run), plus probably TO = crowd gasp/whistle and a TD crowd roar layer. Procedural WebAudio (Tank Wars/BREACH pattern — no audio files) unless user supplies clips; mute toggle. Also: onboarding, save slots. NO public shelf registration (real-NFL personal-use). | Family playtest; sounds match drive results correctly in ticker. |

## 11. Design Decisions Made (defaults — flag to change)

1. ~~Fictional league~~ **CHANGED 2026-07-20: Real NFL teams + players** (personal-use only; bundled roster snapshot; generated future draft classes; keep off the public shelf unless revisited).
2. **Drive-based sim**, not play-by-play — 10x cheaper to build/balance, still produces real box scores and stories. Play-level detail can be layered later inside the drive resolver if wanted.
3. **GM+Coach combined** role — you do both jobs; no separate coach-mode toggle in v1.
4. **Single-player only** — AI league. (An async "versus a friend's exported team" mode is a fun v2 idea, à la Tank Wars room codes.)
5. **One franchise per save slot**, multiple slots.

## 12. Decisions Log (settled 2026-07-20 with user)

1. ✅ Ticker pacing: **~30s** per user game (skippable as always).
2. ✅ Owner firing: **ON** — job security is real, with a forgiving early grace period.
3. ✅ **Tooltip glossary: yes** (dead money, franchise tag, etc.) — build in P3.
4. ⏳ Upset rate: explained to user, awaiting pick — Realistic (~65% favorite wins, real-NFL chaos) vs Chalkier (~72-75%, roster quality more reliably rewarded). Fallback: ship as a new-game "chaos" option (Realistic / Balanced) next to cap mode.
5. ✅ Roster snapshot (~2025-26, authored from knowledge) is **good enough to start**; rosters are editable JSON for hand-fixes.
6. ✅ User's team: **MINNESOTA VIKINGS** — highest authoring care on their roster/depth chart; "does my team feel right" = the realism benchmark.
7. ✅ Cap: **three new-game modes — Strict / Soft (luxury-tax style) / No cap** (see §6).
