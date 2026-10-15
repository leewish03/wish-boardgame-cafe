# Whitechapel revised base game

The pure engine implements the revised base game for 2–6 participants. One player is Jack; the others share five colored officers. `config.jackPlayerId` selects a participant (host by default). Officers are assigned round-robin, and each player's officers may be moved/acted with in either order. The seeded shuffled investigation-head deck determines the starting detective each night.

## Primary source and traceability

Official [Fantasy Flight revised rulebook](https://images-cdn.fantasyflightgames.com/filer_public/55/ff/55ff98ec-c39b-4607-9055-fadb150605dd/lfh_rules_letter_en_low_res.pdf), read through all 24 pages. Implementation references are printed page numbers:

| Pages | Rule | Module / verification |
|---|---|---|
| 6–7 | 195 numbered places, five officers, non-red permanent hideout | map.js; index.js; topology and hideout tests |
| 9 | Night-specific women 8/5, 7/4, 6/3, 4/1 and coach/alley 3/2, 2/2, 2/1, 1/1 | state.js; night resource tests |
| 10–11 | Seven secret patrols; five real/two decoys; later preserve five occupied crossings plus two unoccupied yellow starts; faces may change | setup.js; patrol placement tests |
| 12–14 | Wait I→V; every wretched moves, cannot pass/finish next to patrol or finish on another woman/crime; reveal one patrol; murder and police deployment | setup.js; waiting and movement tests |
| 15–18 | Jack hidden normal move; police 0–2 crossings; all movement before actions; search until first positive; one arrest guess; time limit | hunt.js; hunt tests |
| 18–20 | Normal arrival escape, 15th numbered track space deadline, coach two distinct recorded destinations and two slots bypassing police, alley across one enclosed block, no special-move escape | hunt.js/map.js; specials and deadline tests |
| 21 | Night three two victims, secret order, one consumed move, police act first | setup.js; double-event projection test |
| 22 | Four safe returns/five crimes win; arrest, blocked or time expires lose | state.js; terminal tests and complete AI matches |

The printed Roman track runs V, IV, III, II, I, 1…15. Engine `wait` is 1…5 and `track` is `1 - wait` at a single murder, so waiting adds escape slots. Night three advances that track once for the second crime. `ADVANCE_ROUND` is a host readiness gate between successful nights. On a normal arrival at the hideout, Jack chooses whether to declare escape as part of his private movement confirmation: `JACK_MOVE{escape:true}` declares, while `escape:false` continues the hunt. Omitting the flag preserves the default declaration. An explicit declaration is rejected for special moves or other destinations. Continuing uses the ordinary police phase and identical public movement events, so no extra phase, acknowledgement, or turn reveals a hidden arrival. Declining escape on the final track space loses to the deadline.

## Factual map provenance

Factual vertex coordinates and street incidences were researched from [davidapple/Letters-From-Whitechapel js/map.js at 5d00b13b7df77aec924634d637bbc1ff1836c388](https://github.com/davidapple/Letters-From-Whitechapel/blob/5d00b13b7df77aec924634d637bbc1ff1836c388/js/map.js). That repository has no license. No implementation functions, artwork, CSS, names, or board image are reused. `topology.js` is an original serialization of factual board geometry. It has 429 vertices (195 numbered and 234 crossings), 592 undirected streets, and 164 bounded faces. Faces were reconstructed from geometric edge order; the exterior face is excluded. Alleged preexisting lantern/alley lists were discarded because they are incomplete.

Crosschecks against the primary rulebook examples: page 13 lists 65's destinations 51,63,66,67,82,83,84; page 15 allows 127→103; page 19 allows coach 103→69→56; page 20's southern block at 56 contains 56,57,69,70,71,72,73. Tests assert these examples along with every edge's symmetry, connectivity, start colors, and all numbered labels. This is a graph audit plus printed-example crosscheck, not a claim that every edge was independently traced from the board artwork.

## Commands and projection boundary

Every user command includes `playerId`. Setup commands: `CHOOSE_HIDEOUT{to}`, `PLACE_WOMEN{positions,real}`, `PLACE_PATROLS{patrols:[{position,officerId}]}`, `WAIT`, `MOVE_WRETCHED{from,to}`, `REVEAL_PATROL{position}`, `MURDER{victims}`. Patrol `officerId` is blue/yellow/brown/red/green or null for each decoy. The two murder victims are ordered privately. Hunting commands: `JACK_MOVE{mode,to,via?}`, `POLICE_MOVE{officerId,to}`, `SEARCH{officerId,to}`, `ARREST{officerId,to}`, `PASS{officerId}`. `START_MATCH` and `ADVANCE_ROUND` require host ownership. `_CHECK_BLOCKED` is server-internal and omitted from `allowedCommands`.

Numbered locations use printed numbers; police positions use crossing node IDs. Public events reveal no Jack coordinates, hideout, woman faces or hidden patrol colors. Private views include actor-authorized state and legal command choices. Only the investigation head receives unrevealed patrol identities. The police belief set is derived exclusively from public crimes, move types, blocking officers and search/arrest answers. Bot policy accepts that projected observation, never engine state. Jack policy uses its own hideout and trail, police policy uses public reachability and clues. Both are deterministic; they are heuristic opponents, not optimal solvers.

Optional letters, false clues, rushing, area arrests, restricted-hideout variants and I Know Your Address are excluded, as requested for base rules.
