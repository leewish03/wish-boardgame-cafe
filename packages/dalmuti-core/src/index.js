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
      botProfile: player.isBot ? ['CAUTIOUS', 'BALANCED', 'AGGRESSIVE'][players.filter((candidate) => candidate.isBot).findIndex((candidate) => candidate.id === player.id) % 3] : null,
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
    // This is deliberately a public-action journal, not a second copy of
    // hidden hands.  Bots consume a profile-limited tail of it as memory.
    botMemory: { publicEvents: [] },
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
  state.botMemory = { publicEvents: [] };
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

function recordPublicBotEvent(state, event) {
  if (!event?.id || !event?.type) return;
  const journal = state.botMemory || (state.botMemory = { publicEvents: [] });
  if (journal.publicEvents.some((entry) => entry.id === event.id)) return;
  const entry = {
    id: event.id,
    type: event.type,
    actorId: event.actorId || null,
    targetId: event.targetId || null,
    rank: event.rank ?? null,
    count: event.count ?? null,
    jesterCount: event.jesterCount ?? 0,
    roundNumber: state.roundNumber,
    serial: state.actionSerial,
  };
  journal.publicEvents.push(entry);
  // Keep enough history for the best-memory profile without making room
  // persistence grow for a long-running match.
  if (journal.publicEvents.length > 96) journal.publicEvents.splice(0, journal.publicEvents.length - 96);
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
  const hand = state.secrets[command.playerId].hand;
  const natural = play.rank === 13 ? [] : hand.filter((card) => card.rank === play.rank).slice(0, play.count - play.jesterCount);
  const jesters = hand.filter((card) => card.rank === 13).slice(0, play.jesterCount);
  const cards = [...natural, ...jesters];
  const cardIds = new Set(cards.map((card) => card.id));
  state.secrets[command.playerId].hand = hand.filter((card) => !cardIds.has(card.id));
  state.actionSerial += 1;
  const set = { id: makeId('set', state), actorId: command.playerId, rank: play.rank, count: play.count, jesterCount: play.jesterCount, cards };
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
  if (!state.trick.passPlayerIds.includes(command.playerId)) state.trick.passPlayerIds.push(command.playerId);
  state.actionSerial += 1;
  state.lastAction = { id: makeId('pass', state), type: 'PASSED', actorId: command.playerId, timestamp: Date.now() };
  const requiredPassers = activeIds(state).filter((id) => id !== state.trick.lastPlayerId);
  if (requiredPassers.every((id) => state.trick.passPlayerIds.includes(id))) {
    const leader = activeIds(state).includes(state.trick.lastPlayerId) ? state.trick.lastPlayerId : nextActive(state, state.trick.lastPlayerId);
    state.discardedCards.push(...state.trick.sets.flatMap((set) => set.cards || []));
    state.trick = { requiredCount: null, topRank: null, lastPlayerId: null, passPlayerIds: [], sets: [], completedCount: state.trick.completedCount + 1 };
    state.lastAction = { id: makeId('clear', state), type: 'TRICK_CLEARED', actorId: leader, timestamp: Date.now() };
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
  CAUTIOUS: {
    memoryLimit: 16, shedWeight: 7, finishBonus: 950, jesterPenalty: 46,
    leadControlWeight: 52, chainWeight: 7, responseThreshold: 24, blockNearFinish: 25,
    gambleChance: 0.12, nearBestMargin: 14, gambleTemperature: 8, controlTolerance: 0.07,
  },
  BALANCED: {
    memoryLimit: 32, shedWeight: 10, finishBonus: 1200, jesterPenalty: 30,
    leadControlWeight: 66, chainWeight: 10, responseThreshold: 7, blockNearFinish: 38,
    gambleChance: 0.25, nearBestMargin: 28, gambleTemperature: 16, controlTolerance: 0.11,
  },
  AGGRESSIVE: {
    memoryLimit: 48, shedWeight: 13, finishBonus: 1500, jesterPenalty: 18,
    leadControlWeight: 82, chainWeight: 13, responseThreshold: -6, blockNearFinish: 58,
    gambleChance: 0.38, nearBestMargin: 46, gambleTemperature: 24, controlTolerance: 0.16,
  },
});

