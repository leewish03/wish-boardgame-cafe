const BOT_PROFILES = [
  { nickname: '알렉산더', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alexander&backgroundColor=3b0b17,1e293b,047857', personality: 'AGGRESSIVE' },
  { nickname: '마리안느', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Marianne&backgroundColor=047857,1e293b,090d16', personality: 'DEFENSIVE' },
  { nickname: '줄리앙', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Julien&backgroundColor=1e293b,047857,3b0b17', personality: 'CALCULATING' },
  { nickname: '빅토리아', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Victoria&backgroundColor=c5a059,3b0b17,1e293b', personality: 'STRATEGIC' },
  { nickname: '펠릭스', avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=090d16,c5a059,047857', personality: 'INFORMATIVE' },
];
const CARD_NAMES = { 1: '경비병', 2: '사제', 3: '남작', 4: '하녀', 5: '왕자', 6: '국왕', 7: '백작부인', 8: '공주' };
const BASE_COUNTS = { 1: 5, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1 };
const PERSONALITY = {
  AGGRESSIVE: { eliminate: 0.08, survive: -0.03, info: 0, conceal: 0 },
  DEFENSIVE: { eliminate: -0.02, survive: 0.08, info: 0, conceal: 0.03 },
  CALCULATING: { eliminate: 0.02, survive: 0.03, info: 0.06, conceal: 0 },
  STRATEGIC: { eliminate: 0.02, survive: 0.06, info: 0.01, conceal: 0.03 },
  INFORMATIVE: { eliminate: 0, survive: 0.02, info: 0.08, conceal: 0 },
};

function deckCounts(playerCount) {
  const counts = { ...BASE_COUNTS };
  if (playerCount >= 5) { counts[1] += 2; counts[2] += 1; counts[3] += 1; counts[4] += 1; counts[5] += 1; }
  return counts;
}
function normalize(weights) {
  const total = Object.values(weights).reduce((sum, value) => sum + Math.max(0, value || 0), 0);
  return total ? Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Math.max(0, value || 0) / total])) : Object.fromEntries(Object.keys(weights).map((key) => [key, 0]));
}
function hashSeed(value) { let hash = 2166136261; for (const char of String(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function seededRandom(seed) { let state = hashSeed(seed) || 1; return () => { state += 0x6D2B79F5; let value = state; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; }; }
function findPlayer(state, playerId) { return (state.players || []).find((player) => player.id === playerId); }
function ownPrivate(state, playerId) { return state.secrets?.[playerId] || { id: playerId, hand: [] }; }
function publicPlayer(player) {
  return { id: player.id, nickname: player.nickname, avatar: player.avatar, avatarUrl: player.avatarUrl, tokens: player.tokens, isReady: player.isReady, isHost: player.isHost, isBot: player.isBot, isEliminated: player.isEliminated, isProtected: player.isProtected, cardCount: player.cardCount, discardPile: (player.discardPile || []).map((card) => ({ ...card })), personality: player.personality, eliminationReason: player.eliminationReason, eliminatedBy: player.eliminatedBy };
}
function remainingCounts(publicState, privateState) {
  const counts = deckCounts((publicState.players || []).length);
  for (const player of publicState.players || []) for (const card of player.discardPile || []) counts[card.value] = Math.max(0, counts[card.value] - 1);
  for (const card of privateState?.hand || []) counts[card.value] = Math.max(0, counts[card.value] - 1);
  return counts;
}
function freshBelief(publicState, privateState, revision = 0) { return { handRevision: revision, probabilities: normalize(remainingCounts(publicState, privateState)), exactValue: null, excludedValues: [] }; }

export function createBotPlayer(existingPlayers = []) {
  const usedNames = new Set(existingPlayers.map((player) => player.nickname));
  const profile = BOT_PROFILES.find((candidate) => !usedNames.has(candidate.nickname)) || BOT_PROFILES[existingPlayers.length % BOT_PROFILES.length];
  const id = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return { id, socketId: null, sessionToken: `bot_token_${id}`, isBot: true, isReady: true, nickname: profile.nickname, avatarUrl: profile.avatarUrl, avatar: '🤖', personality: profile.personality, discardPile: [], tokens: 0, isEliminated: false, isProtected: false };
}

export function buildBotObservation(gameState, botId, projectedEvents = []) {
  const publicState = { matchState: gameState.matchState, playPhase: gameState.playPhase, roundNumber: gameState.roundNumber, config: { ...gameState.config }, players: (gameState.players || []).map(publicPlayer), deckCount: gameState.deck?.length || 0, setAsideCardCount: gameState.setAsideCard ? 1 : 0, currentTurnPlayerId: gameState.currentTurnPlayerId, turnStartedAt: gameState.turnStartedAt, turnExpiresAt: gameState.turnExpiresAt, stateVersion: gameState.stateVersion, matchWinnerId: gameState.matchWinnerId, roundWinnerIds: [...(gameState.roundWinnerIds || [])], outcome: gameState.outcome || null };
  return { publicState, privateState: { id: botId, hand: (ownPrivate(gameState, botId).hand || []).map((card) => ({ ...card })) }, projectedEvents };
}
export function createBotKnowledge(botId, gameState) {
  const observation = buildBotObservation(gameState, botId);
  const beliefsByPlayerId = {};
  for (const player of observation.publicState.players) if (player.id !== botId && !player.isEliminated) beliefsByPlayerId[player.id] = freshBelief(observation.publicState, observation.privateState);
  return { roundNumber: observation.publicState.roundNumber, seenEventKeys: [], beliefsByPlayerId, exposedToByPlayerId: {}, tendenciesByPlayerId: {} };
}
function resetRoundKnowledge(knowledge, observation) {
  knowledge.roundNumber = observation.publicState.roundNumber; knowledge.seenEventKeys = []; knowledge.beliefsByPlayerId = {}; knowledge.exposedToByPlayerId = {};
  for (const player of observation.publicState.players) if (player.id !== observation.privateState.id && !player.isEliminated) knowledge.beliefsByPlayerId[player.id] = freshBelief(observation.publicState, observation.privateState);
}
function beliefFor(knowledge, observation, playerId) { return knowledge.beliefsByPlayerId[playerId] ||= freshBelief(observation.publicState, observation.privateState); }
function invalidateBelief(knowledge, observation, playerId) { const prior = beliefFor(knowledge, observation, playerId); return knowledge.beliefsByPlayerId[playerId] = freshBelief(observation.publicState, observation.privateState, prior.handRevision + 1); }
function setExact(knowledge, observation, playerId, value) { const belief = beliefFor(knowledge, observation, playerId); belief.exactValue = value; belief.excludedValues = []; belief.probabilities = normalize(Object.fromEntries(Object.keys(BASE_COUNTS).map((key) => [key, Number(key) === value ? 1 : 0]))); }
function applyPlayInference(knowledge, observation, actorId, cardValue, targetId) {
  const belief = beliefFor(knowledge, observation, actorId); if (belief.exactValue) return;
  const weights = { ...belief.probabilities };
  if (cardValue === 4) for (let value = 5; value <= 8; value++) weights[value] *= 1.45;
  if (cardValue === 5 && targetId === actorId) for (let value = 1; value <= 3; value++) weights[value] *= 1.35;
  if (cardValue === 6) for (let value = 1; value <= 3; value++) weights[value] *= 1.25;
  belief.probabilities = normalize(weights);
}
function recordTendency(knowledge, event) {
  if (!event.actorId || event.type !== 'CARD_PLAYED') return;
  const tendency = knowledge.tendenciesByPlayerId[event.actorId] || { observations: 0, aggression: 0, protection: 0, informationSeeking: 0, selfPrince: 0, countessPlayRate: 0 };
  tendency.observations += 1; if ([1, 3, 5, 6].includes(event.card?.value)) tendency.aggression += 1; if (event.card?.value === 4) tendency.protection += 1; if (event.card?.value === 2) tendency.informationSeeking += 1; if (event.card?.value === 7) tendency.countessPlayRate += 1;
  knowledge.tendenciesByPlayerId[event.actorId] = tendency;
}

// Decision code receives only buildBotObservation output. This service-side observer
// records a card fact only for a bot that participated in the private interaction.
export function observeBotEvents(room, beforeState, nextState, events = []) {
  room.botKnowledgeByPlayerId ||= {};
  const playedByAction = new Map(events.filter((event) => event.type === 'CARD_PLAYED').map((event) => [event.actionId, event]));
  for (const bot of (nextState.players || []).filter((player) => player.isBot && !player.isEliminated)) {
    const observation = buildBotObservation(nextState, bot.id);
    const knowledge = room.botKnowledgeByPlayerId[bot.id] ||= createBotKnowledge(bot.id, nextState);
    if (knowledge.roundNumber !== nextState.roundNumber) resetRoundKnowledge(knowledge, observation);
    for (const [sequence, event] of events.entries()) {
      const key = `${nextState.roundNumber}:${event.actionId || nextState.stateVersion}:${event.type}:${event.sequence ?? sequence}:${event.actorId || event.playerId || ''}:${event.targetId || ''}`;
      if (knowledge.seenEventKeys.includes(key)) continue;
      knowledge.seenEventKeys.push(key); if (knowledge.seenEventKeys.length > 128) knowledge.seenEventKeys.shift();
      if (event.type === 'CARD_DRAWN') { invalidateBelief(knowledge, observation, event.playerId); if (event.playerId === bot.id) knowledge.exposedToByPlayerId = {}; }
      if (event.type === 'CARD_PLAYED') { recordTendency(knowledge, event); if (![1, 2, 3, 5, 6].includes(event.card?.value)) applyPlayInference(knowledge, observation, event.actorId, event.card?.value); }
      if (event.type === 'PLAYER_TARGETED') {
        const played = playedByAction.get(event.actionId);
        if (played) applyPlayInference(knowledge, observation, event.actorId, played.card?.value, event.targetId);
        if (played?.card?.value === 5 && event.actorId === event.targetId) {
          const tendency = knowledge.tendenciesByPlayerId[event.actorId] || { observations: 0, aggression: 0, protection: 0, informationSeeking: 0, selfPrince: 0, countessPlayRate: 0 };
          tendency.selfPrince += 1;
          knowledge.tendenciesByPlayerId[event.actorId] = tendency;
        }
      }
      if (event.type === 'GUARD_FAILED') { const belief = beliefFor(knowledge, observation, event.targetId); if (!belief.exactValue) { belief.excludedValues = [...new Set([...belief.excludedValues, event.guessValue])]; belief.probabilities[event.guessValue] = 0; belief.probabilities = normalize(belief.probabilities); } }
      if (event.type === 'PRIEST_USED') { if (event.actorId === bot.id && event.revealedCard) setExact(knowledge, observation, event.targetId, event.revealedCard.value); if (event.targetId === bot.id) { const ownValue = ownPrivate(beforeState, bot.id).hand?.[0]?.value; if (ownValue) knowledge.exposedToByPlayerId[event.actorId] = { botHandRevision: 0, knownValue: ownValue }; } }
      if (event.type === 'PRINCE_DISCARDED') invalidateBelief(knowledge, observation, event.targetId);
      if (event.type === 'HANDS_SWAPPED') { invalidateBelief(knowledge, observation, event.actorId); invalidateBelief(knowledge, observation, event.targetId); if (event.actorId === bot.id) { const given = ownPrivate(beforeState, bot.id).hand?.find((card) => card.value !== 6)?.value; if (given) setExact(knowledge, observation, event.targetId, given); } if (event.targetId === bot.id) { const received = ownPrivate(nextState, bot.id).hand?.[0]?.value; if (received) setExact(knowledge, observation, event.actorId, received); } }
      if (event.type === 'BARON_COMPARED') { if (event.actorId === bot.id) { const value = ownPrivate(beforeState, event.targetId).hand?.[0]?.value; if (value) setExact(knowledge, observation, event.targetId, value); } if (event.targetId === bot.id) { const value = ownPrivate(beforeState, event.actorId).hand?.find((card) => card.value !== 3)?.value; if (value) setExact(knowledge, observation, event.actorId, value); } }
      if (event.type === 'PLAYER_ELIMINATED') { delete knowledge.beliefsByPlayerId[event.playerId]; delete knowledge.exposedToByPlayerId[event.playerId]; }
    }
  }
  if (nextState.matchState === 'GAME_OVER') room.botKnowledgeByPlayerId = {};
}

function validTargets(publicState, actorId, value) {
  const active = publicState.players.filter((player) => !player.isEliminated);
  if (value === 5) return active.filter((player) => !player.isProtected || player.id === actorId).map((player) => player.id);
  return [1, 2, 3, 6].includes(value) ? active.filter((player) => player.id !== actorId && !player.isProtected).map((player) => player.id) : [];
}
function guardGuesses(belief) {
  if (belief?.exactValue && belief.exactValue !== 1) return [belief.exactValue];
  return Object.entries(belief?.probabilities || {}).filter(([value, probability]) => Number(value) !== 1 && probability > 0 && !belief.excludedValues?.includes(Number(value))).sort(([, a], [, b]) => b - a).slice(0, 2).map(([value]) => Number(value));
}
function buildCandidates(observation, knowledge) {
  const hand = observation.privateState.hand || [];
  const forced = hand.some((card) => card.value === 7) && hand.some((card) => card.value === 5 || card.value === 6);
  const cards = forced ? hand.filter((card) => card.value === 7) : hand.filter((card) => card.value !== 8 || hand.length === 1);
  const candidates = [];
  for (const card of cards) {
    const targets = validTargets(observation.publicState, observation.privateState.id, card.value);
    if (card.value === 1) { if (!targets.length) candidates.push({ cardId: card.id, value: 1 }); for (const targetId of targets) for (const guessValue of guardGuesses(knowledge.beliefsByPlayerId[targetId])) candidates.push({ cardId: card.id, value: 1, targetId, guessValue }); }
    else if ([2, 3, 6].includes(card.value)) { if (!targets.length) candidates.push({ cardId: card.id, value: card.value }); for (const targetId of targets) candidates.push({ cardId: card.id, value: card.value, targetId }); }
    else if (card.value === 5) for (const targetId of targets) candidates.push({ cardId: card.id, value: 5, targetId });
    else candidates.push({ cardId: card.id, value: card.value });
  }
  return candidates;
}
function pickWeighted(counts, weights, random) {
  const values = Object.keys(counts).map(Number).filter((value) => counts[value] > 0); const total = values.reduce((sum, value) => sum + counts[value] * Math.max(0.001, weights?.[value] || 0.001), 0); let cursor = random() * total;
  for (const value of values) { cursor -= counts[value] * Math.max(0.001, weights?.[value] || 0.001); if (cursor <= 0) return value; } return values[values.length - 1];
}
function makeCard(value, index) { return { id: `ai_sim_${index}_${value}`, value, name: CARD_NAMES[value] }; }
function sampleState(observation, knowledge, random) {
  const { publicState, privateState } = observation; const counts = remainingCounts(publicState, privateState); let index = 0;
  const players = publicState.players.map((player) => ({ ...player, discardPile: (player.discardPile || []).map((card) => ({ ...card })) })); const secrets = { [privateState.id]: { id: privateState.id, hand: privateState.hand.map((card) => ({ ...card })) } };
  for (const player of players) if (player.id !== privateState.id) { const hand = []; const belief = knowledge.beliefsByPlayerId[player.id]; for (let i = 0; i < player.cardCount; i++) { const value = belief?.exactValue || pickWeighted(counts, belief?.probabilities, random); if (!value) break; counts[value] -= 1; hand.push(makeCard(value, index++)); } secrets[player.id] = { id: player.id, hand }; player.cardCount = hand.length; }
  const deck = []; for (let i = 0; i < publicState.deckCount; i++) { const value = pickWeighted(counts, null, random); if (!value) break; counts[value] -= 1; deck.push(makeCard(value, index++)); }
  let setAsideCard = null; if (publicState.setAsideCardCount) { const value = pickWeighted(counts, null, random); if (value) { counts[value] -= 1; setAsideCard = makeCard(value, index++); } }
  return { matchState: publicState.matchState, playPhase: publicState.playPhase, roundNumber: publicState.roundNumber, config: { ...publicState.config }, players, secrets, deck, setAsideCard, setAsideOpenCards: [], currentTurnPlayerId: publicState.currentTurnPlayerId, turnStartedAt: publicState.turnStartedAt, turnExpiresAt: publicState.turnExpiresAt, lastAction: null, stateVersion: publicState.stateVersion, matchWinnerId: publicState.matchWinnerId, roundWinnerIds: [...(publicState.roundWinnerIds || [])], outcome: null };
}
function fallbackActionFromState(state, playerId) {
  const hand = state.secrets?.[playerId]?.hand || []; const forced = hand.some((card) => card.value === 7) && hand.some((card) => card.value === 5 || card.value === 6); const card = [...hand].filter((candidate) => !forced || candidate.value === 7).filter((candidate) => candidate.value !== 8 || hand.length === 1).sort((a, b) => a.value - b.value)[0];
  if (!card) return null; const targetId = validTargets({ players: state.players }, playerId, card.value)[0]; return { type: 'PLAY_CARD', playerId, cardId: card.id, ...(targetId ? { targetId } : {}), ...(card.value === 1 && targetId ? { guessValue: 2 } : {}) };
}
function settle(core, state) { let current = state; if (current.playPhase === 'ACTION_RESOLVING') current = core.executeCommand(current, { type: 'FINALIZE_ACTION' }).nextState; if (current.playPhase === 'TURN_PREPARING') current = core.executeCommand(current, { type: 'OPEN_TURN', playerId: current.currentTurnPlayerId }).nextState; return current; }
function utility(state, botId, events = []) { const bot = findPlayer(state, botId); if (!bot || bot.isEliminated) return -1; if (state.roundWinnerIds?.includes(botId) || state.outcome?.winnerIds?.includes(botId)) return 1; const handValue = state.secrets?.[botId]?.hand?.[0]?.value || 0; return Math.min(0.75, handValue / 16 + (events.some((event) => event.type === 'PLAYER_ELIMINATED' && event.eliminatedBy === botId) ? 0.18 : 0) + (bot.isProtected ? 0.08 : 0)); }
function heuristicScore(candidate, observation, knowledge) {
  const self = observation.privateState.id; const remaining = observation.privateState.hand.find((card) => card.id !== candidate.cardId)?.value || 0; const belief = candidate.targetId ? knowledge.beliefsByPlayerId[candidate.targetId] : null; const exposed = Object.keys(knowledge.exposedToByPlayerId || {}).length > 0;
  if (candidate.value === 1) return belief?.exactValue === candidate.guessValue ? 1 : (belief?.probabilities?.[candidate.guessValue] || 0) * 0.6;
  if (candidate.value === 2) return belief?.exactValue ? 0.04 : 0.18;
  if (candidate.value === 3) { const win = belief?.exactValue ? Number(remaining > belief.exactValue) : Object.entries(belief?.probabilities || {}).reduce((sum, [value, chance]) => sum + (remaining > Number(value) ? chance : 0), 0); const lose = belief?.exactValue ? Number(remaining < belief.exactValue) : Object.entries(belief?.probabilities || {}).reduce((sum, [value, chance]) => sum + (remaining < Number(value) ? chance : 0), 0); return win * 0.65 - lose * 0.9; }
  if (candidate.value === 4) return (remaining >= 5 ? 0.24 : 0.1) + (exposed ? 0.14 : 0);
  if (candidate.value === 5) return belief?.exactValue === 8 ? 0.95 : (candidate.targetId === self ? (remaining <= 2 || exposed ? 0.25 : -0.45) : 0.22);
  if (candidate.value === 6) return remaining <= 3 ? 0.16 : -0.08; if (candidate.value === 7) return 0.08; return -1;
}
function scoreCandidate(candidate, observation, knowledge, core, random) {
  let score = heuristicScore(candidate, observation, knowledge);
  if (core?.executeCommand) { let total = 0; for (let sample = 0; sample < 32; sample++) { try { let state = sampleState(observation, knowledge, random); const result = core.executeCommand(state, { type: 'PLAY_CARD', playerId: observation.privateState.id, cardId: candidate.cardId, targetId: candidate.targetId, guessValue: candidate.guessValue }); state = settle(core, result.nextState); const replyId = state.currentTurnPlayerId; if (state.matchState === 'PLAYING' && replyId && replyId !== observation.privateState.id) { const reply = fallbackActionFromState(state, replyId); if (reply) state = settle(core, core.executeCommand(state, reply).nextState); } total += utility(state, observation.privateState.id, result.events); } catch { total -= 0.2; } } score = score * 0.25 + (total / 32) * 0.75; }
  const profile = PERSONALITY[findPlayer(observation.publicState, observation.privateState.id)?.personality] || PERSONALITY.CALCULATING; if ([1, 3, 5, 6].includes(candidate.value)) score += profile.eliminate; if (candidate.value === 4 || candidate.value === 5) score += profile.survive; if (candidate.value === 2) score += profile.info; if (candidate.value === 7) score += profile.conceal; return score;
}
export function decideBotAction(observationOrState, botOrKnowledge, knowledgeOrCore, coreOrSeed, seedArg) {
  let observation; let knowledge; let core; let seed;
  if (observationOrState?.publicState && observationOrState?.privateState) { observation = observationOrState; knowledge = botOrKnowledge; core = knowledgeOrCore; seed = coreOrSeed; }
  else { const state = observationOrState; const bot = botOrKnowledge; observation = buildBotObservation(state, bot.id); knowledge = knowledgeOrCore || createBotKnowledge(bot.id, state); core = coreOrSeed; seed = seedArg; }
  const candidates = buildCandidates(observation, knowledge);
  if (!candidates.length) {
    const card = observation.privateState.hand?.[0];
    if (!card) return null;
    const targetId = validTargets(observation.publicState, observation.privateState.id, card.value)[0];
    return { cardId: card.id, targetId, guessValue: card.value === 1 && targetId ? 2 : undefined };
  }
  const random = seededRandom(seed || `${observation.privateState.id}:${observation.publicState.roundNumber}:${observation.publicState.stateVersion}`); const ranked = candidates.map((candidate) => ({ candidate, score: scoreCandidate(candidate, observation, knowledge, core, random) })).sort((a, b) => b.score - a.score); const nearBest = ranked.filter((entry) => ranked[0].score - entry.score <= 0.03); const chosen = nearBest.length > 1 ? nearBest[Math.floor(random() * nearBest.length)] : ranked[0]; return { cardId: chosen.candidate.cardId, targetId: chosen.candidate.targetId, guessValue: chosen.candidate.guessValue };
}
