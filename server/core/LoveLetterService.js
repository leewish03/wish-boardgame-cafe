import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { roomRepository } from './RoomRepository.js';
import { TurnCoordinator } from './TurnCoordinator.js';
import { decideBotAction } from './AiBotController.js';
import { RECONNECT_GRACE_MS } from '../shared/reconnectPolicy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadTs(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const transformed = esbuild.transformSync(content, {
    loader: 'ts',
    target: 'node18',
    format: 'cjs',
  });
  const m = { exports: {} };
  const dirname = path.dirname(filePath);
  const customRequire = (reqPath) => {
    let resolved = path.resolve(dirname, reqPath);
    if (!resolved.endsWith('.ts') && !resolved.endsWith('.js')) {
      if (fs.existsSync(resolved + '.ts')) resolved += '.ts';
      else if (fs.existsSync(resolved + '.js')) resolved += '.js';
    }
    if (resolved.endsWith('.ts')) {
      return loadTs(resolved);
    }
    return require(resolved);
  };
  const fn = new Function('module', 'exports', 'require', '__dirname', '__filename', transformed.code);
  fn(m, m.exports, customRequire, dirname, filePath);
  return m.exports;
}

const root = path.resolve(__dirname, '../../');
const core = loadTs(path.join(root, 'packages/love-letter-core/src/index.ts'));
const { SOCKET_EVENTS } = loadTs(path.join(root, 'packages/protocol/src/index.ts'));
const { buildPhysicalSequence } = loadTs(path.join(root, 'packages/protocol/src/physicalSequence.ts'));
// Leave time for the client-side causal sequence (card → target → result → discard)
// before an automated opponent creates the next authoritative action.
// The client has its own short causal presentation. Keeping a second 3.5s
// server delay made multiplayer turns feel stalled after the snapshot settled.
// A bot may act only after the longest normal client causal sequence has had
// time to settle. This keeps two adjacent bot turns legible without returning
// to the old multi-second artificial stall.
const BOT_THINK_MIN_MS = 1800;
const BOT_THINK_MAX_MS = 2600;
const ACTION_MAX_WAIT_MS = 8_000;
const ROUND_PRESENTATION_MAX_WAIT_MS = 8_000;
const TURN_PRESENTATION_MAX_WAIT_MS = 4_000;
export { SOCKET_EVENTS };

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

/** Build a legal, deliberately random play for a timed-out human turn. */
function createTimeoutPlayCommand(gameState, playerId) {
  const hand = gameState.secrets?.[playerId]?.hand || [];
  if (!hand.length) return null;

  // The Countess rule is mandatory even when the card itself is selected at random.
  const hasCountess = hand.some((card) => card.value === 7);
  const hasPrinceOrKing = hand.some((card) => card.value === 5 || card.value === 6);
  const candidates = hasCountess && hasPrinceOrKing ? hand.filter((card) => card.value === 7) : hand;
  const card = randomItem(candidates);
  const opponents = gameState.players.filter((player) => player.id !== playerId && !player.isEliminated && !player.isProtected);
  const command = { type: 'PLAY_CARD', playerId, cardId: card.id };

  if ([1, 2, 3, 6].includes(card.value) && opponents.length) {
    command.targetId = randomItem(opponents).id;
  } else if (card.value === 5) {
    const princeTargets = gameState.players.filter((player) => !player.isEliminated && (!player.isProtected || player.id === playerId));
    command.targetId = randomItem(princeTargets).id;
  }
  if (card.value === 1 && command.targetId) command.guessValue = randomItem([2, 3, 4, 5, 6, 7, 8]);
  return command;
}

export class LoveLetterService {
  constructor(io, { broadcastRoomState } = {}) {
    this.io = io;
    this.broadcastRoomState = broadcastRoomState || (() => {});
    this.turnCoordinator = new TurnCoordinator(io, this);
    this.eventCounters = new Map();
    this.commandQueues = new Map();
    this.botTimers = new Map();
    this.resolutionTimers = new Map();
    this.turnPresentationTimers = new Map();
    this.roundPresentationTimers = new Map();
    this.pauseExpiryTimers = new Map();
    this.roundAdvanceTimers = new Map();
    this.progressRequests = new Map();
  }

  getNextEventId(roomCode) {
    const count = (this.eventCounters.get(roomCode) || 0) + 1;
    this.eventCounters.set(roomCode, count);
    return `evt_${Date.now()}_${count}`;
  }

  getActionId(gameState, event) {
    // Turn draws are intentionally a fresh physical action. The preceding
    // card action must have settled before a new card leaves the deck.
    if (event.type === 'CARD_DRAWN') return event.actionId || `draw_${gameState.stateVersion}_${event.playerId}_${event.remainingDeckCount}`;
    return event.actionId || gameState.lastAction?.actionId || `transition_${gameState.stateVersion}`;
  }

  getResolutionTiming(gameState, actorId) {
    const action = gameState.lastAction || {};
    const actor = gameState.players.find((player) => player.id === actorId);
    const value = action.card?.value;
    const result = action.resultType || '';
    const isPriest = value === 2 && result === 'PRIEST_REVEAL';
    return {
      requiresActorAck: !actor?.isBot,
      requiresPrivateReview: isPriest,
    };
  }

  clearResolutionTimer(roomCode) {
    const timer = this.resolutionTimers.get(roomCode);
    if (timer) clearTimeout(timer);
    this.resolutionTimers.delete(roomCode);
  }

  splitResolutionEvents(events) {
    const transitionIndex = events.findIndex((event) => ['TURN_ENDED', 'ROUND_ENDED', 'MATCH_ENDED'].includes(event.type));
    if (transitionIndex < 0) return { actionEvents: events, transitionEvents: [] };
    return { actionEvents: events.slice(0, transitionIndex), transitionEvents: events.slice(transitionIndex) };
  }

  async schedulePendingResolution(roomCode) {
    const room = await roomRepository.getRoom(roomCode);
    const pending = room?.pendingResolution;
    if (!room || !pending || room.isPaused) return;
    this.clearResolutionTimer(roomCode);
    const now = Date.now();
    // Priest review is deliberately bounded.  The five seconds start only once
    // the acting client has actually revealed the card; a second server-side
    // deadline keeps a backgrounded or lost client from holding the room.
    if (pending.requiresPrivateReview && !pending.returnRequestedAt && !pending.acknowledgedAt) {
      const dueAt = pending.autoReturnAt || pending.privateReviewFallbackAt || (now + 8_000);
      const timer = setTimeout(async () => {
        this.resolutionTimers.delete(roomCode);
        await this.runRoomOperation(roomCode, async () => {
          const latest = await roomRepository.getRoom(roomCode);
          const current = latest?.pendingResolution;
          if (!latest || !current || current.actionId !== pending.actionId || latest.isPaused || current.returnRequestedAt) return;
          if (Date.now() >= (current.autoReturnAt || current.privateReviewFallbackAt || 0)) {
            await this.applyPresentationAcknowledgement(roomCode, current.actorId, current.actionId, current.stateVersion, 'RETURN_REQUEST');
          }
        });
      }, Math.max(25, dueAt - now));
      timer.unref?.();
      this.resolutionTimers.set(roomCode, timer);
      return;
    }
    const canSettle = !pending.requiresActorAck || pending.acknowledgedAt;
    const dueAt = canSettle ? Math.max(now, pending.minAdvanceAt) : Math.max(now, pending.maxAdvanceAt);
    const timer = setTimeout(async () => {
      this.resolutionTimers.delete(roomCode);
      const latest = await roomRepository.getRoom(roomCode);
      const current = latest?.pendingResolution;
      if (!latest || !current || current.actionId !== pending.actionId || latest.isPaused) return;
      if (!current.requiresActorAck || current.acknowledgedAt || Date.now() >= current.maxAdvanceAt) {
        await this.finalizePendingResolution(roomCode, current.actionId);
        return;
      }
      await this.schedulePendingResolution(roomCode);
    }, Math.max(25, dueAt - now));
    timer.unref?.();
    this.resolutionTimers.set(roomCode, timer);
  }

