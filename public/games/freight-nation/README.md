# FREIGHT NATION

You dispatch, you don't drive: accept contracts, pick routes, schedule fuel and sleep stops,
react to a changing road network, and grow one rusty van into a fleet — collecting real
highway shields as you go.

**The map is the lower 48.** California is where you start, not where you stay: reputation
opens the country one region at a time (Southwest → Northwest → Rockies → Texas & the Gulf →
Midwest → Southeast → Northeast). Nothing in the sim is state-specific — nodes, edges and
corridors are data — so new cities are a `data.mjs` entry. Keep the name honest: read
`CFG.REGION` (the whole country) or `CFG.HOME_REGION_NAME` (where you start) in UI copy,
never a hard-coded state.

## Real map edition

- MapLibre GL JS renders an OpenFreeMap vector basemap using OpenStreetMap data.
- OSRM supplies real driving geometry and alternative routes.
- While planning, drag the blue route anywhere to add a coordinate waypoint and recalculate.
- The prototype requires an internet connection for map tiles and routing, but no API key.

Map-based US delivery logistics sim (from `D:\Route_Dispatcher\US_Delivery_Route_Simulator_Game_Design.docx`).
You dispatch, you don't drive: accept contracts, pick routes, schedule fuel/sleep stops, react to a
changing road network, and grow one rusty van into a fleet.

## Run
- Through the console: registered in `src/lib/games.ts` as **available** (id `freight-nation`).
- Direct: serve the repo (`npm run dev` or any http server — module scripts won't load from `file://`)
  and open `/games/freight-nation/index.html`.

## Test
```
node test/sim.test.mjs              # 4,751-check headless sim battery
node test/ui.smoke.mjs              # UI layer, live-map path (MapLibre + OSRM stubbed)
node test/ui.smoke.mjs --offline    # UI layer, offline-atlas fallback path
node test/ui.smoke.mjs --seed=7     # replay a specific game; default seed is fixed
```
Sim is fully separated from the DOM (GDD §18) — `src/sim.mjs` + `src/data.mjs` run in Node.
`test/dom-stub.mjs` is a small fake DOM/MapLibre/fetch so `src/ui.mjs` can boot headlessly;
the smoke test drives boot → every tab → planner → dispatch → 5 game-days → save round-trip.
`src/ui.mjs` exposes `window.__rd` for that harness and for console poking, and honours
`window.__RD_SEED` for reproducible games.

## Network dependencies (and what happens without them)
The live map needs three things off the network: the MapLibre library (unpkg, pinned to
5.6.0), OpenFreeMap vector tiles, and OSRM for real driving geometry. If **any** of them is
missing, slow or blocked, the game falls back to the **offline atlas** — the baked OSM
canvas map in `src/geometry.mjs` — and stays fully playable. Nothing about the simulation
depends on the network.

⚠️ `router.project-osrm.org` is OSRM's public **demo** server; its usage policy rules out
production traffic. Responses are cached in-memory and requests are sequenced and timed out,
but before this goes on a public shelf it needs either a self-hosted OSRM, a keyed provider,
or dropping back to the baked atlas geometry permanently.

## Real road geometry (two layers)
`tools/bake_geometry.mjs` bakes `src/geometry.mjs` from OpenStreetMap:
- **NETWORK** — every highway's COMPLETE real line end-to-end (the 405 runs Irvine→San Fernando,
  the 605 runs Seal Beach→Duarte). Drawn as the base map, like a road atlas. Includes context-only
  freeways (210/110/105) with no game edges.
