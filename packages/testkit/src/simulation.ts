import {
  LoveLetterEngine,
  createInitialGameState,
  PlayerId,
  GameState,
  Card,
  CARD_DEFINITIONS,
  TOTAL_CARD_COUNT,
  TOTAL_CARD_COUNT_EXPANDED,
} from '../../love-letter-core/src/index';

export interface SimulationResult {
  matchCount: number;
  totalRounds: number;
  totalTurns: number;
  deadlocks: number;
  invariantFailures: string[];
  winners: Record<string, number>;
  averageTurnsPerRound: number;
}

export interface SimulationOptions {
  matchCount?: number;
  playerCount?: number;
  targetTokens?: number;
  maxTurnsPerMatch?: number;
}

export class LoveLetterSimulator {
  /**
   * Run full automated headless simulations of Love Letter matches with AI logic.
   */
  static runBatch(options: SimulationOptions = {}): SimulationResult {
    const {
      matchCount = 100,
      playerCount = 4,
      targetTokens = 4,
      maxTurnsPerMatch = 200,
    } = options;

    const result: SimulationResult = {
      matchCount,
      totalRounds: 0,
      totalTurns: 0,
      deadlocks: 0,
      invariantFailures: [],
      winners: {},
      averageTurnsPerRound: 0,
    };

    for (let m = 0; m < matchCount; m++) {
      const playerIds: PlayerId[] = Array.from(
        { length: playerCount },
        (_, i) => `bot_${i + 1}`
      );

      playerIds.forEach((p) => {
        if (!result.winners[p]) result.winners[p] = 0;
      });

      const tokenScores: Record<string, number> = {};
      playerIds.forEach((p) => (tokenScores[p] = 0));

      let matchOver = false;
      let turnsInMatch = 0;

      while (!matchOver && turnsInMatch < maxTurnsPerMatch) {
        result.totalRounds++;
        let gameState = createInitialGameState(playerIds, 1);
        let roundOver = false;

        while (!roundOver && turnsInMatch < maxTurnsPerMatch) {
          turnsInMatch++;
          result.totalTurns++;

          // Invariant Check 1: Card Conservation
          const expectedTotal = playerCount > 4 ? TOTAL_CARD_COUNT_EXPANDED : TOTAL_CARD_COUNT;
          const allCards = [
            ...gameState.deck,
            ...gameState.players.flatMap((p) => p.hand),
            ...gameState.players.flatMap((p) => p.discardPile),
            ...(gameState.setAsideSecretCard ? [gameState.setAsideSecretCard] : []),
            ...gameState.setAsideOpenCards,
          ];

          if (allCards.length !== expectedTotal) {
            result.invariantFailures.push(
              `[Match ${m} Round ${gameState.roundNumber}] Card conservation failed: Expected ${expectedTotal}, got ${allCards.length}`
            );
          }

          // Invariant Check 2: Unique Card IDs
          const cardIdSet = new Set(allCards.map((c) => c.id));
          if (cardIdSet.size !== allCards.length) {
            result.invariantFailures.push(
              `[Match ${m} Round ${gameState.roundNumber}] Duplicate card ID detected!`
            );
          }

          // Execute Turn via Engine
          const currentTurnPlayer = gameState.players.find(
            (p) => p.id === gameState.turnPlayerId
          );

          if (!currentTurnPlayer || currentTurnPlayer.isEliminated) {
            result.deadlocks++;
            result.invariantFailures.push(
              `[Match ${m} Round ${gameState.roundNumber}] Invalid turn player: ${gameState.turnPlayerId}`
            );
            break;
          }

          // AI Decision
          const hand = currentTurnPlayer.hand;
          if (hand.length === 0) {
            result.deadlocks++;
            result.invariantFailures.push(
              `[Match ${m}] Active player ${currentTurnPlayer.id} has empty hand!`
            );
            break;
          }

          // Countess rule enforcement
          const hasCountess = hand.some((c) => c.value === 7);
          const hasPrinceOrKing = hand.some((c) => c.value === 5 || c.value === 6);
          let selectedCard: Card;

          if (hasCountess && hasPrinceOrKing) {
            selectedCard = hand.find((c) => c.value === 7)!;
          } else {
            selectedCard = hand[Math.floor(Math.random() * hand.length)];
          }

          // Determine target
          const eligibleTargets = gameState.players.filter(
            (p) => !p.isEliminated && !p.isProtected && p.id !== currentTurnPlayer.id
          );

          let targetId: string | undefined = undefined;
          if ([1, 2, 3, 6].includes(selectedCard.value) && eligibleTargets.length > 0) {
            targetId = eligibleTargets[Math.floor(Math.random() * eligibleTargets.length)].id;
          } else if (selectedCard.value === 5) {
            const princeTargets = gameState.players.filter((p) => !p.isEliminated);
            targetId = princeTargets[Math.floor(Math.random() * princeTargets.length)].id;
          }

          // Guess value for Guard
          let guessValue: number | undefined = undefined;
          if (selectedCard.value === 1 && targetId) {
            guessValue = Math.floor(Math.random() * 7) + 2; // 2~8
          }

          // Play Card
          const playRes = LoveLetterEngine.processCommand(gameState, {
            type: 'PLAY_CARD',
            playerId: currentTurnPlayer.id,
            cardId: selectedCard.id,
          });

          gameState = playRes.state;

          if (targetId) {
            const targetRes = LoveLetterEngine.processCommand(gameState, {
              type: 'SELECT_TARGET',
              playerId: currentTurnPlayer.id,
              targetId,
            });
            gameState = targetRes.state;
          }

          if (guessValue) {
            const guessRes = LoveLetterEngine.processCommand(gameState, {
              type: 'GUESS_CARD',
              playerId: currentTurnPlayer.id,
              value: guessValue,
            });
            gameState = guessRes.state;
          }

          if (gameState.phase === 'ROUND_END' || gameState.phase === 'GAME_OVER') {
            roundOver = true;
            if (gameState.roundWinnerId) {
              tokenScores[gameState.roundWinnerId] =
                (tokenScores[gameState.roundWinnerId] || 0) + 1;
              if (tokenScores[gameState.roundWinnerId] >= targetTokens) {
                matchOver = true;
                result.winners[gameState.roundWinnerId] =
                  (result.winners[gameState.roundWinnerId] || 0) + 1;
              }
            }
          }
        }
      }
    }

    result.averageTurnsPerRound =
      result.totalRounds > 0 ? Number((result.totalTurns / result.totalRounds).toFixed(2)) : 0;

    return result;
  }
}