const BOT_PROFILE_NAMES = Object.freeze(['CAUTIOUS', 'BALANCED', 'AGGRESSIVE']);

function stableBotProfileIndex(playerId) {
  return [...String(playerId || '')].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 17) % BOT_PROFILE_NAMES.length;
}

export function assignBotProfile(state, playerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return null;
  player.isBot = true;
  if (!BOT_PROFILES[player.botProfile]) player.botProfile = BOT_PROFILE_NAMES[stableBotProfileIndex(playerId)];
  return player.botProfile;
}

function botProfileFor(state, playerId) {
  const profileName = state.players.find((player) => player.id === playerId)?.botProfile || 'BALANCED';
  return BOT_PROFILES[profileName] || BOT_PROFILES.BALANCED;
}

function handCounts(hand) {
  return hand.reduce((counts, card) => counts.set(card.rank, (counts.get(card.rank) || 0) + 1), new Map());
}

function publicHandCount(state, playerId) {
  return state.players.find((player) => player.id === playerId)?.handCount || 0;
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

function withoutPlayedCards(hand, play) {
  let natural = play.rank === 13 ? 0 : play.count - play.jesterCount;
  let jokers = play.jesterCount;
  return hand.filter((card) => {
    if (card.rank === 13 && jokers > 0) { jokers -= 1; return false; }
    if (card.rank === play.rank && natural > 0) { natural -= 1; return false; }
    return true;
  });
}

function chanceAtLeast(draws, successes, population, needed) {
  if (needed <= 0) return 1;
  if (draws < needed || successes < needed || population <= 0) return 0;
  // Small deck sizes make this stable sequential dynamic programming clearer
  // than factorial-based hypergeometric arithmetic.
  const maxDraws = Math.min(draws, population);
  let distribution = [1];
  for (let draw = 0; draw < maxDraws; draw += 1) {
    const next = Array(draw + 2).fill(0);
    const remainingPopulation = population - draw;
    for (let found = 0; found < distribution.length; found += 1) {
      const probability = distribution[found] || 0;
      const remainingSuccesses = Math.max(0, successes - found);
      next[found + 1] += probability * (remainingSuccesses / remainingPopulation);
      next[found] += probability * Math.max(0, (remainingPopulation - remainingSuccesses) / remainingPopulation);
    }
    distribution = next;
  }
  return distribution.reduce((sum, probability, found) => sum + (found >= needed ? probability : 0), 0);
}

function playerAggression(events, playerId) {
  const ownEvents = events.filter((event) => event.actorId === playerId && event.type === 'SET_PLAYED');
  if (!ownEvents.length) return 0.5;
  const multiRate = ownEvents.filter((event) => event.count >= 2).length / ownEvents.length;
  const averageRank = ownEvents.reduce((sum, event) => sum + Number(event.rank || 13), 0) / ownEvents.length;
  // High-number early dumps and multi-card pressure both indicate a player
  // more likely to contest a weak lead.
  return Math.max(0.15, Math.min(1, 0.35 + multiRate * 0.4 + averageRank / 40));
}

function chanceOpponentBeats(view, playerId, play) {
  if (play.rank <= 1) return 0;
  const active = view.players.filter((player) => player.id !== playerId && player.handCount > 0);
  const required = play.count;
  let nobodyCanBeat = 1;
  for (const opponent of active) {
    const draws = opponent.handCount;
    let anyRankCanBeat = 0;
    for (let rank = 1; rank < play.rank; rank += 1) {
      const rankCount = view.unknownCounts.get(rank) || 0;
      const chance = chanceAtLeast(draws, rankCount, view.unknownCardTotal, required);
      // Approximate a union of mutually competing same-rank groups.
      anyRankCanBeat = 1 - (1 - anyRankCanBeat) * (1 - chance);
    }
    const tendency = playerAggression(view.memory, opponent.id);
    const adjusted = Math.min(0.98, anyRankCanBeat * (0.65 + tendency * 0.5));
    nobodyCanBeat *= 1 - adjusted;
  }
  return 1 - nobodyCanBeat;
}

function forecastLeadRun(view, playerId, hand, depth = 2) {
  if (depth <= 0 || !hand.length) return 0;
  const counts = handCounts(hand);
  const groups = [...counts.entries()]
    .filter(([rank]) => rank !== 13)
    .flatMap(([rank, count]) => count > 1
      ? [{ rank, count }, { rank, count: 1 }]
      : [{ rank, count }])
    .sort((a, b) => (b.count * 12 + b.rank) - (a.count * 12 + a.rank))
    .slice(0, 4);
  if (!groups.length) return hand.filter((card) => card.rank === 13).length * 2;
  // This is a bounded two-lead expectimax-style plan. It does not invent opponent
  // cards: each future lead is weighted by the probability that public card
  // counts say the table cannot overtake it. The depth cap keeps a bot turn
  // inexpensive even with a large hand.
  return Math.max(...groups.map((group) => {
    const virtualPlay = { ...group, jesterCount: 0 };
    const holdLeadChance = 1 - chanceOpponentBeats(view, playerId, virtualPlay);
    const after = withoutPlayedCards(hand, virtualPlay);
    const immediateDump = group.count * 14 + group.rank * 1.5;
    return immediateDump + holdLeadChance * forecastLeadRun(view, playerId, after, depth - 1);
  }));
}

export function getBotPerspective(state, playerId) {
  const profile = botProfileFor(state, playerId);
  const memory = (state.botMemory?.publicEvents || []).slice(-profile.memoryLimit);
  const ownHand = clone(state.secrets[playerId]?.hand || []);
  const deckCounts = handCounts(createDeck(state.config, state.players.length));
  const seenCounts = observationCounts(memory);
  const unknownCounts = subtractCounts(subtractCounts(deckCounts, ownHand), [...seenCounts.entries()]
    .flatMap(([rank, count]) => Array.from({ length: count }, () => ({ rank }))));
  const unknownCardTotal = [...unknownCounts.values()].reduce((sum, count) => sum + count, 0);
  return {
    playerId,
    profile,
    ownHand,
    players: state.players.map((player) => ({ id: player.id, handCount: player.handCount, roleIndex: player.roleIndex, score: player.score })),
    hierarchy: [...state.hierarchy],
    trick: { requiredCount: state.trick.requiredCount, topRank: state.trick.topRank, lastPlayerId: state.trick.lastPlayerId, passPlayerIds: [...state.trick.passPlayerIds] },
    finishOrder: [...state.finishOrder],
    memory: clone(memory),
    unknownCounts,
    unknownCardTotal,
  };
}

function evaluateBotPlay(view, playerId, play, profile) {
  const hand = view.ownHand;
  const counts = handCounts(hand);
  const naturalCount = play.rank === 13 ? 0 : play.count - play.jesterCount;
  const remaining = hand.length - play.count;
  const isLead = view.trick.requiredCount == null;
  const rankDiscardValue = play.rank === 13 ? -18 : play.rank * 4;
  const clearsNaturalGroup = naturalCount > 0 && naturalCount === counts.get(play.rank);
  const jesterOnly = play.rank === 13;
  const remainingHand = withoutPlayedCards(hand, play);
  const opponentThreat = chanceOpponentBeats(view, playerId, play);
  const leadChance = 1 - opponentThreat;
  const nearFinishers = view.players.filter((player) => player.id !== playerId && player.handCount > 0 && player.handCount <= 3).length;
  let score = rankDiscardValue + play.count * profile.shedWeight;
  if (clearsNaturalGroup) score += 22;
  if (remaining === 0) score += profile.finishBonus;
  score += leadChance * profile.leadControlWeight;
  score += leadChance * forecastLeadRun(view, playerId, remainingHand) * (profile.chainWeight / 10);
  if (isLead) score += (play.count - 1) * profile.chainWeight;
  // Low ranks and Jesters make future control/escape combinations. Spend
  // them only when the current set materially improves the hand.
  if (play.rank <= 3) score -= (4 - play.rank) * 13;
  score -= play.jesterCount * profile.jesterPenalty;
  if (jesterOnly && remaining > 0) score -= 120;
  if (!isLead) {
    const pressure = Math.max(0, view.trick.topRank - play.rank) * 8;
    score += pressure + nearFinishers * profile.blockNearFinish;
    // A risky response that is unlikely to survive the circuit is usually a
    // waste of a control card; aggressive bots tolerate that risk more.
    score -= opponentThreat * (profile === BOT_PROFILES.CAUTIOUS ? 36 : profile === BOT_PROFILES.BALANCED ? 20 : 8);
  }
  return { score, controlChance: leadChance };
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
    const aggressionGap = playerAggression(view.memory, b.id) - playerAggression(view.memory, a.id);
    if (aggressionGap) return aggressionGap;
    // When cards are exchanged blindly, taking a chance against the player
    // closest to empty is the only strategically meaningful default.
    return a.handCount - b.handCount || a.roleIndex - b.roleIndex;
  })[0]?.id || null;
}

