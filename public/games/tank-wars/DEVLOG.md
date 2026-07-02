# TANK WARS — DEVLOG

## ⏭️ NEXT SESSION — START HERE
1. **Balance feel-check** (user hasn't played v2.0 progression yet): Photon vs Ace
   ("Lights Out"), campaign difficulty curve, scrap earn rate for a 9-year-old's patience.
2. **iPad verdict on the v2.1 touch controls** — rebuilt 2026-07-02 (see below); logic is
   test-proven but thumb-feel needs the real device. Tunables: JOY_DEAD (10), JOY_MAX (52),
   min throttle (0.35), FIRE button size/position (52px @ W-84,H-84).

## Session log — 2026-07-02
| Ver | Commit | What |
|---|---|---|
| v2.1 | (this) | **Mobile controls rebuilt** (was: "really bad"). Root cause: steering angle was finger-relative-to-TANK → haywire when tank reached the finger; zero visual affordance. Now: floating virtual joystick (anchors under thumb on left 45%, absolute screen direction like keyboard, 10px deadzone, analog throttle 0.35–1.0 by deflection) + visible FIRE button (any right-side touch still fires) + overlay shows during countdown so thumbs pre-position. Tests 54→59 (T15: steer/throttle/deadzone/full-stop). `?touchdemo=1` screenshot hook |

## Session log — 2026-07-01 (game created start-to-finish, then 6 feedback rounds)

| Ver | Commit | What |
|---|---|---|
| v1.0 | `6e5a7df` | Game built + shipped autonomously as "Tank Bros" (maze duel, bouncing shells, power-ups, sudden death, 1P/2P, 21 headless tests) |
| v1.1 | `079bf68` | "Hard to drive" → directional controls + full-normal wall pushout (doorway-lip snag: 43/225px → 207/225) |
| v1.2 | `f70cb08` | Still "turns weird" → movement follows input SAME FRAME (hull swivel = cosmetic 11rad/s) + Pac-Man corner assist (probe 9/17/26px). LESSON: never gate movement on sprite rotation |
| v1.3 | `63ee76a` | Victory screen "too much ringing" → endMatch had no terminal phase, re-fired 60×/s (fanfare stacking + unbounded confetti). Added `matchover` phase. LESSON: drive tests INTO end screens and linger |
| — | `68b15a1` | Renamed → **Tank Wars**, user-made cover art (TankWars.png → cover.jpg 449KB via sharp). Full id/key rename |
| — | `0898bc5` | 2P same-keyboard removed (user won't use it; networked 2P = future wish, seat-2 plumbing dormant). Menu flattened; WASD+arrows both drive |
| — | `caf07b8` | Background music (user's "Tank Wars.mp3" → music.mp3): loops in matches, fades at victory, mute-linked. ⚠️ Vercel missed this push → fixed with empty retrigger commit `c50f81b` |
| v2.0 | `9767246` | **PROGRESSION:** SCRAP economy (+10 round win/+2 loss, 50/100 bonuses), GARAGE (Scout/Mammoth 150/Viper 400/Pinball 800/Photon 1500 — enemy AI drives them too), 10-battle CAMPAIGN (first-to-3, stars, rewards 30→150, replays 25%, OFFICER AI tier), arenas maze/dense/pillars/corridors/shifting. Tests 30→54; T13 caught corridors arenas 97% disconnected → stub placement now connectivity-checked |

## Key facts
- Location: `D:\ImagineX\imaginex-console\public\games\tank-wars\` (single-file index.html); LIVE at www.imaginex.games
- Profile: localStorage `tankwars_profile` {scrap, owned, tank, stars, done}; wins `tankwars_wins`; leaderboard id `tank-wars` label "Wins"
- Test harnesses (session scratchpad, recreate from SPEC/DEVLOG if lost): tanktest.js (54 checks, IIFE-injection technique per imaginex memory) + doortest.js (6 drivability)
- Screenshot hooks: `?demo=1` (AI match), `?screen=garage`, `?screen=campaign`
- ⚠️ BREACH (`public/games/firewall/`) registry changes are UNCOMMITTED on purpose (awaiting user playtest) — every games.ts/route.ts commit uses the strip→commit→restore dance. Check `git status` before committing
- ⚠️ If a push doesn't deploy in ~2 min: Vercel missed the webhook → empty commit retrigger
