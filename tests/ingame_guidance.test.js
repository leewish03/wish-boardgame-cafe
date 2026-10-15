import assert from 'node:assert/strict';
import { loadTs, core } from './load_core.js';
import { dalmutiActionNarrative } from '../src/games/dalmuti/actionNarrative.js';
import { dalmutiPresentationMs, dalmutiPresentationDeadline } from '../packages/protocol/src/dalmutiPresentation.js';

const { deriveActionNarrative } = loadTs('src/games/love-letter/presentation/deriveActionNarrative.ts');
const { buildPhysicalSequence } = loadTs('packages/protocol/src/physicalSequence.ts');
const players = [{ id: 'a', nickname: '민수' }, { id: 'b', nickname: '지수' }];
const card = (value) => ({ ...core.CARD_DEFINITIONS[value], id: `card-${value}`, value });
const events = [
  { type: 'CARD_PLAYED', actorId: 'a', card: card(5), targetId: 'b' },
  { type: 'PLAYER_TARGETED', targetId: 'b' },
  { type: 'PRINCE_DISCARDED', targetId: 'b', discardedCard: card(6) },
  { type: 'CARD_DRAWN', playerId: 'b', card: card(8) },
];
const summary = { actorId: 'a', targetId: 'b', card: card(5), resultType: 'PRINCE_DISCARD', revealedCard: card(6) };
const envelopes = events.map(event => ({ actionId: 'action', presentation: summary, event }));
const steps = buildPhysicalSequence(envelopes);
const narrative = (kind) => deriveActionNarrative({ actionId: 'action', presentation: summary, presentationEvents: envelopes, presentationIndex: steps.findIndex(step => step.kind === kind) }, players, 'a');
assert.match(narrative('TARGET').title, /지수/);
assert.match(narrative('RESULT_DWELL').result, /받습니다/);
assert.doesNotMatch(narrative('RESULT_DWELL').result, /뽑았습니다/, 'Do not claim a draw has completed before its motion');
assert.match(narrative('REVEAL').detail, /국왕/);
assert.match(narrative('DISCARD_HAND').title, /버린 패/);
assert.match(narrative('DRAW').title, /지수.*받는 중/);
assert.doesNotMatch(JSON.stringify(narrative('DRAW')), /공주|card-8/, 'The new hidden card must never be narrated');

const played = dalmutiActionNarrative({ type: 'SET_PLAYED', actorId: 'b', rank: 4, count: 2, topRank: 7, handCount: 3 }, players, 'a');
assert.match(played.title, /지수.*4.*2장/);
assert.match(played.detail, /7보다 낮은 4/);
const clear = dalmutiActionNarrative({ type: 'TRICK_CLEARED', actorId: 'a' }, players, 'a');
assert.match(clear.title, /모두 패스/);
assert.match(clear.detail, /나부터 새로 시작/);
assert.doesNotMatch(dalmutiActionNarrative({ type: 'PASSED', actorId: 'b' }, players, 'a').detail, /낼 수 없/, 'A voluntary pass must not claim that the player had no legal cards');
assert.match(dalmutiActionNarrative({ type: 'GREAT_REVOLUTION', actorId: 'a' }, players, 'a').detail, /신분.*세금/);
const batch = [{ type: 'PASSED' }, { type: 'TRICK_CLEARED' }];
assert.ok(dalmutiPresentationDeadline(batch) > batch.reduce((total, event) => total + dalmutiPresentationMs(event.type), 0), 'Recovery cannot overtake the readable animation sequence');
assert.equal(dalmutiActionNarrative(null, players, 'a'), null);
console.log('In-game action, rule, privacy and presentation deadline guidance passed.');