function decisionRandom(state, playerId) {
  const playerHash = [...String(playerId || '')]
    .reduce((hash, char) => ((hash * 33) ^ char.charCodeAt(0)) >>> 0, 5381);
  let seed = (state.randomSeed + state.stateVersion * 104729 + state.actionSerial * 8191 + playerHash) >>> 0;
  // Consecutive room seeds must not produce nearly identical first draws.
  seed ^= seed >>> 16;
  seed = Math.imul(seed, 0x7feb352d) >>> 0;
  seed ^= seed >>> 15;
  seed = Math.imul(seed, 0x846ca68b) >>> 0;
  seed ^= seed >>> 16;
  return makeSeededRandom(seed >>> 0);
}

function chooseHumanLikeCandidate(state, view, playerId, rankedCandidates, profile) {
  const best = rankedCandidates[0];
  if (!best || rankedCandidates.length < 2) return best;
  // Finishing and urgent blocking are tactical facts, not gambling moments.
  const isFinishing = best.play.count === view.ownHand.length;
  const urgentBlock = view.trick.requiredCount != null
    && view.players.some((player) => player.id !== playerId && player.handCount > 0 && player.handCount <= 2);
  if (isFinishing || urgentBlock) return best;
  const nearBest = rankedCandidates.filter((candidate) => {
    const scoreGap = best.score - candidate.score;
    const similarlyContested = Math.abs(best.controlChance - candidate.controlChance) <= profile.controlTolerance;
    return scoreGap <= profile.nearBestMargin
      || (similarlyContested && scoreGap <= profile.nearBestMargin * 2);
  });
  if (nearBest.length < 2) return best;
  const random = decisionRandom(state, playerId);
  if (random() >= profile.gambleChance) return best;
  const weights = nearBest.map((candidate) => Math.exp((candidate.score - best.score) / profile.gambleTemperature));
  const target = random() * weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = 0;
  for (let index = 0; index < nearBest.length; index += 1) {
    cursor += weights[index];
    if (target <= cursor) return nearBest[index];
  }
  return best;
}

