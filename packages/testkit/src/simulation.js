import {
  generateDeck,
  executePlayCard,
  startRound,
  CARD_DEFS,
} from '../../../server/games/love-letter.js';
import { decideBotAction } from '../../../server/games/love-letter-ai.js';

export class LoveLetterSimulator {
  /**
   * Run full automated headless simulations of Love Letter matches with AI logic and invariant checking.
   */
  static runBatch(options = {}) {
    const {
      matchCount = 100,
      playerCount = 4,
      targetTokens = 4,
      maxTurnsPerMatch = 400,
    } = options;

    const result = {
      matchCount,
      totalRounds: 0,
      totalTurns: 0,
      deadlocks: 0,
      invariantFailures: [],
      winners: {},
      averageTurnsPerRound: 0,
    };

    const mockIo = {
      to: () => ({
        emit: () => {},
      }),
    };

    for (let m = 0; m < matchCount; m++) {
      const players = Array.from({ length: playerCount }, (_, i) => ({
        id: `bot_${i + 1}`,
        nickname: `Bot ${i + 1}`,
        avatarUrl: '',
        isBot: true,
        botPersonality: ['AGGRESSIVE', 'DEFENSIVE', 'CALCULATING'][i % 3],
        isEliminated: false,
        isProtected: false,
        tokens: 0,
        hand: [],
        discardPile: [],
      }));

      players.forEach((p) => {
        if (!result.winners[p.nickname]) result.winners[p.nickname] = 0;
      });

      const room = {
        code: `SIM_${m}`,
        gameState: 'PLAYING',
        roundNumber: 0,
        targetTokens,
        players,
        turnPlayerId: players[0].id,
        turnStartedAt: Date.now(),
        turnTimeLimit: 60,
        deck: [],
        setAsideSecretCard: null,
        setAsideOpenCards: [],
        actionLogs: [],
      };

      let matchOver = false;
      let turnsInMatch = 0;

      while (!matchOver && turnsInMatch < maxTurnsPerMatch) {
        room.roundNumber++;
        result.totalRounds++;
        startRound(mockIo, room);

        let roundOver = false;

        while (!roundOver && turnsInMatch < maxTurnsPerMatch) {
          turnsInMatch++;
          result.totalTurns++;

          // Invariant Check 1: Card Conservation
          const expectedTotal = playerCount >= 5 ? 22 : 16;
          const allCards = [
            ...room.deck,
            ...room.players.flatMap((p) => p.hand),
            ...room.players.flatMap((p) => p.discardPile),
            ...(room.setAsideSecretCard ? [room.setAsideSecretCard] : []),
            ...room.setAsideOpenCards,
          ];

          if (allCards.length !== expectedTotal) {
            result.invariantFailures.push(
              `[Match ${m} Round ${room.roundNumber}] Card conservation failed: Expected ${expectedTotal}, got ${allCards.length}`
            );
          }

          // Invariant Check 2: Unique Card IDs
          const cardIdSet = new Set(allCards.map((c) => c.id));
          if (cardIdSet.size !== allCards.length) {
            result.invariantFailures.push(
              `[Match ${m} Round ${room.roundNumber}] Duplicate card ID detected!`
            );
          }

          // Active turn player
          const currentTurnPlayer = room.players.find((p) => p.id === room.turnPlayerId);

          if (!currentTurnPlayer || currentTurnPlayer.isEliminated) {
            result.deadlocks++;
            result.invariantFailures.push(
              `[Match ${m} Round ${room.roundNumber}] Invalid turn player: ${room.turnPlayerId}`
            );
            break;
          }

          // Clear bot timer if scheduled by server startTurn
          if (room.botActionTimer) {
            clearTimeout(room.botActionTimer);
            room.botActionTimer = null;
          }

          const action = decideBotAction(room, currentTurnPlayer);
          if (!action || !action.cardId) {
            result.deadlocks++;
            result.invariantFailures.push(
              `[Match ${m}] Bot failed to make a decision for player ${currentTurnPlayer.id}`
            );
            break;
          }

          const playRes = executePlayCard(mockIo, room, currentTurnPlayer.id, {
            cardId: action.cardId,
            targetUserId: action.targetUserId,
            guessValue: action.guessValue,
          });

          if (!playRes.success) {
            result.invariantFailures.push(
              `[Match ${m}] Card play rejected: ${playRes.error}`
            );
            break;
          }

          if (room.gameState === 'ROUND_END' || room.gameState === 'GAME_OVER') {
            roundOver = true;
            if (room.gameState === 'GAME_OVER') {
              matchOver = true;
              const winner = room.gameWinner || room.players.find((p) => p.tokens >= targetTokens);
              if (winner) {
                result.winners[winner.nickname] = (result.winners[winner.nickname] || 0) + 1;
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
