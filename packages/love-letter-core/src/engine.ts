import { GameState, PlayerId } from './types';
import { GameCommand } from './commands';
import { GameEvent } from './events';
import { createDeck } from './cards';
import { validatePlayCard } from './rules';
import { isRoundOver, determineRoundWinners } from './selectors';

export interface EngineResult {
  nextState: GameState;
  events: GameEvent[];
}

export function executeCommand(state: GameState, command: GameCommand): EngineResult {
  const events: GameEvent[] = [];
  let s: GameState = JSON.parse(JSON.stringify(state));
  s.stateVersion++;

  switch (command.type) {
    case 'START_MATCH': {
      if (s.players.length < s.config.minPlayers) {
        throw new Error('인원이 부족합니다.');
      }
      s.matchState = 'PLAYING';
      s.roundNumber = 0;
      for (const p of s.players) {
        p.tokens = 0;
      }
      // Chain start round
      return executeCommand(s, { type: 'START_ROUND' });
    }

    case 'START_ROUND': {
      s.roundNumber++;
      s.matchState = 'PLAYING';
      s.playPhase = 'ROUND_START';
      s.roundWinnerIds = [];
      s.lastAction = null;

      // Reset player round flags
      for (const p of s.players) {
        p.isEliminated = false;
        p.isProtected = false;
        p.discardPile = [];
        delete p.eliminationReason;
        delete p.eliminatedBy;
        s.secrets[p.id] = { id: p.id, hand: [] };
      }

      // Generate and shuffle deck
      const deck = createDeck(s.players.length);
      s.setAsideCard = deck.pop() || null;
      s.deck = deck;

      // Deal 1 card to each active player
      for (const p of s.players) {
        const card = s.deck.pop();
        if (card) {
          s.secrets[p.id].hand.push(card);
          p.cardCount = 1;
        }
      }

      // Pick first player
      const firstPlayer = s.players[0];
      s.currentTurnPlayerId = firstPlayer.id;

      events.push({
        type: 'ROUND_STARTED',
        roundNumber: s.roundNumber,
        firstPlayerId: firstPlayer.id,
        remainingDeckCount: s.deck.length,
      });

      // Draw turn card for first player
      const drawCard = s.deck.pop();
      if (drawCard) {
        s.secrets[firstPlayer.id].hand.push(drawCard);
        firstPlayer.cardCount = s.secrets[firstPlayer.id].hand.length;
        events.push({
          type: 'CARD_DRAWN',
          playerId: firstPlayer.id,
          card: drawCard,
          remainingDeckCount: s.deck.length,
        });
      }

      s.playPhase = 'TURN_INPUT';
      s.turnStartedAt = Date.now();
      s.turnExpiresAt = s.turnStartedAt + s.config.turnTimeoutSeconds * 1000;

      return { nextState: s, events };
    }

    case 'PLAY_CARD': {
      const { playerId, cardId, targetId, guessValue } = command;
      const val = validatePlayCard(s, playerId, cardId, targetId, guessValue);
      if (!val.valid) {
        throw new Error(val.error || '잘못된 카드 사용입니다.');
      }

      const player = s.players.find(p => p.id === playerId)!;
      const secret = s.secrets[playerId];
      const cardIndex = secret.hand.findIndex(c => c.id === cardId);
      const playedCard = secret.hand.splice(cardIndex, 1)[0];
      player.cardCount = secret.hand.length;
      player.discardPile.push(playedCard);

      // Reset turn player Handmaid protection when their turn acts
      player.isProtected = false;

      const actionId = `action_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      events.push({
        type: 'CARD_PLAYED',
        actionId,
        actorId: playerId,
        card: playedCard,
      });

      let summaryResultType = 'CARD_PLAYED';
      let summaryDesc = `[${player.nickname}] 님이 [${playedCard.name}] 카드를 사용했습니다.`;
      let summaryRevealed: any = undefined;
      let summaryEliminatedId: any = undefined;
      let summarySwapped: any = undefined;

      // Resolve card effect
      switch (playedCard.value) {
        case 1: { // Guard
          if (targetId) {
            const target = s.players.find(p => p.id === targetId)!;
            const targetSecret = s.secrets[targetId];
            events.push({ type: 'PLAYER_TARGETED', actionId, actorId: playerId, targetId });
            events.push({ type: 'CARD_GUESSED', actionId, actorId: playerId, targetId, guessValue: guessValue! });

            if (targetSecret && targetSecret.hand.some(c => c.value === guessValue)) {
              const victimCard = targetSecret.hand[0];
              target.isEliminated = true;
              target.eliminationReason = `경비병 저격 (${playedCard.name})`;
              target.eliminatedBy = playerId;
              target.discardPile.push(...targetSecret.hand);
              targetSecret.hand = [];
              target.cardCount = 0;

              summaryResultType = 'GUARD_SUCCESS';
              summaryDesc = `🎯 [${player.nickname}] 저격 성공! [${target.nickname}] 님이 탈락했습니다.`;
              summaryEliminatedId = targetId;
              summaryRevealed = victimCard;

              events.push({ type: 'GUARD_SUCCEEDED', actionId, actorId: playerId, targetId, guessedCard: victimCard });
              events.push({ type: 'PLAYER_ELIMINATED', playerId: targetId, reason: '경비병 저격 성공', eliminatedBy: playerId });
            } else {
              summaryResultType = 'GUARD_FAILED';
              summaryDesc = `❌ [${player.nickname}] 저격 실패! [${target.nickname}] 님은 해당 카드가 없습니다.`;
              events.push({ type: 'GUARD_FAILED', actionId, actorId: playerId, targetId, guessValue: guessValue! });
            }
          }
          break;
        }

        case 2: { // Priest
          if (targetId) {
            const target = s.players.find(p => p.id === targetId)!;
            const targetSecret = s.secrets[targetId];
            const targetCard = targetSecret?.hand[0];
            events.push({ type: 'PLAYER_TARGETED', actionId, actorId: playerId, targetId });
            if (targetCard) {
              summaryResultType = 'PRIEST_REVEAL';
              summaryDesc = `👁️ [${player.nickname}] 님이 [${target.nickname}] 님의 손패를 은밀히 확인했습니다.`;
              summaryRevealed = targetCard;
              events.push({ type: 'PRIEST_REVEALED', actionId, actorId: playerId, targetId, revealedCard: targetCard });
            }
          }
          break;
        }

        case 3: { // Baron
          if (targetId) {
            const target = s.players.find(p => p.id === targetId)!;
            const targetSecret = s.secrets[targetId];
            events.push({ type: 'PLAYER_TARGETED', actionId, actorId: playerId, targetId });

            const myCard = secret.hand[0];
            const oppCard = targetSecret?.hand[0];

            if (myCard && oppCard) {
              if (myCard.value > oppCard.value) {
                target.isEliminated = true;
                target.eliminationReason = `남작 결투 패배 (내 ${oppCard.name} < ${myCard.name})`;
                target.eliminatedBy = playerId;
                target.discardPile.push(...targetSecret.hand);
                targetSecret.hand = [];
                target.cardCount = 0;

                summaryResultType = 'BARON_WIN';
                summaryDesc = `⚔️ 남작 결투! [${player.nickname}] 승리! [${target.nickname}] (${oppCard.name}) 탈락!`;
                summaryEliminatedId = targetId;
                summaryRevealed = oppCard;

                events.push({ type: 'BARON_COMPARED', actionId, actorId: playerId, targetId, winnerId: playerId, eliminatedId: targetId });
                events.push({ type: 'PLAYER_ELIMINATED', playerId: targetId, reason: '남작 결투 패배', eliminatedBy: playerId });
              } else if (myCard.value < oppCard.value) {
                player.isEliminated = true;
                player.eliminationReason = `남작 결투 패배 (내 ${myCard.name} < ${oppCard.name})`;
                player.eliminatedBy = targetId;
                player.discardPile.push(...secret.hand);
                secret.hand = [];
                player.cardCount = 0;

                summaryResultType = 'BARON_LOSS';
                summaryDesc = `⚔️ 남작 결투! [${target.nickname}] 승리! [${player.nickname}] (${myCard.name}) 탈락!`;
                summaryEliminatedId = playerId;
                summaryRevealed = myCard;

                events.push({ type: 'BARON_COMPARED', actionId, actorId: playerId, targetId, winnerId: targetId, eliminatedId: playerId });
                events.push({ type: 'PLAYER_ELIMINATED', playerId, reason: '남작 결투 패배', eliminatedBy: targetId });
              } else {
                summaryResultType = 'BARON_TIE';
                summaryDesc = `⚔️ 남작 결투 무승부! 두 사람의 카드 숫자가 같습니다.`;
                events.push({ type: 'BARON_COMPARED', actionId, actorId: playerId, targetId });
              }
            }
          }
          break;
        }

        case 4: { // Handmaid
          player.isProtected = true;
          summaryResultType = 'HANDMAID_PROTECT';
          summaryDesc = `🌸 [${player.nickname}] 님이 하녀를 소환하여 다음 턴까지 모든 공격에 면역됩니다.`;
          events.push({ type: 'HANDMAID_PROTECTED', actionId, actorId: playerId });
          break;
        }

        case 5: { // Prince
          if (targetId) {
            const target = s.players.find(p => p.id === targetId)!;
            const targetSecret = s.secrets[targetId];
            events.push({ type: 'PLAYER_TARGETED', actionId, actorId: playerId, targetId });

            if (targetSecret && targetSecret.hand.length > 0) {
              const discarded = targetSecret.hand.pop()!;
              target.cardCount = targetSecret.hand.length;
              target.discardPile.push(discarded);
              events.push({ type: 'PRINCE_DISCARDED', actionId, actorId: playerId, targetId, discardedCard: discarded });
              events.push({ type: 'CARD_DISCARDED', playerId: targetId, card: discarded });

              if (discarded.value === 8) { // Discarded Princess -> Instant Elimination
                target.isEliminated = true;
                target.eliminationReason = '왕자의 명령으로 공주를 버림';
                target.eliminatedBy = playerId;
                summaryResultType = 'PRINCE_PRINCESS_ELIMINATED';
                summaryDesc = `👸 [${target.nickname}] 님이 왕자의 명령으로 [공주]를 버려 즉시 탈락했습니다!`;
                summaryEliminatedId = targetId;
                summaryRevealed = discarded;
                events.push({ type: 'PLAYER_ELIMINATED', playerId: targetId, reason: '왕자의 명령으로 공주 버림', eliminatedBy: playerId });
              } else {
                summaryResultType = 'PRINCE_DISCARD';
                summaryDesc = `👑 왕자의 명령! [${target.nickname}] 님이 [${discarded.name}] 카드를 버리고 새로 뽑았습니다.`;
                summaryRevealed = discarded;

                // Draw replacement card (from deck or setAsideCard if deck empty)
                const newCard = s.deck.pop() || s.setAsideCard;
                if (newCard) {
                  targetSecret.hand.push(newCard);
                  target.cardCount = targetSecret.hand.length;
                  events.push({
                    type: 'CARD_DRAWN',
                    playerId: targetId,
                    card: newCard,
                    remainingDeckCount: s.deck.length,
                  });
                }
              }
            }
          }
          break;
        }

        case 6: { // King
          if (targetId) {
            const target = s.players.find(p => p.id === targetId)!;
            const targetSecret = s.secrets[targetId];
            events.push({ type: 'PLAYER_TARGETED', actionId, actorId: playerId, targetId });

            if (secret && targetSecret && secret.hand.length > 0 && targetSecret.hand.length > 0) {
              const myCard = secret.hand[0];
              const targetCard = targetSecret.hand[0];
              secret.hand = [targetCard];
              targetSecret.hand = [myCard];

              summaryResultType = 'KING_SWAP';
              summaryDesc = `👑 국왕의 어명! [${player.nickname}] 님과 [${target.nickname}] 님의 손패가 맞바뀌었습니다.`;
              summarySwapped = true;
              events.push({ type: 'HANDS_SWAPPED', actionId, actorId: playerId, targetId });
            }
          }
          break;
        }

        case 7: { // Countess
          summaryResultType = 'COUNTESS_PLAY';
          summaryDesc = `🌹 [${player.nickname}] 님이 백작부인을 우아하게 내려놓았습니다.`;
          break;
        }

        case 8: { // Princess
          player.isEliminated = true;
          player.eliminationReason = '스스로 공주 카드를 플레이함';
          summaryResultType = 'PRINCESS_ELIMINATED';
          summaryDesc = `👸 [${player.nickname}] 님이 공주 카드를 플레이하여 즉시 탈락했습니다!`;
          summaryEliminatedId = playerId;
          summaryRevealed = playedCard;
          events.push({ type: 'PLAYER_ELIMINATED', playerId, reason: '공주 카드 자진 제출', eliminatedBy: playerId });
          break;
        }
      }

      s.lastAction = {
        actionId,
        actorId: playerId,
        card: playedCard,
        targetId,
        guessValue,
        resultType: summaryResultType,
        description: summaryDesc,
        revealedCard: summaryRevealed,
        eliminatedPlayerId: summaryEliminatedId,
        swapped: summarySwapped,
      };

      // Check round end condition
      if (isRoundOver(s)) {
        s.playPhase = 'ACTION_RESOLVING';
        s.matchState = 'ROUND_END';

        const winners = determineRoundWinners(s);
        s.roundWinnerIds = winners.map(w => w.id);

        const winnerCards: Record<PlayerId, any> = {};
        const scores: Record<PlayerId, number> = {};

        for (const w of winners) {
          w.tokens += 1;
        }

        for (const p of s.players) {
          scores[p.id] = p.tokens;
          const sec = s.secrets[p.id];
          if (sec && sec.hand.length > 0) {
            winnerCards[p.id] = sec.hand[0];
          }
        }

        events.push({
          type: 'ROUND_ENDED',
          winnerIds: s.roundWinnerIds,
          winnerCards,
          scores,
        });

        // Check match winner
        const matchWinner = s.players.find(p => p.tokens >= s.config.targetTokens);
        if (matchWinner) {
          s.matchState = 'GAME_OVER';
          s.matchWinnerId = matchWinner.id;
          events.push({
            type: 'MATCH_ENDED',
            matchWinnerId: matchWinner.id,
            finalScores: scores,
          });
        }

        return { nextState: s, events };
      }

      // Next turn transition
      const activePlayers = s.players.filter(p => !p.isEliminated);
      const currentIndex = s.players.findIndex(p => p.id === playerId);
      let nextIndex = (currentIndex + 1) % s.players.length;

      while (s.players[nextIndex].isEliminated) {
        nextIndex = (nextIndex + 1) % s.players.length;
      }

      const nextPlayer = s.players[nextIndex];
      s.currentTurnPlayerId = nextPlayer.id;
      s.playPhase = 'TURN_INPUT';
      s.turnStartedAt = Date.now();
      s.turnExpiresAt = s.turnStartedAt + s.config.turnTimeoutSeconds * 1000;

      events.push({
        type: 'TURN_ENDED',
        previousPlayerId: playerId,
        nextPlayerId: nextPlayer.id,
        turnExpiresAt: s.turnExpiresAt,
      });

      // Draw card for next player
      const nextDraw = s.deck.pop();
      if (nextDraw) {
        s.secrets[nextPlayer.id].hand.push(nextDraw);
        nextPlayer.cardCount = s.secrets[nextPlayer.id].hand.length;
        events.push({
          type: 'CARD_DRAWN',
          playerId: nextPlayer.id,
          card: nextDraw,
          remainingDeckCount: s.deck.length,
        });
      }

      return { nextState: s, events };
    }

    default:
      return { nextState: s, events };
  }
}