function rankBotDecisionOptions(state, playerId) {
  if (state.playPhase !== 'TURN_INPUT' || state.currentTurnPlayerId !== playerId) return [];
  const profile = botProfileFor(state, playerId);
  const view = getBotPerspective(state, playerId);
  const plays = getLegalPlays(state, playerId);
  const naturalLeadExists = state.trick.requiredCount == null && plays.some((play) => play.rank !== 13 && play.jesterCount === 0);
  const candidates = naturalLeadExists ? plays.filter((play) => play.rank !== 13) : plays;
  return [...candidates]
    .map((play) => ({ play, ...evaluateBotPlay(view, playerId, play, profile) }))
    .sort((a, b) => b.score - a.score || b.play.count - a.play.count || b.play.rank - a.play.rank);
}

export function chooseBotCommand(state, playerId) {
  const profile = botProfileFor(state, playerId);
  const view = getBotPerspective(state, playerId);
  if (state.playPhase === 'REVOLUTION_DECISION' && state.revolutionCandidateId === playerId) {
    const role = state.hierarchy.indexOf(playerId);
    const reversedRole = state.hierarchy.length - 1 - role;
    const positionGain = role - reversedRole;
    const leadersNearFinish = view.players.filter((player) => player.roleIndex < role && player.handCount <= 3).length;
    const wantsRevolution = positionGain > 0
      && (profile !== BOT_PROFILES.CAUTIOUS || positionGain >= 3 || leadersNearFinish > 0);
    return { type: wantsRevolution ? 'DECLARE_REVOLUTION' : 'DECLINE_REVOLUTION', playerId };
  }
  if (state.playPhase === 'TAX_RETURN' && state.tax.currentDalmutiId === playerId) {
    const pair = state.tax.pairs.find((candidate) => candidate.dalmutiId === playerId);
    return { type: 'SELECT_TAX_RETURN', playerId, selection: chooseTaxReturn(state, playerId, pair.count) };
  }
  if (state.playPhase === 'MERCHANT_EXCHANGE' && state.merchantExchange.actorId === playerId) {
    const targetId = chooseMerchantTarget(view, playerId);
    return { type: 'SELECT_MERCHANT_EXCHANGE_TARGET', playerId, targetId: state.merchantExchange.eligibleTargetIds.includes(targetId) ? targetId : state.merchantExchange.eligibleTargetIds[0] };
  }
  if (state.playPhase === 'TURN_INPUT' && state.currentTurnPlayerId === playerId) {
    const rankedCandidates = rankBotDecisionOptions(state, playerId);
    if (!rankedCandidates.length) return { type: 'PASS', playerId };
    const selected = chooseHumanLikeCandidate(state, view, playerId, rankedCandidates, profile);
    if (state.trick.requiredCount != null && selected.score < profile.responseThreshold) return { type: 'PASS', playerId };
    return { type: 'PLAY_SET', playerId, ...selected.play };
  }
  return null;
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

export function getPublicView(state) {
  return {
    gameType: state.gameType, matchState: state.matchState, playPhase: state.playPhase,
    roundNumber: state.roundNumber, config: clone(state.config), players: clone(state.players),
    hierarchy: [...state.hierarchy], initialSeatOrder: state.roundNumber <= 1 ? clone(state.initialSeatOrder) : [],
    currentTurnPlayerId: state.currentTurnPlayerId, turnStartedAt: state.turnStartedAt,
    turnExpiresAt: state.turnExpiresAt, trick: clone(state.trick), finishOrder: [...state.finishOrder],
    revolutionCandidateId: state.revolutionCandidateId,
    tax: state.tax ? { currentDalmutiId: state.tax.currentDalmutiId, pairs: state.tax.pairs.map(({ dalmutiId, peonId, count, returned }) => ({ dalmutiId, peonId, count, complete: !!returned })) } : null,
    merchantExchange: state.merchantExchange ? clone(state.merchantExchange) : null,
    lastAction: clone(state.lastAction), outcome: clone(state.outcome), stateVersion: state.stateVersion,
  };
}
