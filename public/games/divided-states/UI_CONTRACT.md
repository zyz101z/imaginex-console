# UI Contract (frozen 2026-06-11) — what each UI module must export

The controller `src/main.js` (Fable-built) owns the `GameState` and the turn loop. Each UI
module is **self-contained**: it renders into a given DOM element and calls back via the
handlers it's given. Modules must NOT import each other or mutate the engine GameState —
they read it and call engine API functions only where noted. Engine API: see `ENGINE_API.md`.

ES modules under `src/ui/`. Each exports a single `create*` factory.

## Shared DOM (defined in index.html)
```
#menu-root     -> menus.js   (full-screen overlays)
#hud-top       -> hud.js     (top bar: player, phase, reinforcements, buttons)
#hud-side      -> hud.js     (side panel: region tracker, cards, phase actions)
#map-svg       -> map.js     (the SVG tile map; viewBox "0 0 1100 740")
#fx-layer      -> combatfx.js (absolutely-positioned overlay above the map)
#log-root      -> log.js     (battle log list)
```
Player colors come from `state.players[i].color`. Use CSS classes from `styles.css` where they
exist; modules may add their own styles via a `<style>` injected on init.

## Module factories

### map.js
`export function createMap({ svg, onStateClick }) -> { render, setHighlights, setSelectable }`
- Renders 49 state tiles from `GRID` (src/data/states-geo.js) into `svg`. Each tile shows the
  state code and its army count, filled with the owner's color (neutral grey if owner null).
- `render(state)` — repaint ownership + army counts from the GameState.
- `setSelectable(codes[])` — visually mark these states as clickable (others dimmed).
- `setHighlights(codes[], kind)` — outline these (kind: 'attack'|'fortify'|'selected').
- `onStateClick(code)` is called on tile click. Tile size ~ cell of 100x90 within viewBox.

### hud.js
`export function createHud({ topEl, sideEl, handlers }) -> { render }`
- handlers: `{ onEndReinforce, onEndAttack, onEndFortify, onEndTurn, onTurnInCards, onToggleMute }`
- `render(state)` shows: current player (name+color), phase, `reinforcementsRemaining`, card count,
  per-region ownership progress (use REGIONS from src/data/regions.js), and the phase-appropriate
  action button(s) wired to the handlers. Disable buttons that don't apply to the current phase.

### log.js
`export function createLog({ root }) -> { render }`
- `render(state)` renders `state.log` (array of `{turn, msg}`), newest at the bottom or top
  (your call), auto-scrolled. Keep it lightweight; it's called every UI refresh.

### menus.js
`export function createMenus({ root, onNewGame, onShowHelp }) -> { showStart, showWin, showHelp, hide }`
- `showStart()` — start screen: choose player count (2-6), how many are human (rest AI), AI
  difficulty (recruit/officer/general). Calls `onNewGame({ playerCount, humanCount, difficulty })`.
- `showWin(state)` — victory overlay naming `state.players[state.winner]`, with a "New Game" button
  (calls back to start).
- `showHelp()` / `hide()`.

### combatfx.js
`export function createCombatFx({ layer, svg }) -> { playAttack, playCapture, setMuted }`
- `async playAttack(fromCode, toCode, rounds)` — animate dice for each round in `rounds`
  (each `{ attackerRolls:[], defenderRolls:[] }`), positioned near the involved tiles. Resolve
  when done. Keep total animation < ~1.2s; honor a fast/instant path if `rounds` is large.
- `async playCapture(code)` — brief capture flash on that tile.
- Position using the same GRID cell math as map.js (cell 100x90 in the 1100x740 viewBox).

### audio.js
`export function createAudio() -> { play, setMuted }`
- `play(name)` for names: `dice | capture | eliminate | click | win | reinforce`. Pure Web Audio
  (oscillators/noise), no asset files. `setMuted(bool)`. Fail silently if audio is unavailable.

## Notes for implementers
- Read-only on GameState. The controller calls engine functions; you just render what you're given.
- If the `Write` tool is permission-denied on `/mnt/d/...`, write the file via a Bash heredoc
  (`cat > path <<'EOF' ... EOF`) — the path is writable from the shell.
- Keep each module in ONE file. No external dependencies, no build step. Modern browser ESM only.
