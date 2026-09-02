# THE GRUMP — A Corporate Survival Game

(Renamed from "Don't Be A Soung" on 2026-09-02 — folder `the-grump`, gameId `the-grump`, save key `grump_best`.)

Parody arcade game: WarioWare-style rapid mini-games about surviving a workday as David Soung,
a grumpy employee who just wants to be left alone. Pat is the relentlessly optimistic coworker.
Playful, not cruel. Source prompt + reference portraits: `D:\DontBeSoung\`.

## Loop
- Workday clock 8:01 AM → 5:00 PM. 12 regular mini-games (each ≈ 44 clock-minutes) then the boss at 4:58 PM.
- Between games: corporate transition card ("ALIGNING STAKEHOLDERS...") → title card (⚠ PAT DETECTED ⚠ when Pat is involved, +5 grumpy) → play → result banner.
- Lunch Defense fires once, the first game after the clock passes noon (flagged done when it STARTS — a Full Soung Mode mid-lunch used to re-queue it over and over).
- Grumpy meter 0–100. Failures add (Slack +5, meeting +15, quick question +10, away +15, wrong button +5). Clean wins relieve −5.
- 100% → FULL SOUNG MODE (8 s smash-fest, +2000, +50 per object, screen shake, slow-mo, BAM text) → meter resets to 30%.
- Each Full Soung Mode spends one of 3 PATIENCE (😤 icons in HUD). Hitting 100% with none left → SOUNG HAS HAD ENOUGH (game over).
- Difficulty scales 1.0 → 1.7 across the day (spawn rates, speeds, timers).

## Mini-games (`src/minigames/`) — reworked 2026-09-02 (user: keep Hallway + Slack, the rest "not fun")
Slack pings are PAT's messages (`PAT_PINGS` in state.js, avatar bubbles) — 2026-09-02 user ask.
Design rule from that pass: every game is continuous ACTION — move, dodge, swat, jump. No menus, no waiting.
| id | Title | Win | Fail |
|---|---|---|---|
| hide_and_seek | HIDE AND SEEK | Pat sweeps a flashlight from the back counter; move (←→/drag) between 4 cover spots. Cover gets "taken" by coworkers (⚠ 0.7 s warning) so you keep relocating. Beam must linger 0.32 s to spot you ("?" meter over Pat). 0 spots = +500 | each spot +10 ("Found you!") |
| slack_attack | SLACK ATTACK | swat flying notifications 10 s (+100 each); Pat is the sender on his phone | each hit +5 |
| meeting_declined | INVITE STORM | invites rain onto the calendar strip; click RED junk to decline (+250) before it lands; let GREEN ones (Team Lunch / RKTs / Early Release) land (+150) | junk lands +15; clicking a green one +10 ("YOU DECLINED RKTs?!?!") |
| elevator_sprint | ELEVATOR SPRINT | auto-run to the elevator; click/SPACE to jump (double-jump) wet-floor signs, chairs, boxes, carts; each trip slows you and lets Pat close the gap. Reach it = +400 | Pat catches up → +15 |
| hallway_escape | HALLWAY ESCAPE | dodge coworkers 9 s, ←→ or drag (+300); Pat walks it once (bigger, "There he is!") | catch +10, Pat +20 |
| lunch_defense (noon) | LUNCH DEFENSE | hands reach in from 9 lanes (sides + over the shoulder) for the sandwich/fries — click to SLAP (+100); shoo Pat off the chair (Soung voice lines) 10 s. 0 bites = +1000, 1–2 bites = +500 (still a win) | each steal +5 (food shrinks), Pat sits +10; 3+ bites = LUNCH RAIDED |
| whack_a_pat | WHACK-A-PAT | Pat pops up over 7 cubicle walls; click to bonk (+150; "₿ BITCOIN?" Pat +300 → Soung: "No. No bitcoin."). Coworkers pop up too — bonking one = HR COMPLAINT. ≤2 questions slipped = win +300 | each un-bonked Pat +5, coworker +10 |
| paper_toss | PAPER TOSS | drag-and-release to flick memos into the bin; Pat's desk fan = wind (arrows show it); dotted preview while aiming; bin relocates per basket. 3 baskets in 11 s = win (+200 each, +200 bonus) | each miss +3 |
| rkt_run | RKT RUN | red light / green light: HOLD (click/SPACE) to creep across the break room to the RKT tray while Pat is busy at the coffee machine ("☕ ..."); "hm?" warning 0.38 s, then 👀 LOOKING — any movement (momentum counts!) = caught, knocked back 200 px. Reach the tray in 12 s = +500 | caught +10 each; timeout = NO RKTs TODAY |
| boss (4:58) | JUST ONE MORE THING | DECLINE button GLIDES and rebounds; 24 hits; phase 2 adds ACCEPT ALL / REPLY ALL trap buttons that shadow it; invites fly in to swat (+1500) | invite hit +4, trap +10 |

## Pause (2026-09-02)
ESC or the ⏸ HUD button pauses the workday (clock/timers frozen, music + voices stopped): RESUME (ESC/Enter) or
MAIN MENU (abandons the day, back to the title). Game-over screen also has a MAIN MENU button now.

## Audit pass 2026-09-02 (user: "look for bugs/annoying things, polish every mini-game")
- BUG Hallway: a coworker overlapping Soung registered a hit EVERY FRAME for ~0.4 s (one bump ≈ +200% grumpy). Now one hit per coworker (`c.hit`); regression test.
- Hide and Seek started with Pat's beam ON Soung (spotted at t≈0.3). Beam now starts far left + 1 s grace.
- Slack Attack aimed pings at the chest; head moved up with the head fix → target y 295. Reaction/grumpy popups moved off the face (Invite Storm, workday `+N% GRUMPY`, intro "…").
- Elevator Sprint: obstacle gaps could be shorter than a jump at high difficulty. Speed 380·diff^0.6, gaps 480–680/diff^0.3, jump −1000/g 2700 (length ≈ 280–390 px), forgiving hitbox (feet above ~⅔ of the obstacle clears).
- Lunch: hands slower (√diff), no more hands rising through the table, 1–2 bites still a (smaller) win.
- Whack-a-Pat: pop-ups 1.1–1.5 s/√diff, spawn 0.45–0.7/√diff, 2 slips allowed; Soung swings the newspaper only on a bonk (was frozen in the rage pose).
- Downtime between games trimmed (transition 0.9 s, intro 1.1/1.6 s). How-to mentions pause.
- VISUAL PASS (same day, node-canvas headless renders in scratch `render.mjs`/`render2.mjs` — first time we could SEE frames):
  break room rebuilt (chalkboard menu, blinds window, back tables, vending machine, fridge, coffee station, tiled floor,
  vignette); WHACK-A-PAT on a new 'openplan' backdrop (window band, ceiling lights, carpet) with cubicles that fit the
  screen (rightmost used to hang off the edge) + monitor/sticky-note details; lunch sleeves were 560px bars → short
  tapered gradient sleeves; table skirt hides Soung's legs; SEATED = body clipped at the desk edge (`o.deskY`, default 502)
  so he sits BEHIND desks instead of standing in front with legs over them; Pat's 75%-grumpy heckle is a Slack card
  (walk-in Pat doubled the game's own Pat); Slack Attack top spawns moved under the HUD (bubbles there ate pause/mute
  clicks — the test bot literally paused the game); instruction lines shortened so they clear the timer pill;
  intro grumpy meter bottom-left, Slack thread fades when Pat walks in; game-over Pat line is a card (was behind stats).
- Difficulty rule of thumb now: reaction-time games scale with √diff, not diff.

## Pat volume (2026-09-02, user: "a bit much", but it's the funniest part — don't cut too much)
Result banners: Pat comments on ~65% (was 100%). Title peek every 11 s (was 7). Invite Storm: a line every 6th spawn
(was 4th). Whack-a-Pat: 25% of pops speak (was 40%). Boss: a line every 4.6 s (was 3.2). Everything else unchanged.

## Fun pass 2026-09-02 (user: "make the games more fun, add one more game, keep the humor")
- NEW: RKT RUN (above). Voice: pat_was_that_you / pat_dont_move / pat_gotcha (+ existing rkt/there, soung_deal_with_it).
- WIN STREAKS: consecutive mini-game wins from the 2nd pay +100×streak (cap 500) with an orange STREAK ×N stamp on the
  result banner; `S.streak`, `stats.bestStreak` (shown on the end screens). Boss doesn't count either way.
- In-game rewards: Slack CHAIN (swats <0.7 s apart: +25/link, cap +150), Whack COMBO (3+ bonks in a row: +50/extra),
  Paper ON FIRE (back-to-back baskets +100), Elevator ☕ pickups (+50, float at jump height between obstacles),
  Hide & Seek "not today +50" when the beam sweeps over you while hidden.
- REPORT CARD: grade stamp S/A/B/C/D (`grade()` in state.js: 26k/19k/13k/7k) with a one-liner on win + game-over.

## Scoring
Pat avoided 500 · useless meeting declined 250 · Slack ignored 100 · lunch protected 1000 ·
Full Soung Mode 2000 · smash 50 · boss 1500 · survive 5000. Best score/days in localStorage
(`grump_best`); score posts to the console leaderboard (`imaginex-score`, gameId `the-grump`).

## Intro cinematic (`src/scenes/intro.js`, 2026-09-02)
Plays on a player's FIRST EVER "START WORKDAY" (localStorage `grump_intro_seen`) and CANNOT be skipped that time; afterwards it is skipped, and "▶ INTRO" on the title replays it (skippable);
any click/key skips straight into the workday (except on that mandatory first viewing). Deadly-serious AAA opening, joke never explained — ≈57 s:
black slate (AMAZON CORPORATE OFFICES / MONDAY / 08:00 AM, low drone) → narration ("For most people, it was just
another Monday." / "For David Soung..." / "it was about to get much worse.") → "He had one goal. Survive until 5:00 PM." → slow-mo coffee walk (epic fanfare)
→ sits, laptop opens, UNREAD counter spins to 247 (eyeroll) → 8:01 AM clock close-up (silence) → DING "PAT: There he is!" → DING "Hey Soung..." → DING "Quick question."
(horror sting + music) → face close-up, eye twitch → GRUMPY METER: 3% → footsteps → Pat walks in → ⚠ PAT DETECTED ⚠
(alarm, shake) → Pat: "Hey Soung! I was just coming over because y—" → Soung: ". . ." → "This should only take
five minutes." → GRUMPY METER: 17% → Pat: "I'll just grab a chair." (Soung: rage) → THE GRUMP slams in (bam, flash) → A Corporate Survival Game → workday.
Beat times live in the exported `T` table at the top of intro.js. Music: `musicCinematic` / `musicEpic` /
`musicHorror` + `sting` SFX in audio.js (all procedural, replaceable via `CUSTOM_FILES`).
Narrator VO = Voicebox preset profile "Narrator" (Kokoro engine, voice `am_onyx`, deep male; profile id
6cbb03e2-ab46-481c-a20b-600ebd84358a) — `test/voicebox_intro_lines.py` generates (skips existing files; delete a
wav to redo it). The first attempt (Pat's clone pitched down via a WAV-header trick) was rejected by the user as
"weird" — don't bring it back. Swap the narrator by dropping new `audio/narr_*.wav` files.

## Screens
Title (Soung at desk, notifications pile up, he goes annoyed → eyeroll → angry) · How to play ·
Workday · Game over (Soung walks off, stats) · Win (5:00 PM quiet → SURVIVED → sunglasses →
walk to EXIT → Pat: "before you go..." → freeze → TO BE CONTINUED + stats).

## Architecture
`src/engine.js` (loop, input, shake/slow-mo/flash) · `draw.js` · `particles.js` · `audio.js`
(procedural, file-replaceable) · `state.js` (RunState rules, constants) · `characters.js`
(head sprites + procedural bodies + expression overlays) · `office.js` (backdrops, HUD) ·
`minigames/registry.js` (`registerMinigame`, `MiniGame` base) · `fullsoung.js` · `scenes/*`.
Add a mini-game: new file extending `MiniGame`, call `registerMinigame`, import it in
`minigames/index.js`. Art swap: see `ASSETS.md`.

## Testing
`node test/smoke.test.mjs` — 36 checks: registry, clock, grumpy clamps, idle run → 3 rages →
game over, scripted perfect run → win at 5:00 PM with every mini-game seen, each mini-game under
random input, all screens rendered with a stub canvas.

## Status
- 2026-09-01: v1 built. First playtest: faces (elliptical crops + drawn overlays) rejected → replaced
  with 10 Meshy image-to-image heads + full-body Pat + 3 full-body Soung poses w/ head overlay (see ASSETS.md).
  Voice lines are WAV (user's recorder outputs WAV). games.ts entry is `coming_soon`.
- 2026-09-01 (later): APPEAR BUSY removed (user: "boring") → CLOSE DOOR elevator mash game. 8 more Pat quotes woven in.
- 2026-09-02: MINI-GAME REWORK (see table) + Soung voice via Voicebox.
- 2026-09-02 (later): RENAMED to THE GRUMP (title screen, cover banner re-rendered, gameId/folder `the-grump`);
  INTRO CINEMATIC (above); PAUSE; lunch table fix (Soung behind the table, plate on it); HEAD FIX — the overlay head now sizes its face to the shoulders and puts the chin on
  the collar (was: sprite bottom on the chin line → head too small + its whole long neck showing). See ASSETS.md.
- Ideas: more mini-games (Printer Jam, Reply-All Storm, Camera-On Call),
  Tuesday+ difficulty days, Pat voice lines, daily seeded workday leaderboard.

## Pat everywhere (2026-09-01 pass) + voice lines
Pat is the comic engine, so he now appears in every screen: title peek-ins (every 7 s), 30% of
transition cards are Pat quotes, every intro card (with voice), a comment on EVERY result banner
(success → he feels ignored; failure → he's thrilled), a no-penalty heckle from the right edge when
grumpy crosses 75%, Slack Attack sender (phone), Meeting Declined sender (beside the card), Appear
Busy watcher (over the cubicle wall), Hallway walker (bigger, +20 grumpy, "There he is!"), Lunch
approach lines, Boss-fight sidekick cycling lines, Full Soung Mode corner peek ("Why are you so
grumpy?"), game-over walk-out, and the win finale.

**Voice lines** — `src/audio.js` `VOICE_FILES`; `audio.say(key)` plays the mp3 with the bubble,
one at a time, silent if the file is missing. Drop files in `audio/`:

| file | line | where it plays |
|---|---|---|
| `pat_soung.wav` | "Soung!" | intro cards, Appear Busy warning, title peek |
| `pat_there_he_is.wav` | "There he is!" | intro cards, hallway Pat, lunch 2nd visit, Appear Busy fail |
| `pat_lunch.wav` | "Soung... what's for lunch today?" | Lunch Defense intro + first approach, title peek |
| `pat_ignoring.wav` | "Soung, are you ignoring me?" | Slack Attack mid-round, most success banners |
| `pat_why_grumpy.wav` | "Why are you so grumpy?" | Full Soung Mode, grumpy ≥75% heckle, game over |
| `pat_quick_question.wav` | "Soung, quick question." | intro cards |
| `pat_got_a_sec.wav` | "Got a sec?" | intro/transition cards, hallway catch, boss, failure banners |
| `pat_five_minutes.wav` | "This should only take five minutes." | intro cards, boss, meeting sender, failure banners |
| `pat_idea.wav` | "I've got an idea!" | intro/transition cards, boss, failure banners |
| `pat_meeting.wav` | "I scheduled us a meeting." | boss intro, meeting sender |
| `pat_quick_look.wav` | "Can you take a quick look at this?" | intro cards, boss, meeting sender |
| `pat_before_you_go.wav` | "Hey Soung, before you go..." | win finale |
| `pat_busy.wav` | "You look busy! Anyway..." | intro cards, success banners |
| `pat_told_them.wav` | "I told them you'd handle it." | intro cards, failure banners, boss, Close Door fail |
| `pat_not_busy.wav` | "You're not busy, right?" | intro/transition cards, Close Door |
| `pat_added_you.wav` | "I added you to the meeting." | meeting sender, boss, failure banners |
| `pat_quick_call.wav` | "Can you jump on a quick call?" | intro/transition cards, Close Door |
| `pat_said_yes.wav` | "I already told them you said yes." | boss phase 2, failure banners |
| `pat_hear_me_out.wav` | "Soung, hear me out." | intro cards, 75% heckle, success banners, Close Door |
| `pat_mentioned_name.wav` | "I may have mentioned your name." | transition cards, meeting sender, game over |

| `pat_hold_the_door.wav` | "Soung! Hold the door!" | Close Door, second half of Pat's sprint |
| `pat_rkt.wav` | "Ooh, are those Rice Krispy Treats?" | the RKT invite card |
| `pat_intro_coming.wav` | "Hey Soung! I was just coming over because y—" | intro cinematic |
| `narr_offices/monday/soung/worse.wav` | narrator (intro slates + narration) | intro cinematic |

**Soung (optional, a second voice):** `soung_ugh.wav` (a grumble — replaces the synth grumble on every grumpy hit, the most-heard sound in the game), `soung_no.wav` ("No." — every 4th DECLINE smash in the boss fight), `soung_eating.wav` ("I'm eating." — shooing Pat at lunch), `soung_deal_with_it.wav` ("Deal with it." — sunglasses moment on the win screen).

| `pat_where_did_he_go.wav` | "Song? Where'd he go?" | Hide and Seek start / success banner |
| `pat_wait_for_me.wav` | "Soung, wait for me!" | Elevator Sprint start |
| `pat_found_you.wav` | "Found you!" | Hide and Seek spot |
| `pat_reply_all.wav` | "I replied all." | boss REPLY ALL trap |

Soung lines installed (Voicebox "Soung" profile, 2026-09-02): ugh (replaces synth grumble), no, eating, deal_with_it, not_today, leave_me_alone, seriously (declining free food).

| `pat_bitcoin.wav` / `pat_ow.wav` / `pat_peekaboo.wav` | Whack-a-Pat | 
| `pat_nice_shot.wav` / `pat_missed.wav` / `pat_show_you.wav` / `pat_so_close.wav` / `pat_fan_up.wav` | Paper Toss (first miss = "Missed! Want a hand?", repeats rotate the other three, never twice running) |
Soung extras: not_now, go_away (bonks), no_bitcoin.

ALL 31 Pat lines + 10 Soung lines installed 2026-09-02 (41 wavs): 5 recorded by the user in Voicebox, 17 generated by
`test/voicebox_lines.py` against the local Voicebox API (http://127.0.0.1:17493, cloned profile
"Pat", engine qwen 1.7B, no instruct; text spells the name "Song" so TTS says it right). Re-run the
script to regenerate any missing file (it skips existing ones). Soung's 4 optional lines are still open.