  createTurnPresentation(room, beforeState, gameState, events, kind) {
    const drawEvents = events.filter((event) => event.type === 'CARD_DRAWN' && ['ROUND_DEAL', 'TURN_DRAW'].includes(event.drawReason));
    if (!drawEvents.length || !gameState.currentTurnPlayerId) return null;
    const actionIds = [...new Set(drawEvents.map((event) => this.getActionId(gameState, event)))];
    const presentationId = `turn_presentation_${gameState.roundNumber}_${gameState.stateVersion}_${gameState.currentTurnPlayerId}`;
    return {
      kind,
      presentationId,
      actionIds,
      roundNumber: gameState.roundNumber,
      stateVersion: gameState.stateVersion,
      activePlayerId: gameState.currentTurnPlayerId,
      beforeState,
      events,
      requiredPlayerIds: room.players
        .filter((player) => !player.isBot && player.socketId && !player.isDisconnected)
        .map((player) => player.id),
      acknowledgedPlayerIds: [],
      fallbackAt: Date.now() + (kind === 'ROUND_DEAL' ? ROUND_PRESENTATION_MAX_WAIT_MS : TURN_PRESENTATION_MAX_WAIT_MS),
    };
  }

  async schedulePendingTurnPresentation(roomCode) {
    let room = await roomRepository.getRoom(roomCode);
    const pending = room?.pendingTurnPresentation;
    if (!room || !pending || room.isPaused) return;
    this.clearTurnPresentationTimer(roomCode);
    if (!pending.requiredPlayerIds.length || pending.requiredPlayerIds.every((id) => pending.acknowledgedPlayerIds.includes(id))) {
      await this.applyPendingTurnOpening(roomCode, pending.presentationId);
      return;
    }
    const delay = Math.max(25, pending.fallbackAt - Date.now());
    const timer = setTimeout(() => {
      this.turnPresentationTimers.delete(roomCode);
      this.runRoomOperation(roomCode, () => this.applyPendingTurnOpening(roomCode, pending.presentationId))
        .catch((error) => console.error('Turn presentation fallback failed:', error.message));
    }, delay);
    timer.unref?.();
    this.turnPresentationTimers.set(roomCode, timer);
  }

  async applyPendingTurnOpening(roomCode, presentationId) {
    const room = await roomRepository.getRoom(roomCode);
    const pending = room?.pendingTurnPresentation;
    if (!room || !pending || pending.presentationId !== presentationId || room.isPaused) return { success: false, stale: true };
    const allAcknowledged = pending.requiredPlayerIds.every((id) => pending.acknowledgedPlayerIds.includes(id));
    if (!allAcknowledged && Date.now() < pending.fallbackAt) return { success: false, pending: true };

    this.clearTurnPresentationTimer(roomCode);
    room.pendingTurnPresentation = null;
    const { nextState, events } = core.executeCommand(room.gameStateObject, {
      type: 'OPEN_TURN',
      playerId: pending.activePlayerId,
    });
    this.applyGameStateToRoom(room, nextState);
    await roomRepository.saveRoom(room);
    for (const [sequence, event] of events.entries()) this.broadcastGameEvent(roomCode, nextState, { ...event, sequence: event.sequence ?? sequence });
    this.broadcastGameSnapshot(roomCode, room);
    this.broadcastRoomState(this.io, roomCode);
    this.scheduleTurnTimeout(roomCode, nextState);
    this.scheduleNextTurnIfBot(roomCode);
    return { success: true, opened: true };
  }

  async acknowledgePresentation(roomCode, playerId, actionId, expectedStateVersion, completedPhase, roundNumber) {
    return this.runRoomOperation(roomCode, () => this.applyPresentationAcknowledgement(roomCode, playerId, actionId, expectedStateVersion, completedPhase, roundNumber));
  }

  async applyPresentationAcknowledgement(roomCode, playerId, actionId, expectedStateVersion, completedPhase, roundNumber) {
    const room = await roomRepository.getRoom(roomCode);
    const roundPending = room?.pendingRoundPresentation;
    if (roundPending && completedPhase === 'ROUND_RESULT') {
      if (roundPending.presentationId !== actionId || (expectedStateVersion != null && roundPending.stateVersion !== expectedStateVersion) || (roundNumber != null && roundPending.roundNumber !== roundNumber)) {
        return { success: false, stale: true, error: '이전 라운드 결과의 확인입니다.' };
      }
      if (!roundPending.requiredPlayerIds.includes(playerId)) return { success: false, error: '현재 결과 확인 대상이 아닙니다.' };
      if (!roundPending.acknowledgedPlayerIds.includes(playerId)) roundPending.acknowledgedPlayerIds.push(playerId);
      await roomRepository.saveRoom(room);
      if (roundPending.requiredPlayerIds.every((id) => roundPending.acknowledgedPlayerIds.includes(id))) return this.releasePendingRoundPresentation(roomCode, roundPending.presentationId);
      await this.schedulePendingRoundPresentation(roomCode);
      return { success: true, pending: true };
    }
    const turnPending = room?.pendingTurnPresentation;
    if (turnPending && completedPhase === 'TURN_PREPARATION') {
      if (turnPending.presentationId !== actionId || (expectedStateVersion != null && turnPending.stateVersion !== expectedStateVersion)) {
        return { success: false, stale: true, error: '이전 카드 배분의 확인입니다.' };
      }
      if (roundNumber != null && turnPending.roundNumber !== roundNumber) {
        return { success: false, stale: true, error: '이전 라운드의 확인입니다.' };
      }
      if (!turnPending.requiredPlayerIds.includes(playerId)) {
        return { success: false, error: '현재 배분 확인 대상이 아닙니다.' };
      }
      if (!turnPending.acknowledgedPlayerIds.includes(playerId)) turnPending.acknowledgedPlayerIds.push(playerId);
      await roomRepository.saveRoom(room);
      const allAcknowledged = turnPending.requiredPlayerIds.every((id) => turnPending.acknowledgedPlayerIds.includes(id));
      if (allAcknowledged) return this.applyPendingTurnOpening(roomCode, turnPending.presentationId);
      await this.schedulePendingTurnPresentation(roomCode);
      return { success: true, pending: true };
    }
    const pending = room?.pendingResolution;
    if (!room || !pending) return { success: false, stale: true, error: '이미 정착한 행동입니다.' };
    if (pending.actionId !== actionId || (expectedStateVersion != null && pending.stateVersion !== expectedStateVersion)) {
      return { success: false, stale: true, error: '이전 행동의 확인입니다.' };
    }
    if (pending.actorId !== playerId) {
      return { success: false, error: '행동자만 현재 행동을 완료할 수 있습니다.' };
    }
    if (completedPhase === 'RETURN_REQUEST' && pending.requiresPrivateReview) {
      if (pending.actorId !== playerId) return { success: false, error: '행동자만 카드를 돌려줄 수 있습니다.' };
      if (!pending.returnRequestedAt) {
        pending.returnRequestedAt = Date.now();
        pending.minAdvanceAt = Date.now() + 1_500;
        pending.maxAdvanceAt = Date.now() + 10_000;
        await roomRepository.saveRoom(room);
        this.io.to(roomCode).emit('game:presentation-return', { actionId, stateVersion: pending.stateVersion });
        await this.schedulePendingResolution(roomCode);
      }
      return { success: true, pending: true };
    }
    if (completedPhase === 'PRIVATE_REVIEW_VISIBLE' && pending.requiresPrivateReview) {
      if (!pending.reviewVisibleAt) {
        pending.reviewVisibleAt = Date.now();
        pending.autoReturnAt = pending.reviewVisibleAt + 5_000;
        await roomRepository.saveRoom(room);
        await this.schedulePendingResolution(roomCode);
      }
      return { success: true, pending: true };
    }
    if (pending.requiresPrivateReview && (completedPhase !== 'PRIVATE_REVIEW' || (pending.requiresActorAck && !pending.returnRequestedAt))) {
      return { success: false, error: '사제 확인을 완료한 뒤 진행할 수 있습니다.' };
    }
    if (!pending.requiresPrivateReview && completedPhase !== 'PUBLIC_SEQUENCE') return { success: false, error: '잘못된 완료 단계입니다.' };
    pending.acknowledgedAt = Date.now();
    pending.completedPhase = completedPhase;
    await roomRepository.saveRoom(room);
    await this.schedulePendingResolution(roomCode);
    return { success: true, pending: true };
  }

