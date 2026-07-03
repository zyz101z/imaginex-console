# TANK WARS — DEVLOG

## ⏭️ NEXT SESSION — START HERE
1. **Multiplayer Phase 4 polish** (MULTIPLAYER_PLAN.md): in-match RTT indicator, reconnect
   grace on connection blips, learnings from real dad↔son matches.
2. **Balance feel-check** still open: Photon vs Ace ("Lights Out"), campaign curve, scrap
   rate. Also watch: Viper's thin barrels at battle size (regen ~6 credits if muddy).
3. **More themes if wanted** (snow fortress / lava field floated): recipe = 1 sprite +
   1 floor tile + LAYOUT_OF entry + label + pickArena weight. LESSON: merge wall runs
   into big shapes (city v1 mistake); organic blobs can overlap-stamp (jungle).
4. Loose end: Metered dashboard Secret Key still 401s at the mint endpoint — static creds
   (in /api/rtc) work fine; only matters if user rotates credentials in their dashboard.

## STATE SUMMARY (end of 2026-07-02)
LIVE at www.imaginex.games: 5-tank garage w/ Meshy art, scrap economy, 10-battle campaign,
7 rotating arenas (incl. Meshy-art JUNGLE + night CITY BLOCKS), rebuilt touch controls,
user music + autoplay-unlock, ONLINE MULTIPLAYER (room codes, TURN relay, host-authoritative
+ client-side prediction — real dad↔son match confirmed working, 12ms same-LAN ping).
Test suites: tanktest 55 + netsim 29 + doortest 6 (scratchpad; recreate via DEVLOG/SPEC docs).

## Session log — 2026-07-02
| Ver | Commit | What |
|---|---|---|
| THEME2 | (this) | CITY v2 after user feedback ('doesn't look very good'): building SLABS w/ alleys + darkened texture + parapets + glowing roof lights — cohesion over repetition. LESSON: don't stamp sprites along thin walls; merge runs into big shapes |
| THEME | `c642005` | **JUNGLE + CITY BLOCKS arenas** (Meshy tree/rooftop/floor art, ~51 credits): rendering skins over proven layouts (jungle=maze, city=dense via LAYOUT_OF); offscreen arena-layer prerender (perf win); deterministic placement (hashRand); themed debris; campaign b6=jungle b8=city; rotation now 7 arenas |
| MAPS | `20cd4d0` | Arena rotation: quick/online rotate the 5 generators per ROUND (weighted, shifting 10%) + arena name under countdown; campaign unchanged; arena rides 'round' msg online. T16 added |
| ART | `8b9400a` | **Meshy tank sprites:** 5 top-down realistic tanks (text-to-image, nano-banana-pro, ~30 credits) → magenta chroma-key → hull-center manifest (SPRITE_META) → in-game team-tinted sprites (amber/teal via offscreen source-atop, vector fallback) + garage thumbnails. Raw art archived in scratchpad meshy_output/ that session; game copies in img/. Regen recipe: scratchpad meshy_tanks.py pattern (flat magenta bg + hull-pointing-right prompts) |
| MUSIC | `c5eedde` | Guest had no music online — matches start from a network msg (no gesture) → autoplay blocked. Fix: muted play/pause unlock in ONLINE VS clicks + start-on-first-input fallback |
| MP-2/3 | `f1e8e44` | **ONLINE MULTIPLAYER PLAYABLE:** host-authoritative sim + 20/s snapshots (unordered 'fast' channel) + guest interpolation (~110ms, id-matched shells) + CLIENT-SIDE PREDICTION w/ input-replay reconciliation (own tank instant at any latency) + round/match/scrap/rematch/disconnect flow. Host picks own garage tank; guest's hello carries theirs; enemy = real human via ONLINE VS → START BATTLE (host). Verified: NETSIM two-VM harness @80ms — 29 checks, 0.0px prediction divergence. Offline untouched (59+6 green) |
| MP-1 | `5c9a3d5` | **Online multiplayer Phase 1:** ONLINE VS (BETA) menu → room codes → WebRTC P2P DataChannel (non-trickle ICE, Google STUN) + live ping readout & link verdict. New `/api/rtc` edge route (Upstash, 4-char codes, 5-min TTL) — live-tested end-to-end via curl (host/join/answer/poll + 404s). `?rtctest=1` loopback self-test (headless-verified: channel opens). Plan: MULTIPLAYER_PLAN.md |
| v2.1 | `c6de31b` | **Mobile controls rebuilt** (was: "really bad"). Root cause: steering angle was finger-relative-to-TANK → haywire when tank reached the finger; zero visual affordance. Now: floating virtual joystick (anchors under thumb on left 45%, absolute screen direction like keyboard, 10px deadzone, analog throttle 0.35–1.0 by deflection) + visible FIRE button (any right-side touch still fires) + overlay shows during countdown so thumbs pre-position. Tests 54→59 (T15: steer/throttle/deadzone/full-stop). `?touchdemo=1` screenshot hook |

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
