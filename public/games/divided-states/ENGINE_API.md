# Engine API (frozen 2026-06-11) — the contract the UI builds against

Phase 1 engine is complete and headless-tested (45/45 passing). **The UI layer (Phase 3,
Opus 4.8) consumes this API and must not change engine internals** — only read state and call
these functions. All modules are ES modules under `src/`.

## GameState shape (the single source of truth)
```
state = {
  seed, _rng,                      // seeded PRNG (do not call directly from UI)
  players: [{ id, name, color, isAI, difficulty, cards:[], alive }],
  order: [playerId...],            // turn order
  turnPointer,                     // index into order
  phase: 'setup'|'reinforce'|'attack'|'fortify'|'fortifyDone'|'gameover',
  owner:  { STATECODE: playerId|null },
  armies: { STATECODE: number },
  reinforcementsRemaining,
  conqueredThisTurn,
  deck:[], discard:[], setsTurnedIn,
  winner: playerId|null,
  turnNumber,
  log: [{ turn, msg }],            // human-readable event log (use for the battle log panel)
}
```

## Data (`src/data/`)
- `states.js` → `STATES` `[{code,name,region}]`, `STATE_CODES`, `STATE_BY_CODE`. *(SVG path +
  label anchor fields are to be ADDED here by the UI phase — that's the one place UI touches data.)*
- `adjacency.js` → `ADJACENCY {code:[neighbors]}`, `areAdjacent(a,b)`.
- `regions.js` → `REGIONS {key:{name,bonus,states[]}}`, `REGION_KEYS`.

## Game lifecycle (`src/engine/gamestate.js`)
- `createGame({ playerCount, seed, players }) → state`
- `autoDistribute(state)` — random claim + initial armies (the "random setup" path).
- `draftPick(state, playerId, code)` — one draft claim (for the interactive draft UI).
- Accessors: `currentPlayerId(s)`, `currentPlayer(s)`, `playerById(s,id)`, `ownerOf(s,code)`,
  `armiesOf(s,code)`, `statesOf(s,playerId)`, `alivePlayers(s)`, `logEvent(s,msg)`.

## Turn flow & rules (`src/engine/rules.js`)
- `beginTurn(s)` — starts current player's turn, sets `reinforcementsRemaining`, phase→reinforce.
- `reinforcementCount(s,playerId)`, `regionBonus(s,playerId)`.
- `placeArmies(s,playerId,code,n)` → then `endReinforcement(s)` (phase→attack).
- `legalAttacks(s,playerId) → [{from,to}]`; `canAttack(s,playerId,from,to)`.
- `executeAttackRound(s,from,to,moveIfCaptured?) → {attackerLosses,defenderLosses,attackerRolls,defenderRolls,captured,eliminated}`
- `executeAttackUntilDecided(s,from,to,moveIfCaptured?)` — blitz until captured or stalled.
- `reachableOwned(s,playerId,from) → [codes]`; `canFortify(...)`; `fortify(s,from,to,n)` (phase→fortifyDone).
- `turnInSet(s,playerId,indices?) → bonusArmies`; `drawCard(s,playerId)`.
- `checkWinner(s) → playerId|null`; `endTurn(s)` — grants end-of-turn card, advances, begins next turn.

## Combat math (`src/engine/combat.js`)
- `resolveRound(attArmies,defArmies,rng) → {attackerLosses,defenderLosses,attackerRolls,defenderRolls}`
- `winProbability(attArmies,defArmies) → 0..1` (memoized; use for AI + UI odds hints).
- `attackerDiceCount(n)`, `defenderDiceCount(n)`, `rollDice(n,rng)`.

## Cards (`src/engine/cards.js`)
- `buildDeck()`, `shuffle(arr,rng)`, `setBonus(setsTurnedIn)`, `isValidSet(threeCards)`, `findSet(hand)`.
- Symbols: `recruits | cavalry | artillery` + `wild`.

## Rules summary (for UI labels/help)
- 49 states; **Domination** = own all 49. Defender wins ties. Attacker ≤3 dice, defender ≤2.
- Reinforcements = `max(3, floor(owned/3)) + region bonuses (+ card set turn-ins)`.
- Fortify = one connected-path move. Capture earns one card/turn; eliminating a player takes their cards.