  async finalizePendingResolution(roomCode, actionId) {
    return this.runRoomOperation(roomCode, () => this.applyPendingResolution(roomCode, actionId));
  }

  async applyPendingResolution(roomCode, actionId) {
    const room = await roomRepository.getRoom(roomCode);
    const pending = room?.pendingResolution;
    if (!room || !pending || pending.actionId !== actionId || room.isPaused) return;
    this.clearResolutionTimer(roomCode);
    room.pendingResolution = null;
    const beforeState = room.gameStateObject;
    const { nextState: gameState, events: transitionEvents } = core.executeCommand(room.gameStateObject, { type: 'FINALIZE_ACTION' });
    this.applyGameStateToRoom(room, gameState);
    if (gameState.playPhase === 'TURN_PREPARING') {
      room.pendingTurnPresentation = this.createTurnPresentation(room, beforeState, gameState, transitionEvents, 'TURN_DRAW');
    }
    if (gameState.matchState === 'ROUND_END') {
      room.pendingRoundPresentation = this.createRoundPresentation(room, beforeState, gameState, transitionEvents);
    }
    await roomRepository.saveRoom(room);
    if (!room.pendingRoundPresentation) {
      for (const [sequence, event] of transitionEvents.entries()) {
        this.broadcastGameEvent(roomCode, gameState, { ...event, sequence: event.sequence ?? sequence });
      }
    }
    this.broadcastGameSnapshot(roomCode, room);
    this.broadcastRoomState(this.io, roomCode);
    if (room.pendingRoundPresentation) await this.schedulePendingRoundPresentation(roomCode);
    else this.scheduleRoundAdvance(roomCode, room, gameState);
    if (room.pendingTurnPresentation) await this.schedulePendingTurnPresentation(roomCode);
    else {
      this.scheduleTurnTimeout(roomCode, gameState);
      this.scheduleNextTurnIfBot(roomCode);
    }
  }

  projectEventForPlayer(event, gameState, recipientPlayerId) {
    const projected = { ...event };
    if (projected.comparisonHands && recipientPlayerId !== projected.actorId && recipientPlayerId !== projected.targetId) delete projected.comparisonHands;
    if (projected.type === 'CARD_DRAWN' && projected.playerId !== recipientPlayerId) {
      delete projected.card;
    }
    if (
      (projected.type === 'PRIEST_USED' || projected.type === 'PRIEST_REVEALED') &&
      projected.actorId !== recipientPlayerId
    ) {
      delete projected.revealedCard;
    }
    return projected;
  }

  broadcastGameEvent(roomCode, gameState, event) {
    const actionId = this.getActionId(gameState, event);
    for (const player of gameState.players) {
      const sessionPlayer = roomRepository._rooms.get(roomCode)?.players.find((candidate) => candidate.id === player.id);
      if (!sessionPlayer?.socketId) continue;
      const envelope = {
        eventId: this.getNextEventId(roomCode),
        actionId,
        stateVersion: gameState.stateVersion,
        roundNumber: gameState.roundNumber,
        timestamp: Date.now(),
        recipientPlayerId: player.id,
        event: this.projectEventForPlayer(event, gameState, player.id),
        presentation: gameState.lastAction && gameState.lastAction.actionId === actionId
          ? this.projectPresentationForPlayer(gameState.lastAction, player.id)
          : null,
      };
      this.io.to(sessionPlayer.socketId).emit(SOCKET_EVENTS.GAME_EVENT, envelope);
    }
  }

  projectPresentationForPlayer(summary, recipientPlayerId) {
    // Build a public allow-list instead of copying future summary fields by
    // default. Private card facts are added only for their entitled viewer.
    const publicSummary = {
      actionId: summary.actionId,
      actorId: summary.actorId,
      card: summary.card,
      targetId: summary.targetId ?? null,
      guessValue: summary.guessValue ?? null,
      resultType: summary.resultType,
      eliminatedPlayerId: summary.eliminatedPlayerId ?? null,
      swapped: !!summary.swapped,
    };
    if (summary.resultType === 'PRIEST_REVEAL' && summary.actorId === recipientPlayerId && summary.revealedCard) {
      return { ...publicSummary, revealedCard: summary.revealedCard };
    }
    // Guard and Prince publicly reveal a discarded/eliminated card; retain
    // only those result types, never incidental hand information.
    if (['GUARD_SUCCESS', 'PRINCE_DISCARD', 'PRINCE_PRINCESS_ELIMINATED', 'PRINCESS_ELIMINATED'].includes(summary.resultType) && summary.revealedCard) {
      return { ...publicSummary, revealedCard: summary.revealedCard };
    }
    return publicSummary;
  }

  clearTurnPresentationTimer(roomCode) {
    const timer = this.turnPresentationTimers.get(roomCode);
    if (timer) clearTimeout(timer);
    this.turnPresentationTimers.delete(roomCode);
  }

  clearRoundPresentationTimer(roomCode) {
    const timer = this.roundPresentationTimers.get(roomCode);
    if (timer) clearTimeout(timer);
    this.roundPresentationTimers.delete(roomCode);
  }

