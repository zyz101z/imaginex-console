# FREIGHT NATION

You dispatch, you don't drive: accept contracts, pick routes, schedule fuel and sleep stops,
react to a changing road network, and grow one rusty van into a fleet — collecting real
highway shields as you go.

California is the launch region, not the ceiling. Nothing in the sim is state-specific: nodes,
edges and corridors are data, so new states are a `data.mjs` entry plus a geometry bake. Keep
the name honest — when adding regions, don't hard-code "California" into UI copy.

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
node test/sim.test.mjs              # 568-check headless sim battery
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
- **CA_SHAPE** — real Census state boundary.
Re-run the bake after adding edges to `data.mjs` (add a CORRIDORS spec + NETWORK_REFS entry).
Attribution "© OpenStreetMap contributors" is in the game footer — keep it.

## Files
- `src/data.mjs` — 19 CA cities, 30 highway edges (I-5, I-10, I-605, I-710, I-880, CA-22, CA-91, CA-57, CA-99, US-101…),
  6 truck classes, 4 upgrades, 7 cargo types, all balance tunables (`CFG`), weather/event defs.
- `src/sim.mjs` — deterministic seeded sim: time-expanded Dijkstra routing (fastest/cheapest/safest,
  rush-hour priced into ETAs), truck movement, fuel/tow, fatigue/sleep/theft, dynamic events
  (accidents, closures, wildfires, construction, trains, wildlife), contracts/economy/reputation,
  progression milestones, save serialization.
- `src/ui.mjs` — canvas map (pan/zoom, live traffic colors, event icons, rush pulses, weather),
  side panel (contracts/fleet/shop/log), route planner modal with stop editor, trip report modal,
  dev panel (backtick key).

## Adventure-edition additions (on top of the base game)
- **Real map** — MapLibre + OpenFreeMap basemap, OSRM driving geometry, draggable route.
- **Freeway Passport** — 18 collectable shields. A shield stamps the moment a truck enters
  a corridor carrying that highway, and the $25 explorer bonus (`CFG.PASSPORT_BONUS`) is paid
  right then, so it survives a trip that later fails. Stamping is driven purely by the sim's
  own edges, so it works identically online and offline. The passport list and the highways
  present on `EDGES` are asserted equal by the battery — the set is always completable.
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
2/3/6 trucks; "Golden Bear Award" at rep 80 + $150k.

## Controls
Drag map to pan, wheel to zoom. Click roads for conditions (while planning: toggles AVOID).
Click trucks to select. Space = pause. ` = dev panel. Autosaves to localStorage every 30s.

## Deliberate MVP cuts (GDD full-vision items)
Multi-stop/return-load contracts, driver skill specialties, company yards beyond Lakewood,
other 49 states, seasons, controller support. Data model supports extending all of these.
