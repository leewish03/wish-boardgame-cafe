# 6 nimmt! base rules and engine contract

Source: [AMIGO English rules, version 2.10](https://blog.amigo-spiele.de/content/ap/rule/04910-GB-AmigoRule.pdf), both pages read 2026-10-15. Only the base game is implemented; the optional pro draft and alternative endpoints are excluded.

| Official rule | Implementation | Verification scenario |
| --- | --- | --- |
| Page 1 setup: 104 cards, 2–10 players, ten each, four starters | `deal` | setup 2, 4, 10 players |
| Page 1 play: simultaneous secret commitment, ascending reveal | `SELECT_CARD` | secret commitment remains private |
| Page 1 rules 1–2: increasing, closest lower endpoint | `nearestRow` | bullhead values and nearest lower row |
| Page 1 rule 3: sixth card takes five, then starts row | `place` | sixth card takes five |
| Page 2 rule 4: too-low card chooses any row to collect | `STEP_RESOLVE`, `CHOOSE_ROW` | low card interrupts |
| Page 2 bullheads: default 1, ending 5 = 2, tens = 3, doubles = 5, 55 = 7 | `bullheads` | bullhead values |
| Page 2 endpoint: ten turns per round, 66 threshold checked at round end, tied minimum shares victory | `finishPlacement` | round ten finishes before threshold end |

## Integration

`selectionVersion` is the version at entry to the current simultaneous selection phase. `SELECT_CARD` accepts integer `expectedVersion` between `selectionVersion` and current `stateVersion`, allowing concurrent commits from one snapshot. Old-turn and future versions are rejected; other commands require exact versions. Service version validation must preserve this exception.

`index.js` exposes the common plan contract plus `getAutomaticCommand`, `bullheads`, `rowPoints`, `nearestRow`. Commands use `playerId` (`actorId` also accepted) and optional `expectedVersion`. All accepted commands clone state and advance `stateVersion`; invalid commands throw Korean errors. `allowedCommands` contains only `START_MATCH`, `ADVANCE_ROUND`, `SELECT_CARD`, `CHOOSE_ROW`. The service must authenticate actors and never accept `STEP_RESOLVE` from a client.

- `{type:'START_MATCH', playerId}`: host, lobby only.
- `{type:'ADVANCE_ROUND', playerId}`: host, round end only.
- `{type:'SELECT_CARD', playerId, card}`: integer number from own hand, once per turn.
- `{type:'CHOOSE_ROW', playerId, rowIndex}`: pending actor, zero-based index 0–3.
- `getAutomaticCommand(state)`: `{type:'STEP_RESOLVE',expectedVersion}` or null. Call once after the prior presentation settles. A low card changes phase without placement, requiring a player choice.

Public view contains common metadata, `players` with `score`, `roundScore`, `handCount`, `selected`; `rows:number[][]`, `queue:{playerId,card}[]`, `pendingRowPlayerId`, `seenCards`. Queue stays empty until everyone commits. `seenCards` records only cards already public this round. Private view is `{hand:number[],selectedCard:number|null,legalActions:command[]}`. Unknown viewers get an empty private view. Neither public view nor AI observation includes unused cards, opponent hands/commitments or shuffle seed.

Phases: `LOBBY → SELECTING → RESOLVING ↔ CHOOSING_ROW → SELECTING`, then `ROUND_END` or `GAME_OVER`. Cumulative scores update when rows are taken, but 66 is checked only after the tenth turn is fully resolved.

## Presentation events

Events with a top-level `playerId` also expose the same `actorId` for motion adapters.

`ROUND_STARTED {roundNumber,rows}` deals card backs and starter faces. `CARD_COMMITTED {playerId}` moves a back to the commitment area; it contains no card value. `CARDS_REVEALED {cards:[{playerId,card}]}` flips the full ascending queue. `ROW_CHOICE_REQUIRED {playerId,card}` highlights four row targets. `CARD_PLACED {playerId,card,rowIndex,position}` moves one card to its row. `ROW_TAKEN {playerId,card,rowIndex,cards,points}` moves the old row to the actor's bull pile and the played card into the cleared row. `TURN_STARTED`, `ROUND_ENDED`, `GAME_ENDED` communicate settled results. All returned events are public; no private event projection is needed.

## AI and evidence

The AI accepts only `getBotObservation`, samples 80 possible opponent plays from cards excluding its hand and all publicly seen cards, and compares expected immediate penalty for each legal candidate in the same sampled worlds. Low-card row choice combines penalty with remaining-hand fit. Sampling is deterministic from round, turn and own hand; the deck seed and actual opponent choices are unavailable. This is a bounded one-turn Monte Carlo policy, not optimal full-game search.

Run `node tests/six_nimmt_core.test.js`. It writes scenario verdicts and full seeded 2/4/10-player match summaries to `output/new-games/six-nimmt-core.json` and `.omo/evidence/new-games/six-nimmt-core.json`. Test manifest, service integration and browser verification belong to the integration task.
