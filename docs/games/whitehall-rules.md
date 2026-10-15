# Whitehall Mystery base engine

Primary reference: [official English rulebook](https://images-cdn.fantasyflightgames.com/filer_public/78/b4/78b4b240-ec1d-416d-8486-970fb5a941c9/whitehall_mystery_rulebook_small_copy.pdf), all 16 pages reviewed.
Factual map: [pinned source](https://github.com/jmegner/WhitehallMystery/tree/9dfd458b8558c8be9bf7563ab801c96068a00b98/src/data/whitehall), Unlicense reproduced in `packages/whitehall-core/LICENSE.map-data`. No board artwork was copied. The 1200-by-1200 coordinate plane contains 189 numbered locations, 174 crossings, 495 undirected edges, 116 alley groups and five water groups. Coordinates below 600 identify north/west halves.

## Rule traceability

| Rulebook | Implemented rule |
|---|---|
| pp. 5–6 | 2–4 players; one Jack, three investigator figures distributed evenly. Jack chooses four white goals, one per quadrant. Investigators deploy to distinct yellow starts before Jack reveals a starting goal. Remaining goals have no required order. |
| pp. 7–9 | Jack moves between circles, cannot wait or cross occupied crossings. Investigators move zero to two crossings, may pass one another, cannot share destinations. Yellow, blue, red act in order. |
| pp. 9–11 | Adjacent searches repeat after negatives and end at first positive. Arrest checks one adjacent current location. Searching and arresting are exclusive per figure. |
| pp. 11–12 | Arrival remains secret through all investigator actions. Surviving arrival reveals a goal and resets the 15-slot round, route and clues. Fourth reveal wins; arrest, exhaustion or immobilization loses. |
| pp. 12–15 | Two each of coach, alley and boat for the match. Coach records two distinct non-blue destinations and bypasses investigators. Alleys connect a house block; boats connect blue locations within one water block. Specials cannot enter unrevealed goals. |

Optional investigator abilities, Smoker, hidden special tiles, tile recovery and Whitechapel crossover options are excluded. Alley and boat record one destination/slot; only coach records two.

## Engine boundary

`src/index.js` exports the plan's common contract, plus `getAutomaticCommand` and `projectEvents`. All accepted commands clone state and increment `stateVersion`; rejected commands throw Korean errors without mutating input. There are no clocks, sockets, filesystem dependencies or timers in the engine. The host defaults to Jack. `config.jackPlayerId` may select another participant and is validated. Figure controllers are assigned round-robin among investigators.

`START_MATCH` enters `SET_DISCOVERIES`, then `DEPLOY`, `CHOOSE_START`, `JACK_MOVE`, `POLICE_MOVE`, `POLICE_ACTION`, and internal `RESOLVE_TURN`. Each investigator phase uses `pawnIndex` in yellow/blue/red order. New rounds begin automatically after disclosure. There is no between-round host decision and no `ADVANCE_ROUND` command. A trapped Jack produces internal `TRAPPED`.

Commands all carry authenticated `playerId`; service must overwrite any client-supplied identity. Only `allowedCommands` may enter from clients; automatic commands come exclusively from `getAutomaticCommand`.

| Command | Additional fields |
|---|---|
| `START_MATCH` | none, host only |
| `SET_DISCOVERIES` | `locations: number[4]` |
| `DEPLOY`, `POLICE_MOVE` | `pawnId: 'YELLOW'|'BLUE'|'RED', to: string` |
| `CHOOSE_START` | `to: number` |
| `JACK_MOVE` | `mode: 'WALK'|'COACH'|'ALLEY'|'BOAT', path: number[]` |
| `SEARCH`, `ARREST` | `pawnId, to: number` |
| `END_ACTION` | `pawnId` |

Example: `{type:'JACK_MOVE',playerId:'jack',mode:'COACH',path:[37,34]}` from circle 40. Map IDs for numbered circles are numbers; crossing IDs are strings. Example setup goals: `[33,46,159,147]`.

## Projections and animation

Public view exposes common match fields and `jackPlayerId`, `police:[{id,controllerId,position}]`, `pawnIndex`, `revealed`, `moveCount`, `specials`, `clues`, `searched`, `history`. It never contains Jack's position, unrevealed goals, route, or seed.

Private view is null for unknown recipients. Players receive `role` and `legal`. Jack additionally gets `position`, `discoveries`, `route`, `decisionSeed`; investigators get `controlledPawnIds`. The setup decision seed is Jack-only because it influences his secret goals.

`legal` contains only the acting player's choices: `discoveryQuadrants`, `startLocations`, `{pawnId,destinations}`, `{moves:[{mode,path}]}`, or `{pawnId,searchTargets,arrestTargets,canEnd}`. Setup white-circle choices are public static map data. After a negative search, arrest targets are empty. A successful search automatically advances the active figure.

Public spatial events include `POLICE_DEPLOYED`/`POLICE_MOVED` (`actorId,pawnId,from,to`), `CLUE_SEARCHED`/`ARREST_ATTEMPTED` (`actorId,pawnId,location,found,moveCount`), `DISCOVERY_REVEALED` (`actorId,location`) and `ROUND_STARTED`. `JACK_MOVED` exposes movement type and slot count, never coordinates. `JACK_ROUTE` contains private `from,path,mode` and must pass through `projectEvents(events,recipientId)` before transport. This lets Jack animate the real path while other players see only the public movement token. `GAME_ENDED` gives winning side, reason and participant IDs.

## AI and verification

AI input is exactly `{public,private}` returned by recipient projections. Investigator belief propagates possible locations using publicly known movement types and blocking figures, removes negative search/arrest positions, and scores public clues and other figures' coverage. Positive clues represent historical visits, so they guide search without falsely fixing Jack's current location. This is a conservative positional belief, not an exact posterior over every possible route. Jack scores distance to remaining goals, exposure to investigators, revisits and special-token cost using only his own information. Choices are deterministic.

Run `node tests/whitehall_core.test.js`. It writes scenario-level binary assertions and complete-match outcomes to `output/new-games/whitehall-core.json` and `.omo/evidence/new-games/whitehall-core.json`. Graph integrity, official examples, setup/identity, movement, search exclusivity, arrival/arrest ordering, 15-slot resolution, hidden-state invariance and bounded deterministic 2/4-player complete matches are covered. This core evidence does not claim browser, socket-service or animation verification.
