import { createHmac } from 'node:crypto';
import { rowPoints } from './cards.js';
export { bullheads, rowPoints } from './cards.js';
export const gameType = 'SIX_NIMMT';
export const minPlayers = 2;
export const maxPlayers = 10;
export const allowedCommands = ['START_MATCH', 'ADVANCE_ROUND', 'SELECT_CARD', 'CHOOSE_ROW'];

export function nearestRow(rows, card) {
  let selected = -1;
  for (let i = 0; i < rows.length; i++) {
    const end = rows[i].at(-1);
    if (end < card && (selected < 0 || end > rows[selected].at(-1))) selected = i;
  }
  return selected;
}
export function seededRandom(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = Math.imul(value ^ value >>> 15, 1 | value);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function fail(message) { throw new Error(message); }
export function createInitialState(players, config = {}, seed = 1) {
  if (!Array.isArray(players) || players.length < minPlayers || players.length > maxPlayers) fail('2~10명이 필요합니다.');
  if (players.some(p => typeof p.id !== 'string' || !p.id) || new Set(players.map(p => p.id)).size !== players.length) fail('플레이어 정보가 올바르지 않습니다.');
  if (players.filter(p => p.isHost).length !== 1) fail('방장은 한 명이어야 합니다.');
  return {
    gameType, matchState: 'LOBBY', playPhase: 'LOBBY', roundNumber: 0, turnNumber: 0, stateVersion: 0, selectionVersion: 0,
    players: players.map(p => ({ id: p.id, nickname: p.nickname || p.id, isHost: !!p.isHost, isBot: !!p.isBot, score: 0, roundScore: 0 })),
    config: { targetScore: 66 }, outcome: null, seed: String(seed),
    hands: {}, selections: {}, rows: [], queue: [], taken: {}, unused: [], seenCards: [], pendingRowPlayerId: null,
  };
}
function deal(state, events) {
  state.roundNumber++;
  let counter = 0;
  const deck = Array.from({ length: 104 }, (_, i) => i + 1);
  for (let i = deck.length - 1; i > 0; i--) {
    const bound = i + 1, limit = Math.floor(4294967296 / bound) * bound;
    let sample;
    do {
      sample = createHmac('sha256', String(state.seed)).update(`six-nimmt:${state.roundNumber}:${counter++}`).digest().readUInt32BE(0);
    } while (sample >= limit);
    const j = sample % bound;
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  for (const p of state.players) {
    state.hands[p.id] = deck.splice(0, 10).sort((a, b) => a - b);
    state.taken[p.id] = [];
    p.roundScore = 0;
  }
  state.rows = deck.splice(0, 4).map(card => [card]);
  state.unused = deck;
  state.seenCards = state.rows.flat();
  state.selections = {};
  state.queue = [];
  state.pendingRowPlayerId = null;
  state.turnNumber = 1;
  state.matchState = 'PLAYING';
  state.playPhase = 'SELECTING';
  state.selectionVersion = state.stateVersion + 1;
  events.push({ type: 'ROUND_STARTED', roundNumber: state.roundNumber, rows: structuredClone(state.rows) });
}
function finishPlacement(state, events) {
  state.queue.shift();
  state.pendingRowPlayerId = null;
  state.playPhase = 'RESOLVING';
  if (state.queue.length) return;
  state.selections = {};
  if (state.turnNumber < 10) {
    state.turnNumber++;
    state.playPhase = 'SELECTING';
    state.selectionVersion = state.stateVersion + 1;
    events.push({ type: 'TURN_STARTED', turnNumber: state.turnNumber });
    return;
  }
  state.matchState = 'ROUND_END';
  state.playPhase = 'ROUND_END';
  events.push({ type: 'ROUND_ENDED', scores: state.players.map(p => ({ playerId: p.id, score: p.score, roundScore: p.roundScore })) });
  if (state.players.some(p => p.score >= 66)) {
    const minimum = Math.min(...state.players.map(p => p.score));
    state.outcome = { winnerIds: state.players.filter(p => p.score === minimum).map(p => p.id), scores: state.players.map(p => ({ playerId: p.id, score: p.score })) };
    state.matchState = 'GAME_OVER';
    state.playPhase = 'GAME_OVER';
    events.push({ type: 'GAME_ENDED', ...structuredClone(state.outcome) });
  }
}
function place(state, rowIndex, take, events) {
  const { playerId, card } = state.queue[0];
  if (take) {
    const cards = state.rows[rowIndex];
    const points = rowPoints(cards);
    state.taken[playerId].push(...cards);
    const player = state.players.find(p => p.id === playerId);
    player.score += points;
    player.roundScore += points;
    state.rows[rowIndex] = [card];
    events.push({ type: 'ROW_TAKEN', playerId, card, rowIndex, cards: [...cards], points });
  } else {
    state.rows[rowIndex].push(card);
    events.push({ type: 'CARD_PLACED', playerId, card, rowIndex, position: state.rows[rowIndex].length - 1 });
  }
  finishPlacement(state, events);
}
export function executeCommand(state, command) {
  if (!command || typeof command.type !== 'string') fail('명령이 올바르지 않습니다.');
  if (command.expectedVersion !== undefined) {
    const currentSelection = command.type === 'SELECT_CARD' && state.playPhase === 'SELECTING'
      && Number.isInteger(command.expectedVersion) && command.expectedVersion >= state.selectionVersion
      && command.expectedVersion <= state.stateVersion;
    if (!currentSelection && command.expectedVersion !== state.stateVersion) fail('지난 상태의 요청입니다.');
  }
  const playerId = command.playerId ?? command.actorId;
  const player = state.players.find(p => p.id === playerId);
  if (command.type !== 'STEP_RESOLVE' && !player) fail('참가자만 행동할 수 있습니다.');
  const nextState = structuredClone(state);
  const events = [];
  switch (command.type) {
    case 'START_MATCH':
    case 'ADVANCE_ROUND': {
      if (!player.isHost) fail('방장만 시작할 수 있습니다.');
      const required = command.type === 'START_MATCH' ? 'LOBBY' : 'ROUND_END';
      if (state.matchState !== required) fail('지금은 라운드를 시작할 수 없습니다.');
      deal(nextState, events);
      break;
    }
    case 'SELECT_CARD': {
      if (state.playPhase !== 'SELECTING' || state.matchState !== 'PLAYING') fail('카드를 선택할 시간이 아닙니다.');
      if (state.selections[playerId] !== undefined) fail('이미 카드를 선택했습니다.');
      if (!Number.isInteger(command.card) || !state.hands[playerId].includes(command.card)) fail('손에 있는 카드를 선택하세요.');
      nextState.selections[playerId] = command.card;
      nextState.hands[playerId] = nextState.hands[playerId].filter(card => card !== command.card);
      events.push({ type: 'CARD_COMMITTED', playerId });
      if (Object.keys(nextState.selections).length === state.players.length) {
        nextState.queue = state.players.map(p => ({ playerId: p.id, card: nextState.selections[p.id] })).sort((a, b) => a.card - b.card);
        nextState.seenCards.push(...nextState.queue.map(item => item.card));
        nextState.playPhase = 'RESOLVING';
        events.push({ type: 'CARDS_REVEALED', cards: structuredClone(nextState.queue) });
      }
      break;
    }
    case 'STEP_RESOLVE': {
      if (state.playPhase !== 'RESOLVING' || !state.queue.length) fail('해결할 카드가 없습니다.');
      const current = state.queue[0];
      const rowIndex = nearestRow(state.rows, current.card);
      if (rowIndex < 0) {
        nextState.playPhase = 'CHOOSING_ROW';
        nextState.pendingRowPlayerId = current.playerId;
        events.push({ type: 'ROW_CHOICE_REQUIRED', ...current });
      } else place(nextState, rowIndex, state.rows[rowIndex].length === 5, events);
      break;
    }
    case 'CHOOSE_ROW': {
      if (state.playPhase !== 'CHOOSING_ROW' || state.pendingRowPlayerId !== playerId) fail('지금은 줄을 선택할 수 없습니다.');
      if (!Number.isInteger(command.rowIndex) || command.rowIndex < 0 || command.rowIndex > 3) fail('올바른 줄을 선택하세요.');
      place(nextState, command.rowIndex, true, events);
      break;
    }
    default: fail('지원하지 않는 명령입니다.');
  }
  nextState.stateVersion++;
  for (const event of events) if (event.playerId) event.actorId = event.playerId;
  return { nextState, events };
}
export function getAutomaticCommand(state) {
  return state.playPhase === 'RESOLVING' && state.queue.length ? { type: 'STEP_RESOLVE', expectedVersion: state.stateVersion } : null;
}
export function getPendingActors(state) {
  if (state.playPhase === 'SELECTING') return state.players.filter(p => state.selections[p.id] === undefined).map(p => p.id);
  if (state.playPhase === 'CHOOSING_ROW') return [state.pendingRowPlayerId];
  if (state.matchState === 'LOBBY' || state.matchState === 'ROUND_END') return state.players.filter(p => p.isHost).map(p => p.id);
  return [];
}
export function getPublicView(state) {
  return structuredClone({
    gameType, matchState: state.matchState, playPhase: state.playPhase, roundNumber: state.roundNumber,
    turnNumber: state.turnNumber, stateVersion: state.stateVersion, selectionVersion: state.selectionVersion, config: state.config, outcome: state.outcome,
    players: state.players.map(p => ({ ...p, handCount: state.hands[p.id]?.length || 0, selected: state.selections[p.id] !== undefined })),
    rows: state.rows, queue: state.queue, pendingRowPlayerId: state.pendingRowPlayerId, seenCards: state.seenCards,
  });
}
export function getPrivateView(state, playerId) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return { hand: [], selectedCard: null, legalActions: [] };
  const hand = [...(state.hands[playerId] || [])];
  const legalActions = [];
  if (getPendingActors(state).includes(playerId)) {
    if (state.matchState === 'LOBBY') legalActions.push({ type: 'START_MATCH' });
    else if (state.matchState === 'ROUND_END') legalActions.push({ type: 'ADVANCE_ROUND' });
    else if (state.playPhase === 'SELECTING') legalActions.push(...hand.map(card => ({ type: 'SELECT_CARD', card })));
    else if (state.playPhase === 'CHOOSING_ROW') legalActions.push(...state.rows.map((_, rowIndex) => ({ type: 'CHOOSE_ROW', rowIndex })));
  }
  return { hand, selectedCard: state.selections[playerId] ?? null, legalActions };
}
export function getBotObservation(state, playerId) {
  return { ...getPublicView(state), playerId, mySecret: getPrivateView(state, playerId) };
}
export { chooseBotCommand } from './ai.js';