  createRoundPresentation(room, beforeState, gameState, events) {
    const roundEvent = events.find((event) => event.type === 'ROUND_ENDED');
    if (!roundEvent || !Object.keys(roundEvent.revealedHands || roundEvent.winnerCards || {}).length) return null;
    const presentationId = `round_presentation_${gameState.roundNumber}_${gameState.stateVersion}`;
    const advanceAt = Date.now() + 10_000;
    if (gameState.outcome) {
      gameState.outcome.advanceAt = advanceAt;
      gameState.outcome.canAdvanceAt = Math.max(Date.now(), advanceAt - 7_000);
    }
    return {
      kind: 'ROUND_RESULT', presentationId, roundNumber: gameState.roundNumber, stateVersion: gameState.stateVersion,
      beforeState, events: [roundEvent],
      requiredPlayerIds: room.players.filter((player) => !player.isBot && player.socketId && !player.isDisconnected).map((player) => player.id),
      acknowledgedPlayerIds: [], fallbackAt: Date.now() + ROUND_PRESENTATION_MAX_WAIT_MS, advanceAt,
    };
  }

  async schedulePendingRoundPresentation(roomCode) {
    const room = await roomRepository.getRoom(roomCode);
    const pending = room?.pendingRoundPresentation;
    if (!room || !pending || room.isPaused) return;
    this.clearRoundPresentationTimer(roomCode);
    if (!pending.requiredPlayerIds.length || pending.requiredPlayerIds.every((id) => pending.acknowledgedPlayerIds.includes(id))) {
      await this.releasePendingRoundPresentation(roomCode, pending.presentationId);
      return;
    }
    const timer = setTimeout(() => {
      this.roundPresentationTimers.delete(roomCode);
      this.runRoomOperation(roomCode, () => this.releasePendingRoundPresentation(roomCode, pending.presentationId)).catch((error) => console.error('Round presentation fallback failed:', error.message));
    }, Math.max(25, pending.fallbackAt - Date.now()));
    timer.unref?.();
    this.roundPresentationTimers.set(roomCode, timer);
  }

  async releasePendingRoundPresentation(roomCode, presentationId) {
    const room = await roomRepository.getRoom(roomCode);
    const pending = room?.pendingRoundPresentation;
    if (!room || !pending || pending.presentationId !== presentationId || room.isPaused) return { success: false, stale: true };
    const allAcknowledged = pending.requiredPlayerIds.every((id) => pending.acknowledgedPlayerIds.includes(id));
    if (!allAcknowledged && Date.now() < pending.fallbackAt) return { success: false, pending: true };
    this.clearRoundPresentationTimer(roomCode);
    room.pendingRoundPresentation = null;
    await roomRepository.saveRoom(room);
    this.broadcastGameSnapshot(roomCode, room);
    this.broadcastRoomState(this.io, roomCode);
    this.scheduleRoundAdvance(roomCode, room, room.gameStateObject, pending.advanceAt);
    return { success: true, released: true };
  }

  applyGameStateToRoom(room, gameState) {
    room.gameStateObject = gameState;
    room.gameState = gameState.matchState;
    room.playPhase = gameState.playPhase;
    room.stateVersion = gameState.stateVersion;
    room.roundNumber = gameState.roundNumber;
    room.turnPlayerId = gameState.currentTurnPlayerId;
    room.turnExpiresAt = gameState.turnExpiresAt;
    room.targetTokens = gameState.config.targetTokens;
    room.turnTimeLimit = gameState.config.turnTimeoutSeconds;

    for (const gamePlayer of gameState.players) {
      const roomPlayer = room.players.find((player) => player.id === gamePlayer.id);
      if (!roomPlayer) continue;
      roomPlayer.tokens = gamePlayer.tokens;
      roomPlayer.isEliminated = gamePlayer.isEliminated;
      roomPlayer.isProtected = gamePlayer.isProtected;
      roomPlayer.discardPile = gamePlayer.discardPile;
    }
  }

  broadcastGameSnapshot(roomCode, room) {
    if (!room || !room.gameStateObject) return;
    const gs = room.gameStateObject;

    const publicState = core.getPublicGameState(gs);
    // A no-contest match removes bot/departed sessions immediately. Project
    // the same roster into the authoritative snapshot so the board cannot
    // retain ghost seats while room:state catches up.
    if (gs.outcome?.reason === 'INSUFFICIENT_HUMANS') {
      const activeIds = new Set(room.players.map((player) => player.id));
      publicState.players = publicState.players.filter((player) => activeIds.has(player.id));
      publicState.roundWinnerIds = [];
      publicState.matchWinnerId = null;
      publicState.outcome = { ...publicState.outcome, winnerIds: [], matchWinnerId: null };
    }
    for (const player of room.players) {
      if (player.socketId) {
        const secret = core.getPrivatePlayerState(gs, player.id);
        const snapshot = {
          roomId: roomCode,
          stateVersion: gs.stateVersion,
          serverTime: Date.now(),
          publicState,
          privateState: secret,
          presentation: (room.pendingResolution || room.pendingTurnPresentation || room.pendingRoundPresentation) ? this.presentationForPlayer(room, player.id) : null,
        };
        this.io.to(player.socketId).emit(SOCKET_EVENTS.GAME_SNAPSHOT, snapshot);
      }
    }
  }

  async handleCommand(roomCode, command) {
    return this.runRoomOperation(roomCode, () => this.applyCommand(roomCode, command));
  }

  runRoomOperation(roomCode, apply) {
    // Socket.IO can deliver two clicks or a timeout and a click in the same
    // tick. Serialize authoritative mutations per room so a stale command
    // cannot apply against the same snapshot twice.
    const previous = this.commandQueues.get(roomCode) || Promise.resolve();
    const operation = previous.catch(() => {}).then(apply);
    this.commandQueues.set(roomCode, operation);
    operation.finally(() => {
      if (this.commandQueues.get(roomCode) === operation) this.commandQueues.delete(roomCode);
    }).catch(() => {});
    return operation;
  }

