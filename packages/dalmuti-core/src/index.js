export const DALMUTI_RANKS = Object.freeze({
  1: '달무티', 2: '대주교', 3: '시종장', 4: '남작부인', 5: '수녀원장',
  6: '기사', 7: '재봉사', 8: '석공', 9: '요리사', 10: '양치기',
  11: '광부', 12: '농노', 13: '어릿광대',
});

export const ROLE_NAMES = Object.freeze([
  '달무티', '총리대신', '상인', '상인', '상인', '상인', '소작농', '농노',
]);

export const DEFAULT_CONFIG = Object.freeze({
  roundCount: 10,
  maxPlayers: 8,
  turnTimeoutSeconds: 30,
  useStrippedDeck: true,
  philanthropicScoring: false,
  merchantExchange: false,
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const makeId = (prefix, state) => `${prefix}_${state.roundNumber}_${state.stateVersion + 1}_${state.actionSerial + 1}`;

export function makeSeededRandom(seed = Date.now()) {
  let value = (Number(seed) >>> 0) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function createDeck(config = DEFAULT_CONFIG, playerCount = 8) {
  const cards = [];
  let serial = 0;
  for (let rank = 1; rank <= 12; rank += 1) {
    if (config.useStrippedDeck && playerCount === 4 && rank >= 11) continue;
    if (config.useStrippedDeck && playerCount === 5 && rank === 12) continue;
    for (let copy = 0; copy < rank; copy += 1) {
      cards.push({ id: `d_${rank}_${copy}_${serial++}`, rank, name: DALMUTI_RANKS[rank] });
    }
  }
  cards.push({ id: `d_13_0_${serial++}`, rank: 13, name: DALMUTI_RANKS[13] });
  cards.push({ id: `d_13_1_${serial++}`, rank: 13, name: DALMUTI_RANKS[13] });
  return cards;
}

export function shuffle(cards, random = Math.random) {
  const result = [...cards];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function roleForIndex(index, count) {
  if (index === 0) return '달무티';
  if (index === 1) return '총리대신';
  if (index === count - 2) return '소작농';
  if (index === count - 1) return '농노';
  return '상인';
}

function refreshPlayers(state) {
  state.players.forEach((player) => {
    const roleIndex = state.hierarchy.indexOf(player.id);
    player.roleIndex = roleIndex;
    player.role = roleForIndex(roleIndex, state.hierarchy.length);
    player.handCount = state.secrets[player.id]?.hand.length || 0;
    player.finishedPosition = state.finishOrder.indexOf(player.id) + 1 || null;
    player.passed = state.trick.passPlayerIds.includes(player.id);
  });
}

export function createInitialState(players, partialConfig = {}, seed = Date.now()) {
  if (!Array.isArray(players) || players.length < 4 || players.length > 8) {
    throw new Error('달무티는 4명부터 8명까지 플레이할 수 있습니다.');
  }
  const config = { ...DEFAULT_CONFIG, ...partialConfig };
  const random = makeSeededRandom(seed);
  // The Korean edition's common first-round convention is a random table,
  // then the player who was actually dealt the lone Dalmuti (rank 1) takes
  // the first lead.  Keep this seat order until the deal reveals that owner.
  const initialSeatOrder = shuffle(players.map((player) => player.id), random);
  const state = {
    gameType: 'DALMUTI',
    matchState: 'LOBBY',
    playPhase: 'LOBBY',
    roundNumber: 0,
    config,
    players: players.map((player) => ({
      id: player.id, nickname: player.nickname, avatarUrl: player.avatarUrl || player.avatar,
      isHost: !!player.isHost, isBot: !!player.isBot,
      botProfile: player.isBot ? profileNameFor(player, players.filter((candidate) => candidate.isBot).findIndex((candidate) => candidate.id === player.id)) : null,
      score: 0, roleIndex: 0,
      role: '상인', handCount: 0, finishedPosition: null, passed: false,
    })),
    secrets: Object.fromEntries(players.map((player) => [player.id, { hand: [] }])),
    hierarchy: initialSeatOrder,
    initialSeatOrder,
    currentTurnPlayerId: null,
    turnStartedAt: 0,
    turnExpiresAt: 0,
    trick: { requiredCount: null, topRank: null, lastPlayerId: null, passPlayerIds: [], sets: [], completedCount: 0 },
    discardedCards: [],
    finishOrder: [],
    revolutionCandidateId: null,
    tax: null,
    merchantExchange: null,
    lastAction: null,
    outcome: null,
    stateVersion: 1,
    actionSerial: 0,
    randomSeed: Number(seed) >>> 0,
    telemetryMatchKey: `dm_${Date.now().toString(36)}_${Math.floor(random() * 0xFFFFFF).toString(36)}`,
    // Public observations only.  Never place another player's hand here.
    botMemory: createBotMemory(),
  };
  refreshPlayers(state);
  return state;
}

function randomForState(state) {
  const random = makeSeededRandom(state.randomSeed + state.roundNumber * 104729 + state.stateVersion * 31);
  for (let index = 0; index < state.actionSerial; index += 1) random();
  return random;
}

function setTurn(state, playerId, now = Date.now()) {
  state.currentTurnPlayerId = playerId;
  state.turnStartedAt = now;
  state.turnExpiresAt = state.config.turnTimeoutSeconds > 0 ? now + state.config.turnTimeoutSeconds * 1000 : 0;
}

function activeIds(state) {
  return state.hierarchy.filter((id) => (state.secrets[id]?.hand.length || 0) > 0);
}

function nextActive(state, afterId) {
  const active = new Set(activeIds(state));
  const start = state.hierarchy.indexOf(afterId);
  for (let offset = 1; offset <= state.hierarchy.length; offset += 1) {
    const id = state.hierarchy[(start + offset + state.hierarchy.length) % state.hierarchy.length];
    if (active.has(id)) return id;
  }
  return null;
}

function groupHand(hand) {
  const counts = new Map();
  hand.forEach((card) => counts.set(card.rank, (counts.get(card.rank) || 0) + 1));
  return counts;
}

function startTurnPlay(state, actorId = state.hierarchy[0], actionType = 'PLAY_STARTED') {
  state.playPhase = 'TURN_INPUT';
  state.revolutionCandidateId = null;
  state.tax = null;
  state.merchantExchange = null;
  setTurn(state, actorId);
  state.lastAction = { id: makeId('action', state), type: actionType, actorId, timestamp: Date.now() };
}

function rotateHierarchyToLeader(hierarchy, leaderId) {
  const index = hierarchy.indexOf(leaderId);
  return index <= 0 ? [...hierarchy] : [...hierarchy.slice(index), ...hierarchy.slice(0, index)];
}

function maybeStartMerchantExchange(state) {
  if (!state.config.merchantExchange) return false;
  const merchants = state.hierarchy.slice(2, -2);
  if (merchants.length < 2) return false;
  state.playPhase = 'MERCHANT_EXCHANGE';
  state.merchantExchange = { actorId: merchants[0], eligibleTargetIds: merchants.slice(1) };
  setTurn(state, merchants[0]);
  return true;
}

function setupTax(state) {
  const count = state.hierarchy.length;
  const pairs = [
    { dalmutiId: state.hierarchy[0], peonId: state.hierarchy[count - 1], count: 2 },
    { dalmutiId: state.hierarchy[1], peonId: state.hierarchy[count - 2], count: 1 },
  ];
  for (const pair of pairs) {
    const hand = state.secrets[pair.peonId].hand;
    pair.offered = hand.filter((card) => card.rank !== 13).sort((a, b) => a.rank - b.rank).slice(0, pair.count);
    pair.returned = null;
    const offeredIds = new Set(pair.offered.map((card) => card.id));
    state.secrets[pair.peonId].hand = hand.filter((card) => !offeredIds.has(card.id));
  }
  state.tax = { pairs, currentDalmutiId: pairs[0].dalmutiId };
  state.playPhase = 'TAX_RETURN';
  setTurn(state, pairs[0].dalmutiId);
  state.lastAction = { id: makeId('tax-request', state), type: 'TAX_REQUESTED', actorId: pairs[0].dalmutiId, timestamp: Date.now() };
}

function beginRound(state) {
  state.roundNumber += 1;
  state.matchState = 'PLAYING';
  state.playPhase = 'DEALING';
  state.finishOrder = [];
  state.outcome = null;
  state.trick = { requiredCount: null, topRank: null, lastPlayerId: null, passPlayerIds: [], sets: [], completedCount: 0 };
  state.discardedCards = [];
  const memory = ensureBotMemory(state);
  memory.roundEvents = [];
  memory.roundBeliefs = {};
  state.players.forEach((player) => { player.finishedPosition = null; player.passed = false; });
  const random = randomForState(state);
  const deck = shuffle(createDeck(state.config, state.players.length), random);
  Object.values(state.secrets).forEach((secret) => { secret.hand = []; });
  deck.forEach((card, index) => {
    const id = state.hierarchy[index % state.hierarchy.length];
    state.secrets[id].hand.push(card);
  });
  Object.values(state.secrets).forEach((secret) => secret.hand.sort((a, b) => a.rank - b.rank));
  const dealtEvent = { id: makeId('deal', state), type: 'ROUND_DEALT', roundNumber: state.roundNumber, timestamp: Date.now() };
  recordPublicBotEvent(state, dealtEvent);
  const revolution = state.hierarchy.find((id) => state.secrets[id].hand.filter((card) => card.rank === 13).length === 2) || null;
  state.revolutionCandidateId = revolution;

  if (state.roundNumber === 1) {
    const openingLeaderId = state.hierarchy.find((id) => state.secrets[id].hand.some((card) => card.rank === 1));
    state.hierarchy = rotateHierarchyToLeader(state.hierarchy, openingLeaderId);
    // First-round positions are not earned yet: no tax and no revolution.
    state.revolutionCandidateId = null;
    startTurnPlay(state, openingLeaderId, 'OPENING_READY');
    state.pendingEvents = [dealtEvent, state.lastAction];
  } else if (revolution) {
    state.playPhase = 'REVOLUTION_DECISION';
    setTurn(state, revolution);
    state.lastAction = dealtEvent;
    state.pendingEvents = [dealtEvent];
  } else {
    setupTax(state);
    state.pendingEvents = [dealtEvent, state.lastAction];
  }
  refreshPlayers(state);
}

function createBotMemory() {
  return { roundEvents: [], opponentStats: {}, roundBeliefs: {} };
}

function ensureBotMemory(state) {
  const legacy = state.botMemory?.publicEvents || [];
  const memory = state.botMemory || createBotMemory();
  if (!Array.isArray(memory.roundEvents)) memory.roundEvents = legacy.filter((event) => event.roundNumber === state.roundNumber);
  if (!memory.opponentStats || typeof memory.opponentStats !== 'object') memory.opponentStats = {};
  if (!memory.roundBeliefs || typeof memory.roundBeliefs !== 'object') memory.roundBeliefs = {};
  state.botMemory = memory;
  return memory;
}

function opponentStatsFor(memory, playerId) {
  if (!playerId) return null;
  if (!memory.opponentStats[playerId]) {
    memory.opponentStats[playerId] = {
      samples: 0, leadCardMean: 1, weakLeadMean: 0.5, jesterRate: 0,
      passRates: {}, nearFinishPressure: 0.5,
    };
  }
  return memory.opponentStats[playerId];
}

function recordPublicBotEvent(state, event) {
  if (!event?.id || !event?.type) return;
  const journal = ensureBotMemory(state);
  if (journal.roundEvents.some((entry) => entry.id === event.id)) return;
  const entry = {
    id: event.id,
    type: event.type,
    actorId: event.actorId || null,
    targetId: event.targetId || null,
    rank: event.rank ?? null,
    count: event.count ?? null,
    jesterCount: event.jesterCount ?? 0,
    requiredCount: event.requiredCount ?? null,
    topRank: event.topRank ?? null,
    handCount: event.handCount ?? null,
    wasLead: !!event.wasLead,
    roundNumber: state.roundNumber,
    serial: state.actionSerial,
  };
  journal.roundEvents.push(entry);
  if (journal.roundEvents.length > 128) journal.roundEvents.splice(0, journal.roundEvents.length - 128);
  if (entry.actorId && entry.type === 'SET_PLAYED') {
    const stats = opponentStatsFor(journal, entry.actorId);
    const weight = 1 / Math.min(12, stats.samples + 1);
    stats.samples += 1;
    if (entry.wasLead) {
      stats.leadCardMean += (Number(entry.count || 1) - stats.leadCardMean) * weight;
      stats.weakLeadMean += ((Number(entry.rank || 13) / 13) - stats.weakLeadMean) * weight;
    }
    stats.jesterRate += ((Number(entry.jesterCount || 0) / Math.max(1, Number(entry.count || 1))) - stats.jesterRate) * weight;
    if (Number(entry.handCount || 99) <= 3) stats.nearFinishPressure += (1 - stats.nearFinishPressure) * weight;
  }
  if (entry.actorId && entry.type === 'PASSED' && entry.requiredCount) {
    const stats = opponentStatsFor(journal, entry.actorId);
    const key = String(Math.min(4, entry.requiredCount));
    const previous = stats.passRates[key] ?? 0.5;
    stats.passRates[key] = previous + (1 - previous) / Math.min(12, stats.samples + 1);
    const beliefs = journal.roundBeliefs[entry.actorId] || (journal.roundBeliefs[entry.actorId] = []);
    beliefs.push({ requiredCount: entry.requiredCount, topRank: entry.topRank, serial: entry.serial });
    if (beliefs.length > 8) beliefs.shift();
  }
}

function selectCards(hand, selection) {
  const wanted = new Map();
  for (const entry of selection || []) {
    const rank = Number(entry.rank);
    const count = Number(entry.count);
    if (!Number.isInteger(rank) || !Number.isInteger(count) || count < 1) throw new Error('카드 선택이 올바르지 않습니다.');
    wanted.set(rank, (wanted.get(rank) || 0) + count);
  }
  const chosen = [];
  for (const [rank, count] of wanted) {
    const candidates = hand.filter((card) => card.rank === rank);
    if (candidates.length < count) throw new Error('보유하지 않은 카드를 선택했습니다.');
    chosen.push(...candidates.slice(0, count));
  }
  return chosen;
}

function finishTaxIfReady(state) {
  const pending = state.tax.pairs.find((pair) => !pair.returned);
  if (pending) {
    state.tax.currentDalmutiId = pending.dalmutiId;
    setTurn(state, pending.dalmutiId);
    return;
  }
  for (const pair of state.tax.pairs) {
    state.secrets[pair.dalmutiId].hand.push(...pair.offered);
    state.secrets[pair.peonId].hand.push(...pair.returned);
    state.secrets[pair.dalmutiId].hand.sort((a, b) => a.rank - b.rank);
    state.secrets[pair.peonId].hand.sort((a, b) => a.rank - b.rank);
  }
  const completedPairs = state.tax.pairs.map(({ dalmutiId, peonId, count }) => ({ dalmutiId, peonId, count }));
  if (!maybeStartMerchantExchange(state)) startTurnPlay(state);
  state.lastAction = { id: makeId('tax', state), type: 'TAX_COMPLETED', pairs: completedPairs, timestamp: Date.now() };
}

function validatePlay(state, command) {
  if (state.playPhase !== 'TURN_INPUT') throw new Error('지금은 카드를 낼 수 없습니다.');
  if (state.currentTurnPlayerId !== command.playerId) throw new Error('내 차례가 아닙니다.');
  const rank = Number(command.rank);
  const count = Number(command.count);
  const jesterCount = Number(command.jesterCount || 0);
  if (!Number.isInteger(rank) || rank < 1 || rank > 13 || !Number.isInteger(count) || count < 1) throw new Error('낼 카드 구성이 올바르지 않습니다.');
  if (!Number.isInteger(jesterCount) || jesterCount < 0 || jesterCount > count) throw new Error('어릿광대 수가 올바르지 않습니다.');
  if (rank === 13 && jesterCount !== count) throw new Error('어릿광대만 낼 때는 모두 어릿광대여야 합니다.');
  if (rank !== 13 && count === jesterCount) throw new Error('어릿광대는 숫자 카드와 함께 내야 합니다.');
  if (state.trick.requiredCount != null && count !== state.trick.requiredCount) throw new Error(`같은 장수(${state.trick.requiredCount}장)를 내야 합니다.`);
  if (state.trick.topRank != null && rank >= state.trick.topRank) throw new Error('중앙 카드보다 더 강한 낮은 숫자를 내야 합니다.');
  const counts = groupHand(state.secrets[command.playerId].hand);
  if ((counts.get(13) || 0) < jesterCount || (counts.get(rank) || 0) < count - jesterCount) throw new Error('선택한 카드가 손패에 부족합니다.');
  return { rank, count, jesterCount };
}

function endRound(state) {
  const remaining = activeIds(state);
  for (const id of remaining) if (!state.finishOrder.includes(id)) state.finishOrder.push(id);
  state.matchState = state.roundNumber >= state.config.roundCount ? 'GAME_OVER' : 'ROUND_END';
  state.playPhase = state.matchState;
  state.currentTurnPlayerId = null;
  state.turnExpiresAt = 0;
  if (state.config.philanthropicScoring && state.roundNumber > 1) {
    const previous = state.hierarchy;
    const next = state.finishOrder;
    if (next.indexOf(previous.at(-1)) < previous.length - 1) state.players.find((p) => p.id === previous[0]).score += 1;
    if (next.indexOf(previous.at(-2)) < previous.length - 2) state.players.find((p) => p.id === previous[1]).score += 1;
  }
  const scores = Object.fromEntries(state.players.map((player) => [player.id, player.score]));
  const highScore = Math.max(...Object.values(scores));
  state.outcome = {
    kind: state.matchState === 'GAME_OVER' ? 'MATCH' : 'ROUND',
    finishOrder: [...state.finishOrder], scores,
    winnerIds: state.matchState === 'GAME_OVER' ? state.players.filter((player) => player.score === highScore).map((player) => player.id) : [state.finishOrder[0]],
    advanceAt: state.matchState === 'ROUND_END' ? Date.now() + 8000 : null,
  };
  state.lastAction = { id: makeId('round', state), type: state.matchState === 'GAME_OVER' ? 'MATCH_ENDED' : 'ROUND_ENDED', finishOrder: [...state.finishOrder], timestamp: Date.now() };
}

function playSet(state, command) {
  const play = validatePlay(state, command);
  const wasLead = state.trick.requiredCount == null;
  const hand = state.secrets[command.playerId].hand;
  const natural = play.rank === 13 ? [] : hand.filter((card) => card.rank === play.rank).slice(0, play.count - play.jesterCount);
  const jesters = hand.filter((card) => card.rank === 13).slice(0, play.jesterCount);
  const cards = [...natural, ...jesters];
  const cardIds = new Set(cards.map((card) => card.id));
  state.secrets[command.playerId].hand = hand.filter((card) => !cardIds.has(card.id));
  state.actionSerial += 1;
  const set = { id: makeId('set', state), actorId: command.playerId, rank: play.rank, count: play.count, jesterCount: play.jesterCount, cards, wasLead };
  state.trick.sets.push(set);
  state.trick.requiredCount = play.count;
  state.trick.topRank = play.rank;
  state.trick.lastPlayerId = command.playerId;
  state.trick.passPlayerIds = [];
  state.lastAction = { ...set, type: 'SET_PLAYED', timestamp: Date.now() };
  if (state.secrets[command.playerId].hand.length === 0 && !state.finishOrder.includes(command.playerId)) {
    state.finishOrder.push(command.playerId);
    const points = activeIds(state).length;
    state.players.find((player) => player.id === command.playerId).score += points;
  }
  if (activeIds(state).length <= 1) {
    endRound(state);
  } else {
    setTurn(state, nextActive(state, command.playerId));
  }
}

function pass(state, command) {
  if (state.playPhase !== 'TURN_INPUT' || state.currentTurnPlayerId !== command.playerId) throw new Error('지금은 패스할 수 없습니다.');
  if (state.trick.requiredCount == null) throw new Error('새 트릭의 선은 패스할 수 없습니다.');
  const passEvent = {
    id: makeId('pass', state), type: 'PASSED', actorId: command.playerId,
    requiredCount: state.trick.requiredCount, topRank: state.trick.topRank,
    handCount: state.secrets[command.playerId]?.hand.length || 0, timestamp: Date.now(),
  };
  if (!state.trick.passPlayerIds.includes(command.playerId)) state.trick.passPlayerIds.push(command.playerId);
  state.actionSerial += 1;
  recordPublicBotEvent(state, passEvent);
  state.lastAction = passEvent;
  const requiredPassers = activeIds(state).filter((id) => id !== state.trick.lastPlayerId);
  if (requiredPassers.every((id) => state.trick.passPlayerIds.includes(id))) {
    const leader = activeIds(state).includes(state.trick.lastPlayerId) ? state.trick.lastPlayerId : nextActive(state, state.trick.lastPlayerId);
    state.discardedCards.push(...state.trick.sets.flatMap((set) => set.cards || []));
    state.trick = { requiredCount: null, topRank: null, lastPlayerId: null, passPlayerIds: [], sets: [], completedCount: state.trick.completedCount + 1 };
    state.lastAction = { id: makeId('clear', state), type: 'TRICK_CLEARED', actorId: leader, timestamp: Date.now() };
    state.pendingEvents = [passEvent, state.lastAction];
    setTurn(state, leader);
  } else {
    setTurn(state, nextActive(state, command.playerId));
  }
}

export function getLegalPlays(state, playerId) {
  if (state.playPhase !== 'TURN_INPUT' || state.currentTurnPlayerId !== playerId) return [];
  const counts = groupHand(state.secrets[playerId]?.hand || []);
  const jesters = counts.get(13) || 0;
  const plays = [];
  for (let rank = 1; rank <= 12; rank += 1) {
    const natural = counts.get(rank) || 0;
    if (!natural) continue;
    const required = state.trick.requiredCount;
    const totals = required == null ? Array.from({ length: natural + jesters }, (_, index) => index + 1) : [required];
    for (const count of totals) {
      if (state.trick.topRank != null && rank >= state.trick.topRank) continue;
      const minJesters = Math.max(0, count - natural);
      const maxJesters = Math.min(jesters, count - 1);
      for (let jesterCount = minJesters; jesterCount <= maxJesters; jesterCount += 1) plays.push({ rank, count, jesterCount });
    }
  }
  if (jesters && (state.trick.topRank == null || 13 < state.trick.topRank)) {
    const required = state.trick.requiredCount;
    const totals = required == null ? Array.from({ length: jesters }, (_, index) => index + 1) : [required];
    totals.filter((count) => count <= jesters).forEach((count) => plays.push({ rank: 13, count, jesterCount: count }));
  }
  return plays;
}

export function executeCommand(input, command) {
  const state = clone(input);
  const previousActionId = state.lastAction?.id;
  if (!command || typeof command.type !== 'string') throw new Error('달무티 명령이 올바르지 않습니다.');
  if (command.expectedStateVersion != null && command.expectedStateVersion !== state.stateVersion) throw new Error('게임 상태가 변경되었습니다. 다시 선택해 주세요.');
  switch (command.type) {
    case 'START_MATCH':
      if (state.matchState !== 'LOBBY' && state.matchState !== 'GAME_OVER') throw new Error('매치를 시작할 수 없습니다.');
      state.roundNumber = 0;
      state.players.forEach((player) => { player.score = 0; });
      state.botMemory = createBotMemory();
      beginRound(state);
      break;
    case 'ADVANCE_ROUND':
      if (state.matchState !== 'ROUND_END') throw new Error('다음 라운드를 시작할 수 없습니다.');
      state.hierarchy = [...state.finishOrder];
      beginRound(state);
      break;
    case 'DECLARE_REVOLUTION':
      if (state.playPhase !== 'REVOLUTION_DECISION' || state.revolutionCandidateId !== command.playerId) throw new Error('혁명을 선언할 수 없습니다.');
      {
        const isGreatRevolution = command.playerId === state.hierarchy[state.hierarchy.length - 1];
        if (isGreatRevolution) state.hierarchy.reverse();
        const revolutionType = isGreatRevolution ? 'GREAT_REVOLUTION' : 'REVOLUTION';
        startTurnPlay(state, state.hierarchy[0], revolutionType);
        state.lastAction = { id: makeId('revolution', state), type: revolutionType, actorId: command.playerId, timestamp: Date.now() };
      }
      break;
    case 'DECLINE_REVOLUTION':
      if (state.playPhase !== 'REVOLUTION_DECISION' || state.revolutionCandidateId !== command.playerId) throw new Error('혁명 결정을 내릴 수 없습니다.');
      setupTax(state);
      break;
    case 'SELECT_TAX_RETURN': {
      if (state.playPhase !== 'TAX_RETURN' || state.tax.currentDalmutiId !== command.playerId) throw new Error('지금은 세금 반환 카드를 고를 수 없습니다.');
      const pair = state.tax.pairs.find((candidate) => candidate.dalmutiId === command.playerId);
      const chosen = selectCards(state.secrets[command.playerId].hand, command.selection);
      if (chosen.length !== pair.count) throw new Error(`${pair.count}장을 선택해야 합니다.`);
      const chosenIds = new Set(chosen.map((card) => card.id));
      state.secrets[command.playerId].hand = state.secrets[command.playerId].hand.filter((card) => !chosenIds.has(card.id));
      pair.returned = chosen;
      finishTaxIfReady(state);
      break;
    }
    case 'SELECT_MERCHANT_EXCHANGE_TARGET': {
      if (state.playPhase !== 'MERCHANT_EXCHANGE' || state.merchantExchange.actorId !== command.playerId || !state.merchantExchange.eligibleTargetIds.includes(command.targetId)) throw new Error('교환할 상인을 선택할 수 없습니다.');
      const random = randomForState(state);
      const a = state.secrets[command.playerId].hand;
      const b = state.secrets[command.targetId].hand;
      const ai = Math.floor(random() * a.length); const bi = Math.floor(random() * b.length);
      [a[ai], b[bi]] = [b[bi], a[ai]];
      state.lastAction = { id: makeId('merchant', state), type: 'MERCHANT_EXCHANGED', actorId: command.playerId, targetId: command.targetId, timestamp: Date.now() };
      startTurnPlay(state);
      break;
    }
    case 'PLAY_SET': playSet(state, command); break;
    case 'PASS': pass(state, command); break;
    default: throw new Error('지원하지 않는 달무티 명령입니다.');
  }
  state.stateVersion += 1;
  recordPublicBotEvent(state, state.lastAction);
  refreshPlayers(state);
  const pendingEvents = state.pendingEvents;
  delete state.pendingEvents;
  return {
    nextState: state,
    events: pendingEvents || (state.lastAction && state.lastAction.id !== previousActionId ? [state.lastAction] : []),
  };
}

const BOT_PROFILES = Object.freeze({
  AGGRESSIVE: { memoryLimit: 30, temperature: 22, shedWeight: 13, controlWeight: 52, chainWeight: 7, blockWeight: 78, responseCommitment: 38, jesterReserve: 10, modelWeight: 9 },
  DEFENSIVE: { memoryLimit: 34, temperature: 11, shedWeight: 8, controlWeight: 84, chainWeight: 6, blockWeight: 48, responseCommitment: 10, jesterReserve: 30, modelWeight: 12 },
  CALCULATING: { memoryLimit: 48, temperature: 8, shedWeight: 12, controlWeight: 84, chainWeight: 15, blockWeight: 70, responseCommitment: 24, jesterReserve: 16, modelWeight: 16 },
  STRATEGIC: { memoryLimit: 38, temperature: 14, shedWeight: 11, controlWeight: 74, chainWeight: 18, blockWeight: 64, responseCommitment: 20, jesterReserve: 18, modelWeight: 13 },
  INFORMATIVE: { memoryLimit: 56, temperature: 16, shedWeight: 11, controlWeight: 72, chainWeight: 12, blockWeight: 68, responseCommitment: 16, jesterReserve: 18, modelWeight: 25 },
});

const BOT_PROFILE_NAMES = Object.freeze(Object.keys(BOT_PROFILES));
const LEGACY_PROFILES = Object.freeze({ CAUTIOUS: 'DEFENSIVE', BALANCED: 'STRATEGIC', AGGRESSIVE: 'AGGRESSIVE' });

function stableBotProfileIndex(playerId) {
  return [...String(playerId || '')].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 17) % BOT_PROFILE_NAMES.length;
}

function profileNameFor(player, fallbackIndex = 0) {
  const requested = String(player?.personality || player?.botProfile || '').toUpperCase();
  if (BOT_PROFILES[requested]) return requested;
  if (LEGACY_PROFILES[requested]) return LEGACY_PROFILES[requested];
  return BOT_PROFILE_NAMES[Math.max(0, fallbackIndex) % BOT_PROFILE_NAMES.length];
}

function inferredProfileFromMemory(state, playerId) {
  const stats = ensureBotMemory(state).opponentStats[playerId];
  if (!stats || stats.samples < 3) return null;
  const signatures = {
    AGGRESSIVE: [2.5, 0.68, 0.65], DEFENSIVE: [1.35, 0.35, 0.35],
    CALCULATING: [1.8, 0.5, 0.5], STRATEGIC: [2.15, 0.52, 0.55], INFORMATIVE: [1.7, 0.46, 0.48],
  };
  const observed = [stats.leadCardMean, stats.weakLeadMean, stats.nearFinishPressure];
  return BOT_PROFILE_NAMES.reduce((best, name) => {
    const distance = signatures[name].reduce((sum, value, index) => sum + (value - observed[index]) ** 2, 0);
    return distance < best.distance ? { name, distance } : best;
  }, { name: null, distance: Infinity }).name;
}

export function assignBotProfile(state, playerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return null;
  player.isBot = true;
  if (!BOT_PROFILES[player.botProfile]) player.botProfile = inferredProfileFromMemory(state, playerId) || profileNameFor(player, stableBotProfileIndex(playerId));
  return player.botProfile;
}

function botProfileFor(state, playerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  const profileName = profileNameFor(player, stableBotProfileIndex(playerId));
  return BOT_PROFILES[profileName];
}

function handCounts(hand) {
  return hand.reduce((counts, card) => counts.set(card.rank, (counts.get(card.rank) || 0) + 1), new Map());
}

function subtractCounts(total, cards) {
  const result = new Map(total);
  for (const card of cards) result.set(card.rank, Math.max(0, (result.get(card.rank) || 0) - 1));
  return result;
}

function observationCounts(events) {
  const counts = new Map();
  events.filter((event) => event.type === 'SET_PLAYED').forEach((event) => {
    const naturalCount = Math.max(0, Number(event.count || 0) - Number(event.jesterCount || 0));
    if (naturalCount) counts.set(event.rank, (counts.get(event.rank) || 0) + naturalCount);
    if (event.jesterCount) counts.set(13, (counts.get(13) || 0) + event.jesterCount);
  });
  return counts;
}

function rememberedEvents(state, profile) {
  const events = ensureBotMemory(state).roundEvents || [];
  const salient = events.filter((event) => event.type === 'PASSED' || event.rank <= 3 || event.jesterCount || event.count >= 2);
  const tail = events.slice(-profile.memoryLimit);
  return [...new Map([...salient, ...tail].map((event) => [event.id, event])).values()];
}

function withoutPlayedCards(hand, play) {
  let natural = play.rank === 13 ? 0 : play.count - play.jesterCount;
  let jokers = play.jesterCount;
  return hand.filter((card) => {
    if (card.rank === 13 && jokers > 0) { jokers -= 1; return false; }
    if (card.rank === play.rank && natural > 0) { natural -= 1; return false; }
    return true;
  });
}

function opponentAggression(view, playerId) {
  const stats = view.opponentStats[playerId];
  if (!stats?.samples) return 0.5;
  return Math.max(0.15, Math.min(0.95, 0.2 + stats.leadCardMean / 8 + stats.weakLeadMean * 0.22 + stats.nearFinishPressure * 0.18));
}

function passLikelihood(view, playerId, hand, modelWeight) {
  const constraints = view.roundBeliefs[playerId] || [];
  if (!constraints.length) return 1;
  const counts = handCounts(hand);
  let likelihood = 1;
  for (const pass of constraints) {
    const canHavePlayed = [...counts.entries()].some(([rank, count]) => rank < pass.topRank && count + (counts.get(13) || 0) >= pass.requiredCount);
    // Profiles with a stronger opponent model trust observed passes more.
    if (canHavePlayed) likelihood *= Math.max(0.08, 0.48 - modelWeight * 0.016);
  }
  return likelihood;
}

function canBeat(hand, topRank, count) {
  const counts = handCounts(hand);
  const jokers = counts.get(13) || 0;
  for (let rank = 1; rank < topRank; rank += 1) {
    if ((counts.get(rank) || 0) + jokers >= count && (counts.get(rank) || 0) > 0) return rank;
  }
  return null;
}

function sampleHands(view, playerId, random) {
  const pool = [];
  for (const [rank, count] of view.unknownCounts) for (let index = 0; index < count; index += 1) pool.push({ rank });
  const shuffled = shuffle(pool, random);
  let cursor = 0;
  const hands = new Map();
  view.hierarchy.filter((id) => id !== playerId).forEach((id) => {
    const count = view.players.find((player) => player.id === id)?.handCount || 0;
    hands.set(id, shuffled.slice(cursor, cursor + count));
    cursor += count;
  });
  return hands;
}

function rolloutControlChance(state, view, playerId, play, modelWeight) {
  if (play.rank <= 1) return 1;
  const random = decisionRandom(state, playerId, play.rank * 97 + play.count * 17 + play.jesterCount);
  let weightedControl = 0;
  let totalWeight = 0;
  for (let sample = 0; sample < 16; sample += 1) {
    const hands = sampleHands(view, playerId, random);
    let topRank = play.rank;
    let lastPlayerId = playerId;
    let weight = 1;
    const start = view.hierarchy.indexOf(playerId);
    for (let offset = 1; offset < view.hierarchy.length; offset += 1) {
      const id = view.hierarchy[(start + offset) % view.hierarchy.length];
      if (id === playerId || !hands.has(id)) continue;
      const hand = hands.get(id);
      weight *= passLikelihood(view, id, hand, modelWeight);
      const responseRank = canBeat(hand, topRank, play.count);
      if (responseRank == null) continue;
      const observedAggression = opponentAggression(view, id);
      const confidence = Math.min(1, 0.35 + modelWeight / 28);
      const aggression = 0.5 + (observedAggression - 0.5) * confidence;
      const contestChance = 0.26 + aggression * 0.58 + (hand.length <= 3 ? 0.12 : 0);
      if (random() < contestChance) { topRank = responseRank; lastPlayerId = id; }
    }
    totalWeight += weight;
    if (lastPlayerId === playerId) weightedControl += weight;
  }
  return totalWeight ? weightedControl / totalWeight : 0.5;
}

function handShape(hand) {
  const counts = handCounts(hand);
  const groups = [...counts.entries()].filter(([rank]) => rank !== 13);
  return { groups: groups.length, singles: groups.filter(([, count]) => count === 1).length, jokers: counts.get(13) || 0 };
}

function quickControlChance(view, play) {
  if (play.rank <= 1) return 1;
  const stronger = Array.from({ length: play.rank - 1 }, (_, index) => view.unknownCounts.get(index + 1) || 0).reduce((sum, count) => sum + count, 0);
  const density = stronger / Math.max(1, view.unknownCardTotal);
  const active = view.players.filter((player) => player.id !== view.playerId && player.handCount > 0).length;
  return Math.max(0.04, Math.min(0.96, Math.pow(1 - density * Math.min(1, play.count * 0.8), active)));
}

function forecastLeadRun(view, hand, depth = 2) {
  if (depth <= 0 || !hand.length) return 0;
  const counts = handCounts(hand);
  const groups = [...counts.entries()].filter(([rank]) => rank !== 13)
    .flatMap(([rank, count]) => count > 1 ? [{ rank, count }, { rank, count: 1 }] : [{ rank, count }])
    .sort((a, b) => (b.count * 12 + b.rank) - (a.count * 12 + a.rank)).slice(0, 4);
  if (!groups.length) return (counts.get(13) || 0) * 2;
  return Math.max(...groups.map((group) => {
    const virtualPlay = { ...group, jesterCount: 0 };
    const holdLeadChance = quickControlChance(view, virtualPlay);
    const after = withoutPlayedCards(hand, virtualPlay);
    return group.count * 14 + group.rank * 1.5 + holdLeadChance * forecastLeadRun(view, after, depth - 1);
  }));
}

export function getBotPerspective(state, playerId) {
  const profile = botProfileFor(state, playerId);
  const memory = rememberedEvents(state, profile);
  const ownHand = clone(state.secrets[playerId]?.hand || []);
  const deckCounts = handCounts(createDeck(state.config, state.players.length));
  const seenCounts = observationCounts(memory);
  const unknownCounts = subtractCounts(subtractCounts(deckCounts, ownHand), [...seenCounts.entries()]
    .flatMap(([rank, count]) => Array.from({ length: count }, () => ({ rank }))));
  const journal = ensureBotMemory(state);
  return {
    playerId, profile, ownHand,
    players: state.players.map((player) => ({ id: player.id, handCount: player.handCount, roleIndex: player.roleIndex, score: player.score })),
    hierarchy: [...state.hierarchy],
    trick: { requiredCount: state.trick.requiredCount, topRank: state.trick.topRank, lastPlayerId: state.trick.lastPlayerId, passPlayerIds: [...state.trick.passPlayerIds] },
    finishOrder: [...state.finishOrder], memory: clone(memory), unknownCounts,
    unknownCardTotal: [...unknownCounts.values()].reduce((sum, count) => sum + count, 0),
    opponentStats: clone(journal.opponentStats), roundBeliefs: clone(journal.roundBeliefs),
  };
}

function riskNeed(view, playerId) {
  const player = view.players.find((candidate) => candidate.id === playerId);
  const scores = view.players.map((candidate) => candidate.score);
  const behind = Math.max(...scores) - (player?.score || 0);
  const peonPressure = (player?.roleIndex || 0) / Math.max(1, view.players.length - 1);
  return Math.min(1, behind / 8 + peonPressure * 0.45);
}

function dynamicJesterCost(hand, play, profile) {
  if (!play.jesterCount) return 0;
  const before = handShape(hand);
  const after = handShape(withoutPlayedCards(hand, play));
  const completesGroup = play.rank !== 13 && (handCounts(hand).get(play.rank) || 0) === play.count - play.jesterCount;
  const preserveValue = before.jokers > after.jokers && after.groups > 0 ? profile.jesterReserve : 0;
  return preserveValue - (completesGroup ? 12 : 0) + (play.rank === 13 && hand.length > play.count ? 90 : 0);
}

function evaluateBotPlay(state, view, playerId, play, profile) {
  const hand = view.ownHand;
  const counts = handCounts(hand);
  const remaining = hand.length - play.count;
  const isLead = view.trick.requiredCount == null;
  const remainingHand = withoutPlayedCards(hand, play);
  const beforeShape = handShape(hand);
  const afterShape = handShape(remainingHand);
  const controlChance = rolloutControlChance(state, view, playerId, play, profile.modelWeight);
  const nearFinishers = view.players.filter((player) => player.id !== playerId && player.handCount > 0 && player.handCount <= 3).length;
  const clearsNaturalGroup = play.rank !== 13 && (counts.get(play.rank) || 0) === play.count - play.jesterCount;
  let score = play.rank * 3 + play.count * profile.shedWeight;
  score += (beforeShape.groups - afterShape.groups) * 18 + (beforeShape.singles - afterShape.singles) * 7;
  if (clearsNaturalGroup) score += 18;
  if (remaining === 0) score += 10_000;
  score += controlChance * profile.controlWeight;
  score += controlChance * forecastLeadRun(view, remainingHand) * (profile.chainWeight / 11);
  score -= dynamicJesterCost(hand, play, profile);
  if (play.rank <= 3 && remaining > 0) score -= (4 - play.rank) * (10 - riskNeed(view, playerId) * 5);
  if (isLead) score += (play.count - 1) * profile.chainWeight;
  else {
    score += Math.max(0, view.trick.topRank - play.rank) * 7;
    score += nearFinishers * profile.blockWeight;
    score -= (1 - controlChance) * (42 - riskNeed(view, playerId) * 24);
  }
  return { score, controlChance };
}

function chooseTaxReturn(state, playerId, count) {
  const hand = state.secrets[playerId].hand;
  const counts = handCounts(hand);
  const chosen = hand.filter((card) => card.rank !== 13)
    .sort((a, b) => {
      const score = (card) => card.rank * 16 - Math.max(0, (counts.get(card.rank) || 0) - 1) * 7 - (card.rank === 13 ? 1000 : 0);
      return score(b) - score(a);
    })
    .slice(0, count);
  const selected = new Map();
  chosen.forEach((card) => selected.set(card.rank, (selected.get(card.rank) || 0) + 1));
  return [...selected].map(([rank, selectedCount]) => ({ rank, count: selectedCount }));
}

function chooseMerchantTarget(view, playerId) {
  const candidates = view.players.filter((player) => player.id !== playerId && player.handCount > 0);
  return [...candidates].sort((a, b) => {
    const aggressionGap = opponentAggression(view, b.id) - opponentAggression(view, a.id);
    if (aggressionGap) return aggressionGap;
    // When cards are exchanged blindly, taking a chance against the player
    // closest to empty is the only strategically meaningful default.
    return a.handCount - b.handCount || a.roleIndex - b.roleIndex;
  })[0]?.id || null;
}

function decisionRandom(state, playerId, salt = 0) {
  const playerHash = [...String(playerId || '')]
    .reduce((hash, char) => ((hash * 33) ^ char.charCodeAt(0)) >>> 0, 5381);
  let seed = (state.randomSeed + state.stateVersion * 104729 + state.actionSerial * 8191 + playerHash + salt * 131) >>> 0;
  // Consecutive room seeds must not produce nearly identical first draws.
  seed ^= seed >>> 16;
  seed = Math.imul(seed, 0x7feb352d) >>> 0;
  seed ^= seed >>> 15;
  seed = Math.imul(seed, 0x846ca68b) >>> 0;
  seed ^= seed >>> 16;
  return makeSeededRandom(seed >>> 0);
}

function rankBotDecisionOptions(state, playerId) {
  if (state.playPhase !== 'TURN_INPUT' || state.currentTurnPlayerId !== playerId) return [];
  const profile = botProfileFor(state, playerId);
  const view = getBotPerspective(state, playerId);
  const plays = getLegalPlays(state, playerId);
  const naturalLeadExists = state.trick.requiredCount == null && plays.some((play) => play.rank !== 13 && play.jesterCount === 0);
  const candidates = naturalLeadExists ? plays.filter((play) => play.rank !== 13) : plays;
  const ranked = [...candidates]
    .map((play) => ({ play, ...evaluateBotPlay(state, view, playerId, play, profile) }))
    .sort((a, b) => b.score - a.score || b.play.count - a.play.count || b.play.rank - a.play.rank);
  if (state.trick.requiredCount != null) {
    const ownShape = handShape(view.ownHand);
    const bestPlayScore = ranked[0]?.score || 0;
    const nearFinishThreat = view.players.some((player) => player.id !== playerId && player.handCount > 0 && player.handCount <= 3) ? 24 : 0;
    const passScore = bestPlayScore - profile.responseCommitment + ownShape.jokers * profile.jesterReserve * 0.4 - nearFinishThreat - riskNeed(view, playerId) * 20;
    ranked.push({ play: null, score: passScore, controlChance: 0 });
  }
  return ranked.sort((a, b) => b.score - a.score || (b.play?.count || 0) - (a.play?.count || 0));
}

function withSoftmaxProbabilities(candidates, temperature) {
  if (!candidates.length) return [];
  const best = candidates[0].score;
  const weights = candidates.map((candidate) => Math.exp(Math.max(-30, (candidate.score - best) / temperature)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return candidates.map((candidate, index) => ({ ...candidate, probability: weights[index] / total }));
}

function selectCandidate(state, playerId, candidates) {
  const random = decisionRandom(state, playerId, 901);
  let cursor = random();
  for (const candidate of candidates) {
    cursor -= candidate.probability;
    if (cursor <= 0) return candidate;
  }
  return candidates[0];
}

function decisionEntropy(candidates) {
  return candidates.reduce((sum, candidate) => candidate.probability ? sum - candidate.probability * Math.log2(candidate.probability) : sum, 0);
}

export function analyzeBotDecision(state, playerId, profileOverride = null) {
  const profile = BOT_PROFILES[profileOverride] || botProfileFor(state, playerId);
  const view = getBotPerspective(state, playerId);
  let command = null;
  let candidates = [];
  if (state.playPhase === 'REVOLUTION_DECISION' && state.revolutionCandidateId === playerId) {
    const role = state.hierarchy.indexOf(playerId);
    const reversedRole = state.hierarchy.length - 1 - role;
    const positionGain = role - reversedRole;
    const leadersNearFinish = view.players.filter((player) => player.roleIndex < role && player.handCount <= 3).length;
    const wantsRevolution = positionGain > 0
      && (profile !== BOT_PROFILES.DEFENSIVE || positionGain >= 3 || leadersNearFinish > 0);
    command = { type: wantsRevolution ? 'DECLARE_REVOLUTION' : 'DECLINE_REVOLUTION', playerId };
  } else if (state.playPhase === 'TAX_RETURN' && state.tax.currentDalmutiId === playerId) {
    const pair = state.tax.pairs.find((candidate) => candidate.dalmutiId === playerId);
    command = { type: 'SELECT_TAX_RETURN', playerId, selection: chooseTaxReturn(state, playerId, pair.count) };
  } else if (state.playPhase === 'MERCHANT_EXCHANGE' && state.merchantExchange.actorId === playerId) {
    const targetId = chooseMerchantTarget(view, playerId);
    command = { type: 'SELECT_MERCHANT_EXCHANGE_TARGET', playerId, targetId: state.merchantExchange.eligibleTargetIds.includes(targetId) ? targetId : state.merchantExchange.eligibleTargetIds[0] };
  } else if (state.playPhase === 'TURN_INPUT' && state.currentTurnPlayerId === playerId) {
    const rankedCandidates = rankBotDecisionOptions(state, playerId);
    if (!rankedCandidates.length) command = { type: 'PASS', playerId };
    else {
      const finishing = rankedCandidates.find((candidate) => candidate.play && candidate.play.count === view.ownHand.length);
      const urgent = view.trick.requiredCount != null && view.players.some((player) => player.id !== playerId && player.handCount > 0 && player.handCount <= 2)
        ? rankedCandidates.find((candidate) => candidate.play && candidate.controlChance >= 0.7) : null;
      candidates = withSoftmaxProbabilities(rankedCandidates, profile.temperature);
      const selected = finishing || urgent || selectCandidate(state, playerId, candidates);
      command = selected?.play ? { type: 'PLAY_SET', playerId, ...selected.play } : { type: 'PASS', playerId };
    }
  }
  const entropy = decisionEntropy(candidates);
  const forced = candidates.length <= 1 || command?.type !== 'PLAY_SET' || (command.count === view.ownHand.length);
  const legalCount = candidates.length;
  const random = decisionRandom(state, playerId, 1777);
  const deliberationPhase = state.playPhase === 'REVOLUTION_DECISION' || state.playPhase === 'TAX_RETURN' || state.playPhase === 'MERCHANT_EXCHANGE';
  const baseDelay = deliberationPhase ? 760 : (forced ? 250 : 400 + legalCount * 36 + entropy * 170);
  const delayMs = Math.max(250, Math.min(1600, Math.round(baseDelay + (random() - 0.5) * 220)));
  return { command, candidates, entropy, delayMs };
}

export function chooseBotCommand(state, playerId) {
  return analyzeBotDecision(state, playerId).command;
}

export function getBotThinkDelay(state, playerId) {
  return analyzeBotDecision(state, playerId).delayMs;
}

export function chooseTimeoutCommand(state, playerId) {
  if (state.playPhase !== 'TURN_INPUT' || state.currentTurnPlayerId !== playerId) return chooseBotCommand(state, playerId);
  if (state.trick.requiredCount != null) return { type: 'PASS', playerId };
  const hand = state.secrets[playerId].hand;
  const weakest = [...hand].sort((a, b) => b.rank - a.rank)[0];
  return { type: 'PLAY_SET', playerId, rank: weakest.rank, count: 1, jesterCount: weakest.rank === 13 ? 1 : 0 };
}

export function getPrivateView(state, playerId) {
  const pair = state.tax?.pairs.find((candidate) => candidate.dalmutiId === playerId || candidate.peonId === playerId);
  return {
    hand: clone(state.secrets[playerId]?.hand || []),
    tax: pair ? {
      count: pair.count,
      dalmutiId: pair.dalmutiId,
      peonId: pair.peonId,
      offered: pair.dalmutiId === playerId ? clone(pair.offered) : undefined,
      returned: pair.peonId === playerId && pair.returned ? clone(pair.returned) : undefined,
    } : null,
    legalPlays: getLegalPlays(state, playerId),
  };
}

export function createDecisionTrace(state, command, actorKind = 'HUMAN', analysis = null) {
  const hand = state.secrets[command?.playerId]?.hand || [];
  const histogram = Object.fromEntries([...handCounts(hand)].map(([rank, count]) => [rank, count]));
  const legalPlays = getLegalPlays(state, command?.playerId).map(({ rank, count, jesterCount }) => ({ rank, count, jesterCount }));
  return {
    matchKey: state.telemetryMatchKey,
    eventType: 'DECISION', actorKind, roundNumber: state.roundNumber,
    playerCount: state.players.length, roleIndex: state.hierarchy.indexOf(command?.playerId),
    handHistogram: histogram,
    trick: { requiredCount: state.trick.requiredCount, topRank: state.trick.topRank },
    opponentHandCounts: state.players.filter((player) => player.id !== command?.playerId).map((player) => player.handCount),
    legalPlays,
    selected: Object.fromEntries(Object.entries(command || {}).filter(([key]) => key !== 'playerId')),
    candidateDistribution: analysis?.candidates.map((candidate) => ({
      selected: candidate.play ? { type: 'PLAY_SET', ...candidate.play } : { type: 'PASS' },
      probability: candidate.probability,
    })) || [],
  };
}

export function createRoundResultTraces(state) {
  return state.finishOrder.map((playerId, index) => {
    const player = state.players.find((candidate) => candidate.id === playerId);
    return {
    matchKey: state.telemetryMatchKey, eventType: 'ROUND_RESULT', roundNumber: state.roundNumber,
    playerCount: state.players.length, roleIndex: state.hierarchy.indexOf(playerId), actorKind: player?.isBot ? 'BOT' : 'HUMAN',
    finishPosition: index + 1,
    };
  });
}

export function getPublicView(state) {
  const players = state.players.map(({ botProfile, ...player }) => player);
  return {
    gameType: state.gameType, matchState: state.matchState, playPhase: state.playPhase,
    roundNumber: state.roundNumber, config: clone(state.config), players: clone(players),
    hierarchy: [...state.hierarchy], initialSeatOrder: state.roundNumber <= 1 ? clone(state.initialSeatOrder) : [],
    currentTurnPlayerId: state.currentTurnPlayerId, turnStartedAt: state.turnStartedAt,
    turnExpiresAt: state.turnExpiresAt, trick: clone(state.trick), finishOrder: [...state.finishOrder],
    revolutionCandidateId: state.revolutionCandidateId,
    tax: state.tax ? { currentDalmutiId: state.tax.currentDalmutiId, pairs: state.tax.pairs.map(({ dalmutiId, peonId, count, returned }) => ({ dalmutiId, peonId, count, complete: !!returned })) } : null,
    merchantExchange: state.merchantExchange ? clone(state.merchantExchange) : null,
    lastAction: clone(state.lastAction), outcome: clone(state.outcome), stateVersion: state.stateVersion,
  };
}