- **GEOM** — per-game-corridor slices, leg-sequenced so each edge follows exactly its named
  highways (Dijkstra within one highway's ways per leg, legs joined at the real interchange).
  Used for truck animation, traffic/closure overlays, route highlights, click targets.
- **CA_SHAPE** — real Census boundary for the home state.
The baked atlas covers the **home region only**; the rest of the country draws real roads from
the live map and falls back to each edge's hand `via` waypoints offline. The battery enforces
that: any corridor over 120 mi without baked geometry must carry `via` points.

`tools/bake_states.mjs` bakes `src/states.mjs` — the lower-48 state outlines that form the
landmass of the offline canvas map (49 outlines, ~22KB, US Census, public domain). It's a
separate tool so you can refresh the map's shape without re-pulling 100+ road corridors.

Re-run the geometry bake after adding edges to `data.mjs` (add a CORRIDORS spec + NETWORK_REFS entry).
Attribution "© OpenStreetMap contributors" is in the game footer — keep it.

## Files
- `src/data.mjs` — **66 cities across the lower 48** in 8 unlockable regions, **106 highway
  edges** (I-5/10/15/20/25/35/40/70/75/80/90/95, US-101, the CA basin web…), 8 truck classes'
  worth of ladder, 5 upgrades, 7 cargo types, 14 weather zones (incl. snow/ice/wind), all
  balance tunables (`CFG`), weather/event defs. Cities carry `region`, `st`, `tz` and a state
  fuel price — diesel is genuinely cheaper in Texas than California.
- `src/sim.mjs` — deterministic seeded sim: time-expanded Dijkstra routing (fastest/cheapest/safest,
  rush-hour priced into ETAs), truck movement, fuel/tow, fatigue/sleep/theft, dynamic events
  (accidents, closures, wildfires, construction, trains, wildlife), contracts/economy/reputation,
  progression milestones, save serialization.
- `src/ui.mjs` — canvas map (pan/zoom, live traffic colors, event icons, rush pulses, weather),
  side panel (contracts/fleet/shop/log), route planner modal with stop editor, trip report modal,
  dev panel (backtick key).

## Adventure-edition additions (on top of the base game)
- **Real map** — MapLibre + OpenFreeMap basemap, OSRM driving geometry, draggable route.
- **"NOW ON" freeway badge** — the road under the wheels is shown on the truck itself (a
  coloured shield under the marker on the live map, a pill under the rig on the canvas) and
  as a strip on the fleet card, and it **flashes gold for `CFG.HWY_FLASH_MIN` game-minutes**
  when the road name changes, so switching from the 605 to the 5 is something you see. The
  bookkeeping (`onHighway`/`prevHighway`/`highwayChangedAt`) runs at the TOP of `stepTruck`,
  before any early return — it must stay in lockstep with `truckEdge()`, which reads the
  current edge directly. Putting it in the stamping block was a bug: that block is skipped
  while a truck sits refuelling or sleeping, so the badge and the "changed" flash disagreed.
- **⭐ Special Deliveries** — rare jackpot loads (dinosaur bones, a Ferris wheel, 20,000
  rubber ducks…) from `SPECIAL_LOADS`. One on the board at a time, announced when posted,
  gold card + banner, ~2.2× pay, +2 bonus rep, confetti on delivery, milestones at 1 and 5.
  The special is STORY ONLY — `cargoType` underneath still runs the physics (the shark tank
  is perishable, the trophy is fragile). Specials are picked from the loads whose base cargo
  the player's rep allows — filter first, then roll, or low-rep boards almost never see one.
  Gated behind the two tutorial trips. Tune with `CFG.SPECIAL_CHANCE`.
- **🎨 The garage** — rename any truck (free) and paint it (`CFG.PAINT_COST`, palette in
  `PAINT_COLORS`). The color rides the marker ring on the live map, a ring around the rig on
  the canvas, and a dot in the fleet card. `renameTruck`/`paintTruck`/`truckPaint` in sim.mjs.
- **Freeway Passport** — **51 collectable shields**, grouped by region. Completing the set
  pays the **Grand Tour bonus** (`CFG.PASSPORT_COMPLETE_BONUS`, $25k + 10 rep), fired once
  from `checkMilestones`; the panel shows it as a running goal with a shields-to-go count. A shield stamps the moment a truck enters
  a corridor carrying that highway, and the $25 explorer bonus (`CFG.PASSPORT_BONUS`) is paid
  right then, so it survives a trip that later fails. Stamping is driven purely by the sim's
  own edges, so it works identically online and offline. The passport list and the highways
  present on `EDGES` are asserted equal by the battery — the set is always completable.
  The list is **derived** from the road graph (`PASSPORT_ROADS` in `data.mjs`); never re-list
  it by hand anywhere, or the panel and the sim's stamping rules will drift.
- **Empty-mile economics** — repositioning to a pickup costs `CFG.DEADHEAD_OVERHEAD_PER_MI`
  per mile on top of fuel, charged at dispatch, and the contract board can sort by nearest
  pickup / best net / highest pay.

## Route cards
A route card is backed by exactly **one** sim option. The sim is what charges fuel, tolls and
time, so the sim's numbers are the ones quoted; a live OSRM route is attached only when one
exists at the same index, and supplies drawing geometry and real freeway names only. Do not
reintroduce a `realRoutes[i] || realRoutes[0]` fallback — that quotes the player a trip the
game never runs.

## Progression (the ladder)
1 rusty box van (4 pallets) → Swift Courier (rep 5) → Workhorse 16ft (rep 15) → Longhauler Semi
(rep 30) → Frostline Reefer (rep 40) → Guardian Rig (rep 55). Reputation also gates contract range
(local → regional at 12 → long-haul at 25) and cargo (fragile 10 / perishable 25 / electronics 35 /
medical 50). Buy multiple trucks + hire drivers to run contracts in parallel. Milestones fire at
2/3/6 trucks; "Freight Nation Award" at rep 80 + $150k.

**Territory** is the other ladder, and it's the one the map shows: ⭐0 California → ⭐12 Southwest
→ ⭐18 Northwest → ⭐25 Rockies → ⭐30 Texas & the Gulf → ⭐42 Midwest → ⭐55 Southeast →
⭐68 Northeast. Region gates are tuned against the contract-distance gates: a region must not
open before its shortest inbound corridor can legally carry freight (the Southwest's is
195 mi — REGIONAL — so it opens with REGIONAL contracts at 12, not before). A region stays unlocked once earned. Unlocking one clears half the contract
board so the new country actually shows up instead of waiting for old freight to expire.

There is a **second, emergent gate**: fuel range. A leg longer than `tank × mpg × RANGE_SAFETY`
can't be planned at all, so the empty west simply isn't drivable in a rusty van — the board
won't even offer it, and `assign()` refuses it with a reason. Buying a semi is what opens the
continent, not just reputation.

## Long-haul rules (what makes a 3,000-mile run different)
- **Time zones.** The clock is home (Pacific) time; every city carries a `tz`. Rush hour and
  night are evaluated in LOCAL time, so Chicago gridlocks at 3 PM on your wall clock.
- **Hours of service.** Quoted ETAs include the nights the run needs (`restAllowance`), scaled
  by how tired *your* driver already is — a half-spent driver redlines mid-run and the quote
  says so. Contract deadlines deliberately assume a fresh driver: the shipper's terms don't
  depend on whose driver you seat. If a driver redlines between towns they shut down where
  they are; a sleeper cab makes that safe, a van on the shoulder does not.
- **Lane premiums.** Grades, empty country, rough pavement and hard weather pay more
  (`lanePremium`). Zone severity is *derived* from the weather table, so it can't drift out of
  sync with it. Without this, every region outside California would be strictly worse business
  than home and each unlock would read as a punishment.
- **Deadline buffer grows with the haul** — a two-day run meets weather no quote could forecast.
- **Theft only takes what's on the truck.** Rough sleeps on the empty deadhead leg risk a
  parking ticket, never the contract — an empty truck cannot have its freight "stolen."
- **Range is enforced everywhere a path is chosen**: `assign()`, `reroute()` (an out-of-range
  detour is refused — stay blocked and wait out the closure), and `contractQuote()` in the UI
  (no quote → the card locks with "no truck has the range for this run yet" instead of
  offering a PLAN ROUTE button that dead-ends).

## Map bounds
Both maps are fenced to the country: the live map via `maxBounds` + `minZoom`, the offline
canvas via `clampCam()`, which keeps the screen-centre point inside the map rect. There's no
freight in the Atlantic, and being able to drag out there is just distraction.

## The side panel re-renders on a timer
`renderSide()` runs about once a second, and replacing `innerHTML` resets the scroll box.
It therefore **carries `.tabbody` scrollTop across the rebuild** (keyed on `data-tab`, so
switching tabs still starts at the top). It also pauses entirely while the player is using
the panel — `:hover`, `sideLockUntil` (pointer/touch) or `sideScrolling()` (momentum). The
passport used to be excluded from that guard, which is exactly why it snapped back to the top
when scrolled on a phone. Don't reintroduce a per-tab exclusion.

## Controls
Drag map to pan, wheel to zoom. Click roads for conditions (while planning: toggles AVOID).
Click trucks to select. Space = pause. ` = dev panel. Autosaves to localStorage every 30s.

## Deliberate MVP cuts (GDD full-vision items)
Multi-stop/return-load contracts, driver skill specialties, company yards beyond Lakewood,
seasons, controller support, Alaska/Hawaii. A nationwide OSM corridor bake (the offline atlas
is home-region-only today). Data model supports extending all of these.