  presentationForPlayer(room, playerId) {
    const pending = room.pendingResolution;
    const turnPending = room.pendingTurnPresentation;
    const roundPending = room.pendingRoundPresentation;
    if (turnPending) {
      return {
        kind: 'TURN_PREPARATION',
        actionId: turnPending.presentationId,
        actionIds: turnPending.actionIds,
        stateVersion: turnPending.stateVersion,
        roundNumber: turnPending.roundNumber,
        activePlayerId: turnPending.activePlayerId,
        returnRequested: false,
        before: {
          publicState: core.getPublicGameState(turnPending.beforeState),
          privateState: core.getPrivatePlayerState(turnPending.beforeState, playerId),
        },
        events: turnPending.events.map((event, sequence) => {
          const actionId = this.getActionId(room.gameStateObject, event);
          return {
            eventId: `${turnPending.presentationId}:${sequence}:${playerId}`,
            actionId,
            stateVersion: turnPending.stateVersion,
            roundNumber: turnPending.roundNumber,
            timestamp: turnPending.fallbackAt,
            recipientPlayerId: playerId,
            event: this.projectEventForPlayer(event, room.gameStateObject, playerId),
            presentation: null,
            presentationBatch: {
              id: turnPending.presentationId,
              kind: 'TURN_PREPARATION',
              isFinalAction: actionId === turnPending.actionIds[turnPending.actionIds.length - 1],
            },
          };
        }),
      };
    }
    if (roundPending) {
      return {
        kind: 'ROUND_RESULT', actionId: roundPending.presentationId, stateVersion: roundPending.stateVersion,
        roundNumber: roundPending.roundNumber, returnRequested: false,
        before: {
          publicState: core.getPublicGameState(roundPending.beforeState),
          privateState: core.getPrivatePlayerState(roundPending.beforeState, playerId),
        },
        events: roundPending.events.map((event, sequence) => ({
          eventId: `${roundPending.presentationId}:${sequence}:${playerId}`,
          actionId: roundPending.presentationId, stateVersion: roundPending.stateVersion, roundNumber: roundPending.roundNumber,
          timestamp: roundPending.fallbackAt, recipientPlayerId: playerId,
          event: this.projectEventForPlayer(event, room.gameStateObject, playerId), presentation: null,
          presentationBatch: { id: roundPending.presentationId, kind: 'ROUND_RESULT', isFinalAction: sequence === roundPending.events.length - 1 },
        })),
      };
    }
    if (!pending) return null;
    return {
      kind: 'CARD_ACTION',
      actionId: pending.actionId,
      stateVersion: pending.stateVersion,
      returnRequested: !!pending.returnRequestedAt,
      before: {
        publicState: core.getPublicGameState(pending.beforeState),
        privateState: core.getPrivatePlayerState(pending.beforeState, playerId),
      },
      events: pending.events.map((event, sequence) => ({
        eventId: `${pending.actionId}:${sequence}:${playerId}`,
        actionId: pending.actionId,
        stateVersion: pending.stateVersion,
        roundNumber: room.gameStateObject.roundNumber,
        timestamp: pending.minAdvanceAt,
        recipientPlayerId: playerId,
        event: this.projectEventForPlayer(event, room.gameStateObject, playerId),
        presentation: this.projectPresentationForPlayer(room.gameStateObject.lastAction, playerId),
      })),
    };
  }

