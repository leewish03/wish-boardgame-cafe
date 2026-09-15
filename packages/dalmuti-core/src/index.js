export const DALMUTI_RANKS = Object.freeze({
  1: '대달무티', 2: '대주교', 3: '시종장', 4: '남작부인', 5: '수녀원장',
  6: '기사', 7: '재봉사', 8: '석공', 9: '요리사', 10: '양치기',
  11: '광부', 12: '농노', 13: '어릿광대',
});

export const ROLE_NAMES = Object.freeze([
  '대달무티', '소달무티', '상인', '상인', '상인', '상인', '소농노', '대농노',
]);

export const DEFAULT_CONFIG = Object.freeze({
  roundCount: 10,
  maxPlayers: 8,
  turnTimeoutSeconds: 30,
  firstDealRevolution: true,
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
  if (index === 0) return '대달무티';
  if (index === 1) return '소달무티';
  if (index === count - 2) return '소농노';
  if (index === count - 1) return '대농노';
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

function drawInitialHierarchy(players, random) {
  const drawLog = [];
  const resolveGroup = (playerIds) => {
    const groups = new Map();
    for (const id of playerIds) {
      const drawn = 1 + Math.floor(random() * 13);
      drawLog.push({ playerId: id, rank: drawn });
      if (!groups.has(drawn)) groups.set(drawn, []);
      groups.get(drawn).push(id);
    }
    return [...groups.entries()]
      .sort(([rankA], [rankB]) => rankA - rankB)
      .flatMap(([, ids]) => (ids.length === 1 ? ids : resolveGroup(ids)));
  };
  return {
    hierarchy: resolveGroup(players.map((player) => player.id)),
    draws: drawLog,
  };
}

export function createInitialState(players, partialConfig = {}, seed = Date.now()) {
  if (!Array.isArray(players) || players.length < 4 || players.length > 8) {
    throw new Error('달무티는 4명부터 8명까지 플레이할 수 있습니다.');
  }
  const config = { ...DEFAULT_CONFIG, ...partialConfig };
  const random = makeSeededRandom(seed);
  const rankDraw = drawInitialHierarchy(players, random);
  const state = {
    gameType: 'DALMUTI',
    matchState: 'LOBBY',
    playPhase: 'LOBBY',
    roundNumber: 0,
    config,
    players: players.map((player) => ({
      id: player.id, nickname: player.nickname, avatarUrl: player.avatarUrl || player.avatar,
      isHost: !!player.isHost, isBot: !!player.isBot, score: 0, roleIndex: 0,
      role: '상인', handCount: 0, finishedPosition: null, passed: false,
    })),
    secrets: Object.fromEntries(players.map((player) => [player.id, { hand: [] }])),
    hierarchy: rankDraw.hierarchy,
    rankDraw: rankDraw.draws,
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
    pair.offered = [...hand].sort((a, b) => a.rank - b.rank).slice(0, pair.count);
    pair.returned = null;
    const offeredIds = new Set(pair.offered.map((card) => card.id));
    state.secrets[pair.peonId].hand = hand.filter((card) => !offeredIds.has(card.id));
  }
  state.tax = { pairs, currentDalmutiId: pairs[0].dalmutiId };
  state.playPhase = 'TAX_RETURN';
  setTurn(state, pairs[0].dalmutiId);
}

function beginRound(state) {
  state.roundNumber += 1;
  state.matchState = 'PLAYING';
  state.playPhase = 'DEALING';
  state.finishOrder = [];
  state.outcome = null;
  state.trick = { requiredCount: null, topRank: null, lastPlayerId: null, passPlayerIds: [], sets: [], completedCount: 0 };
  state.discardedCards = [];
  state.players.forEach((player) => { player.finishedPosition = null; player.passed = false; });
  const random = randomForState(state);
  const deck = shuffle(createDeck(state.config, state.players.length), random);
  Object.values(state.secrets).forEach((secret) => { secret.hand = []; });
  deck.forEach((card, index) => {
    const id = state.hierarchy[index % state.hierarchy.length];
    state.secrets[id].hand.push(card);
  });
  Object.values(state.secrets).forEach((secret) => secret.hand.sort((a, b) => a.rank - b.rank));
  const revolution = state.hierarchy.find((id) => state.secrets[id].hand.filter((card) => card.rank === 13).length === 2) || null;
  state.revolutionCandidateId = revolution;
  state.lastAction = { id: makeId('deal', state), type: 'ROUND_DEALT', roundNumber: state.roundNumber, timestamp: Date.now() };

  if (state.roundNumber === 1 && state.config.firstDealRevolution) {
    if (revolution === state.hierarchy[state.hierarchy.length - 1]) {
      state.playPhase = 'REVOLUTION_DECISION';
      setTurn(state, revolution);
    } else {
      startTurnPlay(state, state.hierarchy[0], 'FIRST_DEAL_REVOLUTION');
    }
  } else if (revolution) {
    state.playPhase = 'REVOLUTION_DECISION';
    setTurn(state, revolution);
  } else {
    setupTax(state);
  }
  refreshPlayers(state);
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
  refreshPlayers(state);
  return { nextState: state, events: state.lastAction && state.lastAction.id !== previousActionId ? [state.lastAction] : [] };
}

export function chooseBotCommand(state, playerId) {
  if (state.playPhase === 'REVOLUTION_DECISION' && state.revolutionCandidateId === playerId) {
    const role = state.hierarchy.indexOf(playerId);
    return { type: role <= 1 ? 'DECLINE_REVOLUTION' : 'DECLARE_REVOLUTION', playerId };
  }
  if (state.playPhase === 'TAX_RETURN' && state.tax.currentDalmutiId === playerId) {
    const pair = state.tax.pairs.find((candidate) => candidate.dalmutiId === playerId);
    const cards = [...state.secrets[playerId].hand].sort((a, b) => b.rank - a.rank).slice(0, pair.count);
    const counts = new Map(); cards.forEach((card) => counts.set(card.rank, (counts.get(card.rank) || 0) + 1));
    return { type: 'SELECT_TAX_RETURN', playerId, selection: [...counts].map(([rank, count]) => ({ rank, count })) };
  }
  if (state.playPhase === 'MERCHANT_EXCHANGE' && state.merchantExchange.actorId === playerId) {
    return { type: 'SELECT_MERCHANT_EXCHANGE_TARGET', playerId, targetId: state.merchantExchange.eligibleTargetIds[0] };
  }
  if (state.playPhase === 'TURN_INPUT' && state.currentTurnPlayerId === playerId) {
    const plays = getLegalPlays(state, playerId);
    if (!plays.length) return { type: 'PASS', playerId };
    // Jesters are a useful escape valve, not an automatic opening. A bot only
    // leads with one when it has no natural-card option at all.
    const naturalPlays = plays.filter((play) => play.rank !== 13 && play.jesterCount === 0);
    const candidates = naturalPlays.length ? naturalPlays : plays;
    const selected = [...candidates].sort((a, b) =>
      b.rank - a.rank
      || (state.trick.requiredCount == null ? a.count - b.count : 0)
      || a.jesterCount - b.jesterCount,
    )[0];
    return { type: 'PLAY_SET', playerId, ...selected };
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
    hierarchy: [...state.hierarchy], rankDraw: state.roundNumber <= 1 ? clone(state.rankDraw) : [],
    currentTurnPlayerId: state.currentTurnPlayerId, turnStartedAt: state.turnStartedAt,
    turnExpiresAt: state.turnExpiresAt, trick: clone(state.trick), finishOrder: [...state.finishOrder],
    revolutionCandidateId: state.revolutionCandidateId,
    tax: state.tax ? { currentDalmutiId: state.tax.currentDalmutiId, pairs: state.tax.pairs.map(({ dalmutiId, peonId, count, returned }) => ({ dalmutiId, peonId, count, complete: !!returned })) } : null,
    merchantExchange: state.merchantExchange ? clone(state.merchantExchange) : null,
    lastAction: clone(state.lastAction), outcome: clone(state.outcome), stateVersion: state.stateVersion,
  };
}
