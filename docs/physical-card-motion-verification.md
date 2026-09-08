# Physical card presentation — 2026-09-08

The active Love Letter UI now presents a command as a single ordered sequence.
The shared sequence definition is `packages/protocol/src/physicalSequence.ts`.
The server resolves the card effect first, keeps `ACTION_RESOLVING`, and executes
the internal `FINALIZE_ACTION` transition only after presentation completion.

## Implemented flow

- Hand → actor's play place → effect → public discard landing place.
- Priest: target hand → actor's review place → private face → manual return request
  → conceal → return → played-card cleanup. A connected human review has no expiry.
- Baron: both remaining cards move to the two participants' review places, compare
  privately, return, then the losing hand is revealed and discarded.
- Prince: reveal and discard target hand, then draw its replacement.
- King: two cards cross between the actual hand positions, then private hands settle.
- Guard and Princess: eliminated hand is revealed and discarded. Handmaid protection
  is applied during the sequence. Countess uses the play/cleanup flow.
- New-round dealing and round-end public hand reveals use the same visible-card layer.
- No targeting lines; target seats are distinguished without changing their hit-area size.

## Verification

- `npm test`: 14 suites passed (79.66 seconds), including simulations, real sockets,
  reconnect/privacy suites and the new physical-presentation regression tests.
- `npm run typecheck`: passed after final state/geometry corrections.
- `npm run build`: passed; existing large-bundle warning remains.
- Real Socket.IO service + actual `LoveLetterGame` components exercised through
  the local fixture screen, not a separately implemented animation demo.
- Browser checks: Priest actor/target/observer views, manual hold longer than 20 seconds,
  return → next turn/draw, fresh connection during review, King swap, Prince discard/draw,
  Baron elimination and round-result screen. Inspected 2/4/6-player layouts at desktop,
  390×844 and 360×640. Fresh final browser session had no console errors.
- Runtime verification exposed and corrected unstable hand-slot refs, measurement
  before seat refs existed, and repeated state adaptation causing a render loop.

## Reproduction environment

Run `node tests/motion_lab_server.js` and `npm run dev`, then open
`http://localhost:3000/motion-lab.html`.
The fixture server listens only on 127.0.0.1:3002 and is never imported by the
production server. The fixture entry is not included in the production build.
Use `?player=p0`, `?player=p1`, `?player=p2` for actor, target, observer.
Select a card and player count, press “시나리오 시작”, then use the real card controls.

## Limits

Browser verification used deterministic local sockets, not a deployed WAN session.
Individual card edge cases are covered by rule/sequence tests; every combination
of latency, viewport, accessibility setting and card outcome was not visually replayed.