  async applyCommand(roomCode, command) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room || !room.gameStateObject) {
      throw new Error('방을 찾을 수 없습니다.');
    }
    if (room.isPaused && command.type !== 'FORFEIT') {
      throw new Error('재접속을 기다리는 동안 게임이 일시 정지되었습니다.');
    }
    if ((room.pendingResolution || room.pendingTurnPresentation || room.pendingRoundPresentation) && command.type !== 'FORFEIT') {
      throw new Error('이전 카드 행동을 확인하는 중입니다.');
    }
    if (command.type === 'FORFEIT') {
      this.clearPauseExpiryTimer(roomCode);
      this.clearResolutionTimer(roomCode);
      this.clearTurnPresentationTimer(roomCode);
      this.clearRoundPresentationTimer(roomCode);
      if (room.pendingResolution) this.io.to(roomCode).emit('game:presentation-cancel', { actionId: room.pendingResolution.actionId });
      room.pendingResolution = null;
      if (room.pendingTurnPresentation) this.io.to(roomCode).emit('game:presentation-cancel', { actionId: room.pendingTurnPresentation.presentationId });
      room.pendingTurnPresentation = null;
      if (room.pendingRoundPresentation) this.io.to(roomCode).emit('game:presentation-cancel', { actionId: room.pendingRoundPresentation.presentationId });
      room.pendingRoundPresentation = null;
    }

    const beforeState = room.gameStateObject;
    let { nextState, events } = core.executeCommand(beforeState, command.type === 'PLAY_CARD' ? { ...command, deferTransition: true } : command);
    if (command.type === 'FORFEIT' && nextState.playPhase === 'ACTION_RESOLVING') {
      const transition = core.executeCommand(nextState, { type: 'FINALIZE_ACTION' });
      nextState = transition.nextState;
      events = [...events, ...transition.events];
    }
    this.applyGameStateToRoom(room, nextState);
    if (nextState.outcome?.reason === 'INSUFFICIENT_HUMANS') {
      this.clearBotTimer(roomCode);
      this.turnCoordinator.clearTurnTimer(roomCode);
      this.clearRoundAdvanceTimer(roomCode);
      // Bots are not valid remaining participants after a human leaves. Keep
      // the authoritative game snapshot intact for the result sheet, but take
      // their sessions out of the room immediately so no bot turn can resume.
      room.players = room.players.filter((player) => !player.isBot);
    }
    const isCardAction = command.type === 'PLAY_CARD';
    const { actionEvents, transitionEvents } = isCardAction ? this.splitResolutionEvents(events) : { actionEvents: events, transitionEvents: [] };
    if (isCardAction) {
      const actionId = nextState.lastAction?.actionId;
        const timing = this.getResolutionTiming(nextState, command.playerId);
      room.pendingResolution = {
        actionId,
        actorId: command.playerId,
        stateVersion: nextState.stateVersion,
        transitionEvents,
        minAdvanceAt: 0,
        maxAdvanceAt: 0,
        requiresActorAck: timing.requiresActorAck,
        requiresPrivateReview: timing.requiresPrivateReview,
        reviewVisibleAt: null,
        autoReturnAt: null,
        privateReviewFallbackAt: timing.requiresPrivateReview ? Date.now() + 8_000 : null,
        beforeState,
        events: actionEvents.map((event, sequence) => {
          const augmented = { ...event, actionId, sequence };
          const discardOrdinal = (playerId, cardId) => (nextState.players.find(p => p.id === playerId)?.discardPile || []).findIndex(card => card.id === cardId);
          if (event.type === 'CARD_PLAYED') augmented.discardOrdinal = discardOrdinal(event.actorId, event.card.id);
          if (event.type === 'PRINCE_DISCARDED') augmented.discardOrdinal = discardOrdinal(event.targetId, event.discardedCard.id);
          if (event.type === 'PLAYER_ELIMINATED') {
            const discardedCards = (nextState.players.find(p => p.id === event.playerId)?.discardPile || []).filter(card =>
              card.id !== nextState.lastAction.card.id &&
              !(beforeState.players.find(p => p.id === event.playerId)?.discardPile || []).some(old => old.id === card.id) &&
              !actionEvents.some(e => e.type === 'PRINCE_DISCARDED' && e.discardedCard.id === card.id));
            augmented.discardedCards = discardedCards;
            augmented.discardOrdinals = Object.fromEntries(discardedCards.map(card => [card.id, discardOrdinal(event.playerId, card.id)]));
          }
          if (event.type === 'BARON_COMPARED') augmented.comparisonHands = {
            [event.actorId]: beforeState.secrets[event.actorId].hand.find(c => c.id !== nextState.lastAction.card.id),
            [event.targetId]: beforeState.secrets[event.targetId].hand[0],
          };
          return augmented;
        }),
      };
      const duration = buildPhysicalSequence(room.pendingResolution.events.map(event => ({ event, actionId, presentation: nextState.lastAction }))).reduce((sum, step) => sum + step.duration * 1000, 0);
      room.pendingResolution.minAdvanceAt = Date.now() + duration + 250;
      room.pendingResolution.maxAdvanceAt = Date.now() + Math.max(duration + 5_000, ACTION_MAX_WAIT_MS);
    }
    if (!isCardAction && nextState.playPhase === 'TURN_PREPARING') {
      room.pendingTurnPresentation = this.createTurnPresentation(room, beforeState, nextState, events, 'TURN_DRAW');
    }
    if (!isCardAction && nextState.matchState === 'ROUND_END') {
      room.pendingRoundPresentation = this.createRoundPresentation(room, beforeState, nextState, events);
    }
    if (!isCardAction && !room.pendingRoundPresentation) this.scheduleRoundAdvance(roomCode, room, nextState);
    await roomRepository.saveRoom(room);

    for (const [sequence, ev] of actionEvents.entries()) {
      this.broadcastGameEvent(roomCode, nextState, { ...ev, actionId: isCardAction ? nextState.lastAction.actionId : ev.actionId, sequence: ev.sequence ?? sequence });
    }

    // Do not publish the next-turn snapshot until the current card has been
    // physically explained. This is the authoritative presentation gate.
    if (isCardAction) {
      this.turnCoordinator.clearTurnTimer(roomCode);
      this.clearBotTimer(roomCode);
      await this.schedulePendingResolution(roomCode);
      this.broadcastGameSnapshot(roomCode, room);
    } else {
      this.broadcastGameSnapshot(roomCode, room);
      this.broadcastRoomState(this.io, roomCode);
      if (room.pendingRoundPresentation) await this.schedulePendingRoundPresentation(roomCode);
      else if (room.pendingTurnPresentation) await this.schedulePendingTurnPresentation(roomCode);
      else {
        this.scheduleTurnTimeout(roomCode, nextState);
        this.scheduleNextTurnIfBot(roomCode);
      }
    }

    return { nextState, events };
  }

  async startMatch(roomCode, hostId) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) throw new Error('방을 찾을 수 없습니다.');
    if (room.hostId !== hostId) throw new Error('방장만 게임을 시작할 수 있습니다.');
    if (room.players.length < 2) throw new Error('최소 2명 이상의 플레이어가 필요합니다.');
    if (room.gameState === 'LOBBY') {
      const waiting = room.players.filter((player) => player.id !== hostId && !player.isReady && !player.isBot);
      if (waiting.length > 0) throw new Error('모든 플레이어가 준비 완료해야 합니다.');
    }

    const players = room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      avatar: player.avatarUrl || player.avatar || '👑',
      isHost: player.id === room.hostId,
      isBot: !!player.isBot,
      tokens: room.gameState === 'GAME_OVER' ? 0 : player.tokens || 0,
      personality: player.personality,
      memory: player.memory,
    }));
    const storedState = room.gameStateObject;
    // A player who forfeited remains in the completed round snapshot, but not
    // in the next deal. Preserve all remaining players' score state.
    const baseState = storedState && room.gameState === 'ROUND_END'
      ? {
          ...storedState,
          players: storedState.players.filter((player) => players.some((active) => active.id === player.id)),
          secrets: Object.fromEntries(Object.entries(storedState.secrets || {}).filter(([id]) => players.some((active) => active.id === id))),
        }
      : storedState || core.createInitialGameState(players, {
      targetTokens: room.targetTokens,
      turnTimeoutSeconds: room.turnTimeLimit,
      maxPlayers: room.maxPlayers,
    });
    const command = room.gameState === 'ROUND_END'
      ? { type: 'START_ROUND' }
      : { type: 'START_MATCH', config: {
        targetTokens: room.targetTokens,
        turnTimeoutSeconds: room.turnTimeLimit,
        maxPlayers: room.maxPlayers,
      } };
    const { nextState, events } = core.executeCommand(baseState, command);
    this.clearRoundAdvanceTimer(roomCode);
    this.applyGameStateToRoom(room, nextState);
    if (nextState.playPhase === 'ROUND_START') {
      // Start from a genuinely empty table for the new round, rather than a
      // previous round snapshot with different card positions.
      const dealBefore = JSON.parse(JSON.stringify(nextState));
      dealBefore.deck = [...nextState.deck, ...nextState.players.flatMap((player) => nextState.secrets[player.id]?.hand || [])];
      for (const player of dealBefore.players) {
        player.cardCount = 0;
        player.discardPile = [];
      }
      for (const playerId of Object.keys(dealBefore.secrets)) dealBefore.secrets[playerId].hand = [];
      room.pendingTurnPresentation = this.createTurnPresentation(room, dealBefore, nextState, events, 'ROUND_DEAL');
    }
    await roomRepository.saveRoom(room);
    for (const [sequence, event] of events.entries()) this.broadcastGameEvent(roomCode, nextState, { ...event, sequence: event.sequence ?? sequence });
    this.broadcastGameSnapshot(roomCode, room);
    this.broadcastRoomState(this.io, roomCode);
    if (room.pendingTurnPresentation) await this.schedulePendingTurnPresentation(roomCode);
    else {
      this.scheduleTurnTimeout(roomCode, nextState);
      this.scheduleNextTurnIfBot(roomCode);
    }
    return { nextState, events };
  }

  clearRoundAdvanceTimer(roomCode) {
    const timer = this.roundAdvanceTimers.get(roomCode);
    if (timer) clearTimeout(timer);
    this.roundAdvanceTimers.delete(roomCode);
  }

  scheduleRoundAdvance(roomCode, room, gameState, requestedAdvanceAt = null) {
    this.clearRoundAdvanceTimer(roomCode);
    if (gameState.matchState !== 'ROUND_END') return;
    const now = Date.now();
    const requested = Number(requestedAdvanceAt);
    const advanceAt = Number.isFinite(requested) && requested > now ? requested : now + 10_000;
    if (gameState.outcome) {
      gameState.outcome.advanceAt = advanceAt;
      gameState.outcome.canAdvanceAt = advanceAt - 7_000;
    }
    room.gameStateObject = gameState;
    const timer = setTimeout(async () => {
      this.roundAdvanceTimers.delete(roomCode);
      const latest = await roomRepository.getRoom(roomCode);
      if (!latest?.gameStateObject || latest.gameStateObject.matchState !== 'ROUND_END') return;
      try { await this.startMatch(roomCode, latest.hostId); } catch (error) { console.error('Automatic round advance failed:', error.message); }
    }, Math.max(0, advanceAt - Date.now()));
    timer.unref?.();
    this.roundAdvanceTimers.set(roomCode, timer);
  }

  async runProgressRequest(roomCode, hostId, requestId, operation) {
    if (!requestId || typeof requestId !== 'string') throw new Error('진행 요청 식별자가 필요합니다.');
    const key = `${roomCode}:${hostId}:${requestId}`;
    const existing = this.progressRequests.get(key);
    if (existing) return existing;
    const request = Promise.resolve().then(operation).then((result) => ({
      accepted: true,
      resultingStateVersion: result?.nextState?.stateVersion ?? null,
    }));
    this.progressRequests.set(key, request);
    const clearRequest = () => {
      const expiry = setTimeout(() => this.progressRequests.delete(key), 60_000);
      expiry.unref?.();
    };
    request.then(clearRequest, clearRequest);
    return request;
  }

  async advanceRound(roomCode, hostId, expectedStateVersion, requestId) {
    return this.runProgressRequest(roomCode, hostId, requestId, async () => {
    const room = await roomRepository.getRoom(roomCode);
    if (!room?.gameStateObject) throw new Error('방을 찾을 수 없습니다.');
    if (room.hostId !== hostId) throw new Error('방장만 다음 라운드를 시작할 수 있습니다.');
    if (room.gameStateObject.matchState !== 'ROUND_END') throw new Error('다음 라운드를 시작할 수 있는 상태가 아닙니다.');
    if (room.pendingRoundPresentation) throw new Error('라운드 결과를 확인하는 중입니다.');
    if (expectedStateVersion != null && expectedStateVersion !== room.gameStateObject.stateVersion) throw new Error('게임 상태가 변경되었습니다. 다시 확인해 주세요.');
    const manualAdvanceAt = Number(room.gameStateObject.outcome?.advanceAt || 0) - 7_000;
    if (manualAdvanceAt > Date.now()) throw new Error('결과를 확인할 시간을 잠시 더 주세요.');
    return this.startMatch(roomCode, hostId);
    });
  }

  async startRematch(roomCode, hostId, expectedStateVersion, requestId) {
    return this.runProgressRequest(roomCode, hostId, requestId, async () => {
      const room = await roomRepository.getRoom(roomCode);
      if (!room?.gameStateObject) throw new Error('방을 찾을 수 없습니다.');
      if (room.hostId !== hostId) throw new Error('방장만 새 매치를 시작할 수 있습니다.');
      if (room.gameStateObject.matchState !== 'GAME_OVER') throw new Error('새 매치를 시작할 수 있는 상태가 아닙니다.');
      if (expectedStateVersion != null && expectedStateVersion !== room.gameStateObject.stateVersion) throw new Error('게임 상태가 변경되었습니다. 다시 확인해 주세요.');
      return this.startMatch(roomCode, hostId);
    });
  }

  scheduleTurnTimeout(roomCode, gameState) {
    if (gameState.matchState !== 'PLAYING' || gameState.playPhase !== 'TURN_INPUT' || !gameState.currentTurnPlayerId) {
      this.turnCoordinator.clearTurnTimer(roomCode);
      return;
    }
    if (gameState.config.turnTimeoutSeconds <= 0) return;
    const playerId = gameState.currentTurnPlayerId;
    const stateVersion = gameState.stateVersion;
    const turnExpiresAt = gameState.turnExpiresAt;
    this.turnCoordinator.startTurnTimer(roomCode, gameState.turnExpiresAt, () => {
      roomRepository.getRoom(roomCode).then((room) => {
        if (room?.isPaused) return;
        const latestState = room?.gameStateObject;
        if (
          !latestState ||
          latestState.currentTurnPlayerId !== playerId ||
          latestState.stateVersion !== stateVersion ||
          latestState.turnExpiresAt !== turnExpiresAt ||
          latestState.matchState !== 'PLAYING'
        ) return;
        const timeoutPlay = createTimeoutPlayCommand(latestState, playerId);
        if (!timeoutPlay) return;
        return this.handleCommand(roomCode, timeoutPlay);
      }).catch((error) => {
        console.error('Timed-out random play failed:', error.message);
      });
    });
  }

  clearBotTimer(roomCode) {
    const timer = this.botTimers.get(roomCode);
    if (timer) clearTimeout(timer);
    this.botTimers.delete(roomCode);
  }

  clearPauseExpiryTimer(roomCode) {
    const timer = this.pauseExpiryTimers.get(roomCode);
    if (timer) clearTimeout(timer);
    this.pauseExpiryTimers.delete(roomCode);
  }

  schedulePauseExpiry(roomCode, playerId, pauseExpiry) {
    this.clearPauseExpiryTimer(roomCode);
    const timer = setTimeout(() => {
      this.pauseExpiryTimers.delete(roomCode);
      this.expirePausedPlayer(roomCode, playerId, pauseExpiry).catch((error) => {
        console.error('Paused player expiry failed:', error.message);
      });
    }, Math.max(0, pauseExpiry - Date.now()));
    timer.unref?.();
    this.pauseExpiryTimers.set(roomCode, timer);
  }

  async restorePausedRooms() {
    // Socket timers do not survive a process restart.  Restore each persisted
    // pause with a fresh, bounded deadline so a stale room can never keep its
    // remaining players in a permanent reconnect overlay.
    const rooms = await roomRepository.listRooms();
    for (const room of rooms) {
      if (!room?.isPaused || !room.gameStateObject) continue;
      const pausedPlayer = room.players?.find((player) => player.id === room.pausedPlayerId)
        || room.players?.find((player) => player.isDisconnected);
      if (!pausedPlayer) {
        room.isPaused = false;
        room.pausedPlayerId = null;
        room.pauseExpiresAt = null;
        delete room.pausedTurnRemainingMs;
        await roomRepository.saveRoom(room);
        this.broadcastRoomState(this.io, room.code);
        continue;
      }

      room.pausedPlayerId = pausedPlayer.id;
      room.pauseExpiresAt = Date.now() + RECONNECT_GRACE_MS;
      await roomRepository.saveRoom(room);
      this.schedulePauseExpiry(room.code, pausedPlayer.id, room.pauseExpiresAt);
      this.broadcastRoomState(this.io, room.code);
    }
  }

  async restorePendingTurnPresentations() {
    // Presentation watchdogs are process-local. Re-arm persisted gates after
    // restart so a TURN_PREPARING room can never remain frozen indefinitely.
    const rooms = await roomRepository.listRooms();
    for (const room of rooms) {
      if (!room?.pendingTurnPresentation || !room.gameStateObject) continue;
      if (room.isPaused) continue;
      await this.schedulePendingTurnPresentation(room.code);
    }
  }

  async restorePendingRoundPresentations() {
    const rooms = await roomRepository.listRooms();
    for (const room of rooms) {
      if (!room?.pendingRoundPresentation || !room.gameStateObject || room.isPaused) continue;
      await this.schedulePendingRoundPresentation(room.code);
    }
  }

  appendSystemMessage(room, text) {
    if (!room.chatMessages) room.chatMessages = [];
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'system',
      text,
      timestamp: Date.now(),
    };
    room.chatMessages.push(message);
    if (room.chatMessages.length > 100) room.chatMessages.splice(0, room.chatMessages.length - 100);
    return message;
  }

  async expirePausedPlayer(roomCode, playerId, expectedExpiry) {
    let room = await roomRepository.getRoom(roomCode);
    if (!room?.isPaused || room.pausedPlayerId !== playerId || room.pauseExpiresAt !== expectedExpiry) return;
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player?.isDisconnected) return;

    room.isPaused = false;
    room.pausedPlayerId = null;
    room.pauseExpiresAt = null;
    delete room.pausedTurnRemainingMs;
    await roomRepository.saveRoom(room);
    await this.finalizeDeparture(roomCode, playerId);
    room = await roomRepository.getRoom(roomCode);
    if (!room) return;

    // The disconnected member is no longer eligible to rejoin a finished
    // table. Bots have already been removed by handleCommand if humans fell
    // below two.
    room.players = room.players.filter((candidate) => candidate.id !== playerId);
    if (room.hostId === playerId && room.players.length) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
      room.players[0].isReady = true;
    }
    const message = this.appendSystemMessage(room, `${player.nickname}님이 재접속하지 않아 퇴장했습니다.`);
    this.io.to(roomCode).emit('chat:message', message);
    await roomRepository.saveRoom(room);
    this.broadcastRoomState(this.io, roomCode);
  }

  async pauseRoom(roomCode, playerId) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room?.gameStateObject || room.isPaused) return;

    room.isPaused = true;
    room.pausedPlayerId = playerId;
    room.pauseExpiresAt = Date.now() + RECONNECT_GRACE_MS;
    room.pausedTurnRemainingMs = Math.max(0, room.gameStateObject.turnExpiresAt - Date.now());
    this.turnCoordinator.clearTurnTimer(roomCode);
    this.clearBotTimer(roomCode);
    this.clearResolutionTimer(roomCode);
    this.clearTurnPresentationTimer(roomCode);
    this.clearRoundPresentationTimer(roomCode);
    const pauseExpiry = room.pauseExpiresAt;
    this.schedulePauseExpiry(roomCode, playerId, pauseExpiry);
    await roomRepository.saveRoom(room);
    this.broadcastRoomState(this.io, roomCode);
  }

  async resumeRoom(roomCode) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room?.gameStateObject || !room.isPaused) return;

    const now = Date.now();
    this.clearPauseExpiryTimer(roomCode);
    const hasPresentationGate = !!room.pendingResolution || !!room.pendingTurnPresentation || !!room.pendingRoundPresentation || room.gameStateObject.playPhase !== 'TURN_INPUT';
    const remaining = Math.max(1_000, Number(room.pausedTurnRemainingMs) || room.gameStateObject.config.turnTimeoutSeconds * 1_000);
    const nextState = hasPresentationGate
      ? {
          ...room.gameStateObject,
          stateVersion: room.gameStateObject.stateVersion + 1,
        }
      : {
          ...room.gameStateObject,
          turnStartedAt: now,
          turnExpiresAt: now + remaining,
          stateVersion: room.gameStateObject.stateVersion + 1,
        };
    room.isPaused = false;
    room.pausedPlayerId = null;
    room.pauseExpiresAt = null;
    delete room.pausedTurnRemainingMs;
    if (room.pendingResolution) room.pendingResolution.stateVersion = nextState.stateVersion;
    if (room.pendingTurnPresentation) room.pendingTurnPresentation.stateVersion = nextState.stateVersion;
    if (room.pendingRoundPresentation) room.pendingRoundPresentation.stateVersion = nextState.stateVersion;
    this.applyGameStateToRoom(room, nextState);
    await roomRepository.saveRoom(room);
    if (room.pendingResolution) {
      await this.schedulePendingResolution(roomCode);
      this.broadcastGameSnapshot(roomCode, room);
    } else if (room.pendingTurnPresentation) {
      await this.schedulePendingTurnPresentation(roomCode);
      this.broadcastGameSnapshot(roomCode, room);
    } else if (room.pendingRoundPresentation) {
      await this.schedulePendingRoundPresentation(roomCode);
      this.broadcastGameSnapshot(roomCode, room);
      this.broadcastRoomState(this.io, roomCode);
    } else {
      this.broadcastGameSnapshot(roomCode, room);
      this.broadcastRoomState(this.io, roomCode);
      this.scheduleTurnTimeout(roomCode, nextState);
      this.scheduleNextTurnIfBot(roomCode);
    }
  }

  /**
   * A departure is a game transition, not just a chat line.  Keeping it here
   * makes explicit leave and reconnect-expiry follow the same liveness rules.
   */
  async finalizeDeparture(roomCode, playerId) {
    return this.runRoomOperation(roomCode, async () => {
      const room = await roomRepository.getRoom(roomCode);
      const departed = room?.players?.find((player) => player.id === playerId);
      if (!room || !departed) return { success: false, stale: true };

      await this.applyCommand(roomCode, { type: 'FORFEIT', playerId });
      const latest = await roomRepository.getRoom(roomCode);
      if (!latest) return { success: true };
      latest.players = latest.players.filter((player) => player.id !== playerId);

      for (const pending of [latest.pendingResolution, latest.pendingTurnPresentation, latest.pendingRoundPresentation]) {
        if (!pending) continue;
        pending.requiredPlayerIds = (pending.requiredPlayerIds || []).filter((id) => id !== playerId);
        pending.acknowledgedPlayerIds = (pending.acknowledgedPlayerIds || []).filter((id) => id !== playerId);
      }

      const humans = latest.players.filter((player) => !player.isBot);
      if (humans.length < 2) {
        this.clearResolutionTimer(roomCode);
        this.clearTurnPresentationTimer(roomCode);
        this.clearRoundPresentationTimer(roomCode);
        this.clearRoundAdvanceTimer(roomCode);
        this.turnCoordinator.clearTurnTimer(roomCode);
        this.clearBotTimer(roomCode);
        latest.pendingResolution = null;
        latest.pendingTurnPresentation = null;
        latest.pendingRoundPresentation = null;
        this.io.to(roomCode).emit('game:terminated', { reason: 'INSUFFICIENT_PLAYERS', departedPlayerId: playerId });
      }

      await roomRepository.saveRoom(latest);
      this.broadcastGameSnapshot(roomCode, latest);
      this.broadcastRoomState(this.io, roomCode);
      if (humans.length >= 2) {
        if (latest.pendingResolution) await this.schedulePendingResolution(roomCode);
        else if (latest.pendingTurnPresentation) await this.schedulePendingTurnPresentation(roomCode);
        else if (latest.pendingRoundPresentation) await this.schedulePendingRoundPresentation(roomCode);
        else {
          this.scheduleTurnTimeout(roomCode, latest.gameStateObject);
          this.scheduleNextTurnIfBot(roomCode);
        }
      }
      return { success: true, departed, terminated: humans.length < 2 };
    });
  }

  async scheduleNextTurnIfBot(roomCode) {
    const room = await roomRepository.getRoom(roomCode);
    if (!room || !room.gameStateObject || room.isPaused || room.gameStateObject.matchState !== 'PLAYING') return;

    const gs = room.gameStateObject;
    const currentTurnPlayer = gs.players.find(p => p.id === gs.currentTurnPlayerId);
    const expectedStateVersion = gs.stateVersion;
    const expectedTurnExpiresAt = gs.turnExpiresAt;

    if (currentTurnPlayer && currentTurnPlayer.isBot && !currentTurnPlayer.isEliminated) {
      this.clearBotTimer(roomCode);
      const botTimer = setTimeout(async () => {
        this.botTimers.delete(roomCode);
        const latestRoom = await roomRepository.getRoom(roomCode);
        if (!latestRoom || !latestRoom.gameStateObject || latestRoom.isPaused) return;
        const latestGs = latestRoom.gameStateObject;
        if (
          latestGs.currentTurnPlayerId !== currentTurnPlayer.id ||
          latestGs.stateVersion !== expectedStateVersion ||
          latestGs.turnExpiresAt !== expectedTurnExpiresAt ||
          latestGs.matchState !== 'PLAYING'
        ) return;

        const botAction = decideBotAction(latestGs, currentTurnPlayer);
        if (botAction) {
          try {
            await this.handleCommand(roomCode, {
              type: 'PLAY_CARD',
              playerId: currentTurnPlayer.id,
              cardId: botAction.cardId,
              targetId: botAction.targetId,
              guessValue: botAction.guessValue,
            });
          } catch (e) {
            console.error('Bot action error:', e.message);
          }
        }
      }, BOT_THINK_MIN_MS + Math.floor(Math.random() * (BOT_THINK_MAX_MS - BOT_THINK_MIN_MS + 1)));
      botTimer.unref?.();
      this.botTimers.set(roomCode, botTimer);
    }
  }
}

export const createLoveLetterService = (io, options) => new LoveLetterService(io, options);
