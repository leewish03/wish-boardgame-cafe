import { GameState, PlayerId, CardInstance, CardValue } from './types';
import { GameCommand } from './commands';
import { GameEvent } from './events';
import { createDeck, CARD_DEFINITIONS } from './cards';
import { validatePlayCard } from './rules';
import { isRoundOver, isMatchOver, determineRoundWinners, getActivePlayers } from './selectors';

export interface EngineResult {
  nextState: GameState;
  events: GameEvent[];
}

export function resolveCommand(state: GameState, command: GameCommand): EngineResult {
  const events: GameEvent[] = [];
  const s: GameState = JSON.parse(JSON.stringify(state));
  s.stateVersion = (s.stateVersion || 0) + 1;

  switch (command.type) {
    case 'START_MATCH': {
      if (s.players.length < s.config.minPlayers) {
        throw new Error(`최소 ${s.config.minPlayers}명 이상의 플레이어가 필요합니다.`);
      }
      s.matchState = 'PLAYING';
      s.roundNumber = 0;
      s.matchWinnerId = null;
      s.roundWinnerIds = [];
      s.outcome = null;
      for (const p of s.players) {
        p.tokens = 0;
      }
      if (command.config) {
        s.config = { ...s.config, ...command.config };
      }
      return resolveCommand(s, { type: 'START_ROUND' });
    }

    case 'START_ROUND': {
      s.roundNumber = (s.roundNumber || 0) + 1;
      s.matchState = 'PLAYING';
      s.playPhase = 'ROUND_START';
      s.lastAction = null;
      s.outcome = null;

      // Reset round state for all players
      for (const p of s.players) {
        p.isEliminated = false;
        p.isProtected = false;
        p.discardPile = [];
        p.cardCount = 0;
        delete p.eliminationReason;
        delete p.eliminatedBy;
        s.secrets[p.id] = { id: p.id, hand: [] };
      }

      // Generate & shuffle deck
      const deck = createDeck(s.players.length);
      s.setAsideCard = deck.pop() || null;
      s.setAsideOpenCards = [];
      s.deck = deck;

      // Deal 1 card each
      for (const p of s.players) {
        const card = s.deck.pop();
        if (card) {
          s.secrets[p.id].hand.push(card);
          p.cardCount = 1;
        }
      }

      // Pick first player: previous round winner if alive, else host/first player
      let firstPlayerId = s.players[0].id;
      if (
        s.roundWinnerIds &&
        s.roundWinnerIds.length > 0 &&
        s.players.some(p => p.id === s.roundWinnerIds[0])
      ) {
        firstPlayerId = s.roundWinnerIds[0];
      } else {
        const host = s.players.find(p => p.isHost);
        firstPlayerId = host ? host.id : s.players[0].id;
      }

      s.currentTurnPlayerId = firstPlayerId;
      s.roundWinnerIds = [];

      events.push({
        type: 'ROUND_STARTED',
        roundNumber: s.roundNumber,
        firstPlayerId,
        remainingDeckCount: s.deck.length,
      });

      // Draw turn card for starting player
      const drawCard = s.deck.pop();
      const firstPlayer = s.players.find(p => p.id === firstPlayerId)!;
      if (drawCard) {
        s.secrets[firstPlayerId].hand.push(drawCard);
        firstPlayer.cardCount = s.secrets[firstPlayerId].hand.length;
        events.push({
          type: 'CARD_DRAWN',
          playerId: firstPlayerId,
          card: drawCard,
          remainingDeckCount: s.deck.length,
        });
      }

      s.playPhase = 'TURN_INPUT';
      s.turnStartedAt = Date.now();
      s.turnExpiresAt = s.turnStartedAt + s.config.turnTimeoutSeconds * 1000;

      events.push({
        type: 'TURN_STARTED',
        playerId: firstPlayerId,
        turnExpiresAt: s.turnExpiresAt,
        remainingDeckCount: s.deck.length,
      });

      return { nextState: s, events };
    }

    case 'PLAY_CARD': {
      const { playerId, cardId, targetId, guessValue } = command;
      const validation = validatePlayCard(s, playerId, cardId, targetId, guessValue);
      if (!validation.valid) {
        throw new Error(validation.error || '유효하지 않은 카드 플레이입니다.');
      }

      const player = s.players.find(p => p.id === playerId)!;
      const secret = s.secrets[playerId];
      const cardIndex = secret.hand.findIndex(c => c.id === cardId);
      const playedCard = secret.hand.splice(cardIndex, 1)[0];
      player.cardCount = secret.hand.length;
      player.discardPile.push(playedCard);

      // Remove turn player's Handmaid protection on their turn
      player.isProtected = false;

      const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      events.push({
        type: 'CARD_PLAYED',
        actionId,
        actorId: playerId,
        card: playedCard,
      });

      let summaryResultType = 'CARD_PLAYED';
      let summaryDesc = `[${player.nickname}] 님이 [${playedCard.name}] 카드를 사용했습니다.`;
      let summaryRevealed: CardInstance | null = null;
      let summaryEliminatedId: PlayerId | null = null;
      let summarySwapped = false;

      // Resolve card effect
      switch (playedCard.value) {
        case 1: { // Guard
          if (targetId) {
            const target = s.players.find(p => p.id === targetId);
            const targetSecret = s.secrets[targetId];
            if (target && !target.isEliminated && !target.isProtected && targetSecret) {
              events.push({ type: 'PLAYER_TARGETED', actionId, actorId: playerId, targetId });
              events.push({ type: 'GUARD_GUESSED', actionId, actorId: playerId, targetId, guessValue: guessValue! });
              events.push({ type: 'CARD_GUESSED', actionId, actorId: playerId, targetId, guessValue: guessValue! });

              const targetCard = targetSecret.hand[0];
              if (targetCard && targetCard.value === guessValue) {
                target.isEliminated = true;
                target.eliminationReason = `경비병 저격 (${playedCard.name})`;
                target.eliminatedBy = playerId;
                target.discardPile.push(...targetSecret.hand);
                targetSecret.hand = [];
                target.cardCount = 0;

                summaryResultType = 'GUARD_SUCCESS';
                summaryDesc = `[${player.nickname}] 지목 성공 · [${target.nickname}] 님의 카드는 [${CARD_DEFINITIONS[guessValue!]?.name || guessValue}] · 탈락`;
                summaryEliminatedId = targetId;
                summaryRevealed = targetCard;

                events.push({ type: 'GUARD_SUCCESS', actionId, actorId: playerId, targetId, guessedCard: targetCard });
                events.push({ type: 'GUARD_SUCCEEDED', actionId, actorId: playerId, targetId, guessedCard: targetCard });
                events.push({ type: 'PLAYER_ELIMINATED', actionId, sequence: events.length, playerId: targetId, reason: '경비병 저격 성공', eliminatedBy: playerId });
              } else {
                summaryResultType = 'GUARD_FAILED';
                summaryDesc = `[${player.nickname}] 지목 실패 · [${target.nickname}] 님은 [${CARD_DEFINITIONS[guessValue!]?.name || guessValue}] 카드가 없습니다.`;
                events.push({ type: 'GUARD_FAILED', actionId, actorId: playerId, targetId, guessValue: guessValue! });
              }
            }
          } else {
            summaryResultType = 'TARGET_INVALID_NOOP';
            summaryDesc = '지목 가능한 상대가 없어 경비병 효과가 무효화되었습니다.';
          }
          break;
        }

        case 2: { // Priest
          if (targetId) {
            const target = s.players.find(p => p.id === targetId);
            const targetSecret = s.secrets[targetId];
            if (target && !target.isEliminated && !target.isProtected && targetSecret) {
              events.push({ type: 'PLAYER_TARGETED', actionId, actorId: playerId, targetId });
              const targetCard = targetSecret.hand[0];
              if (targetCard) {
                summaryResultType = 'PRIEST_REVEAL';
                summaryDesc = `[${player.nickname}] 님이 [${target.nickname}] 님의 손패를 확인했습니다.`;
                summaryRevealed = targetCard;
                events.push({ type: 'PRIEST_USED', actionId, actorId: playerId, targetId, revealedCard: targetCard });
                events.push({ type: 'PRIEST_REVEALED', actionId, actorId: playerId, targetId, revealedCard: targetCard });
              }
            }
          } else {
            summaryResultType = 'TARGET_INVALID_NOOP';
            summaryDesc = '지목 가능한 상대가 없어 사제 효과가 무효화되었습니다.';
          }
          break;
        }

        case 3: { // Baron
          if (targetId) {
            const target = s.players.find(p => p.id === targetId);
            const targetSecret = s.secrets[targetId];
            if (target && !target.isEliminated && !target.isProtected && targetSecret) {
              events.push({ type: 'PLAYER_TARGETED', actionId, actorId: playerId, targetId });

              const myCard = secret.hand[0];
              const oppCard = targetSecret.hand[0];

              if (myCard && oppCard) {
                if (myCard.value > oppCard.value) {
                  target.isEliminated = true;
                  target.eliminationReason = `남작 결투 패배 (${oppCard.name} < ${myCard.name})`;
                  target.eliminatedBy = playerId;
                  target.discardPile.push(...targetSecret.hand);
                  targetSecret.hand = [];
                  target.cardCount = 0;

                  summaryResultType = 'BARON_WIN';
                  summaryDesc = `남작 비교 · [${player.nickname}] 승리 · [${target.nickname}] (${oppCard.name}) 탈락`;
                  summaryEliminatedId = targetId;
                  summaryRevealed = oppCard;

                  events.push({
                    type: 'BARON_DUEL_STARTED',
                    actionId,
                    actorId: playerId,
                    targetId,
                    winnerId: playerId,
                    eliminatedId: targetId,
                  });
                  events.push({
                    type: 'BARON_COMPARED',
                    actionId,
                    actorId: playerId,
                    targetId,
                    winnerId: playerId,
                    eliminatedId: targetId,
                  });
                  events.push({
                    type: 'PLAYER_ELIMINATED', actionId, sequence: events.length,
                    playerId: targetId,
                    reason: '남작 결투 패배',
                    eliminatedBy: playerId,
                  });
                } else if (myCard.value < oppCard.value) {
                  player.isEliminated = true;
                  player.eliminationReason = `남작 결투 패배 (${myCard.name} < ${oppCard.name})`;
                  player.eliminatedBy = targetId;
                  player.discardPile.push(...secret.hand);
                  secret.hand = [];
                  player.cardCount = 0;

                  summaryResultType = 'BARON_LOSS';
                  summaryDesc = `남작 비교 · [${target.nickname}] 승리 · [${player.nickname}] (${myCard.name}) 탈락`;
                  summaryEliminatedId = playerId;
                  summaryRevealed = myCard;

                  events.push({
                    type: 'BARON_DUEL_STARTED',
                    actionId,
                    actorId: playerId,
                    targetId,
                    winnerId: targetId,
                    eliminatedId: playerId,
                  });
                  events.push({
                    type: 'BARON_COMPARED',
                    actionId,
                    actorId: playerId,
                    targetId,
                    winnerId: targetId,
                    eliminatedId: playerId,
                  });
                  events.push({
                    type: 'PLAYER_ELIMINATED', actionId, sequence: events.length,
                    playerId,
                    reason: '남작 결투 패배',
                    eliminatedBy: targetId,
                  });
                } else {
                  summaryResultType = 'BARON_TIE';
                  summaryDesc = `남작 비교 · [${player.nickname}] 와 [${target.nickname}] 의 카드 숫자가 같습니다.`;
                  events.push({
                    type: 'BARON_DUEL_STARTED',
                    actionId,
                    actorId: playerId,
                    targetId,
                    isTie: true,
                  });
                  events.push({
                    type: 'BARON_COMPARED',
                    actionId,
                    actorId: playerId,
                    targetId,
                    isTie: true,
                  });
                }
              }
            }
          } else {
            summaryResultType = 'TARGET_INVALID_NOOP';
            summaryDesc = '지목 가능한 상대가 없어 남작 효과가 무효화되었습니다.';
          }
          break;
        }

        case 4: { // Handmaid
          player.isProtected = true;
          summaryResultType = 'HANDMAID_PROTECT';
          summaryDesc = `[${player.nickname}] 님은 다음 내 차례까지 보호됩니다.`;
          events.push({ type: 'PLAYER_PROTECTED', actionId, actorId: playerId });
          events.push({ type: 'HANDMAID_PROTECTED', actionId, actorId: playerId });
          break;
        }

        case 5: { // Prince
          const princeTargetId = targetId || playerId;
          const target = s.players.find(p => p.id === princeTargetId);
          const targetSecret = s.secrets[princeTargetId];

          if (target && !target.isEliminated && targetSecret && targetSecret.hand.length > 0) {
            events.push({ type: 'PLAYER_TARGETED', actionId, actorId: playerId, targetId: princeTargetId });

            const discarded = targetSecret.hand.pop()!;
            target.cardCount = targetSecret.hand.length;
            target.discardPile.push(discarded);
            events.push({ type: 'PRINCE_DISCARDED', actionId, actorId: playerId, targetId: princeTargetId, discardedCard: discarded });
            events.push({ type: 'CARD_DISCARDED', playerId: princeTargetId, card: discarded });

            if (discarded.value === 8) { // Discarded Princess -> Instant Elimination
              target.isEliminated = true;
              target.eliminationReason = '왕자의 명령으로 공주를 버림';
              target.eliminatedBy = playerId;
              summaryResultType = 'PRINCE_PRINCESS_ELIMINATED';
              summaryDesc = `공주 카드가 버려져 [${target.nickname}] 님이 탈락했습니다.`;
              summaryEliminatedId = princeTargetId;
              summaryRevealed = discarded;
              events.push({ type: 'PLAYER_ELIMINATED', actionId, sequence: events.length, playerId: princeTargetId, reason: '왕자의 명령으로 공주 버림', eliminatedBy: playerId });
            } else {
              summaryResultType = 'PRINCE_DISCARD';
              summaryDesc = `[${target.nickname}] 님이 [${discarded.name}] 카드를 버리고 새로 뽑았습니다.`;
              summaryRevealed = discarded;

              // Draw new card (from deck or setAsideCard if deck empty)
              let newCard: CardInstance | null = null;
              let drawSource: 'DECK' | 'SET_ASIDE' = 'DECK';
              if (s.deck.length > 0) {
                newCard = s.deck.pop()!;
              } else if (s.setAsideCard) {
                newCard = s.setAsideCard;
                s.setAsideCard = null;
                drawSource = 'SET_ASIDE';
              }

              if (newCard) {
                targetSecret.hand.push(newCard);
                target.cardCount = targetSecret.hand.length;
                events.push({
                  type: 'CARD_DRAWN',
                  playerId: princeTargetId,
                  card: newCard,
                  remainingDeckCount: s.deck.length,
                  drawSource,
                });
              }
            }
          }
          break;
        }

        case 6: { // King
          if (targetId) {
            const target = s.players.find(p => p.id === targetId);
            const targetSecret = s.secrets[targetId];

            if (target && !target.isEliminated && !target.isProtected && targetSecret) {
              events.push({ type: 'PLAYER_TARGETED', actionId, actorId: playerId, targetId });

              if (secret.hand.length > 0 && targetSecret.hand.length > 0) {
                const myCard = secret.hand[0];
                const targetCard = targetSecret.hand[0];
                secret.hand = [targetCard];
                targetSecret.hand = [myCard];

                summaryResultType = 'KING_SWAP';
                summaryDesc = `[${player.nickname}] 와 [${target.nickname}] 의 손패가 교환되었습니다.`;
                summarySwapped = true;

                events.push({ type: 'KING_SWAP', actionId, actorId: playerId, targetId });
                events.push({ type: 'HANDS_SWAPPED', actionId, actorId: playerId, targetId });
              }
            }
          } else {
            summaryResultType = 'TARGET_INVALID_NOOP';
            summaryDesc = '지목 가능한 상대가 없어 국왕 효과가 무효화되었습니다.';
          }
          break;
        }

        case 7: { // Countess
          summaryResultType = 'COUNTESS_PLAY';
          summaryDesc = `[${player.nickname}] 님이 백작부인을 사용했습니다.`;
          break;
        }

        case 8: { // Princess
          player.isEliminated = true;
          player.eliminationReason = '스스로 공주 카드를 플레이함';
          player.eliminatedBy = playerId;
          summaryResultType = 'PRINCESS_ELIMINATED';
          summaryDesc = `[${player.nickname}] 님이 공주 카드를 사용해 탈락했습니다.`;
          summaryEliminatedId = playerId;
          summaryRevealed = playedCard;
          events.push({ type: 'PLAYER_ELIMINATED', actionId, sequence: events.length, playerId, reason: '공주 카드 자진 제출', eliminatedBy: playerId });
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
        s.playPhase = 'ROUND_END';
        s.matchState = 'ROUND_END';

        const winners = determineRoundWinners(s);
        s.roundWinnerIds = winners.map(w => w.id);

        const winnerCards: Record<PlayerId, CardInstance> = {};
        const scores: Record<PlayerId, number> = {};
        const previousScores: Record<PlayerId, number> = {};

        for (const p of s.players) previousScores[p.id] = p.tokens || 0;

        for (const w of winners) {
          w.tokens = (w.tokens || 0) + 1;
        }

        for (const p of s.players) {
          scores[p.id] = p.tokens;
          const sec = s.secrets[p.id];
          if (sec && sec.hand.length > 0) {
            winnerCards[p.id] = sec.hand[0];
          }
        }

        const reason =
          getActivePlayers(s).length <= 1
            ? '마지막 생존자 승리!'
            : winners.length === 1
            ? '덱 소진! 최고 카드 보유 승리!'
            : '덱 소진! 최고점 공동 승리!';

        s.roundWinnerReason = reason;
        const normalizedReason = getActivePlayers(s).length <= 1 ? 'LAST_SURVIVOR' : winners.length === 1 ? 'DECK_EXHAUSTED' : 'TIE_BREAK';
        s.outcome = { kind: 'ROUND', reason: normalizedReason, winnerIds: s.roundWinnerIds, winnerCards, scores, previousScores, nextStarterId: s.roundWinnerIds[0] || null, advanceAt: null };

        events.push({
          type: 'ROUND_ENDED',
          winnerIds: s.roundWinnerIds,
          winnerCards,
          scores,
          reason,
        });

        // Check match winner
        if (isMatchOver(s)) {
          const matchWinner = s.players.find(p => p.tokens >= s.config.targetTokens) || winners[0];
          s.matchState = 'GAME_OVER';
          s.playPhase = 'GAME_OVER';
          s.matchWinnerId = matchWinner.id;
          s.outcome = { kind: 'MATCH', reason: normalizedReason, winnerIds: [matchWinner.id], winnerCards, scores, previousScores, nextStarterId: null, advanceAt: null };

          events.push({
            type: 'MATCH_ENDED',
            matchWinnerId: matchWinner.id,
            finalScores: scores,
          });
        }

        return { nextState: s, events };
      }

      // Pass turn to next uneliminated player
      const currentIndex = s.players.findIndex(p => p.id === playerId);
      let nextIndex = (currentIndex + 1) % s.players.length;
      let loop = 0;
      while (s.players[nextIndex].isEliminated && loop < s.players.length * 2) {
        nextIndex = (nextIndex + 1) % s.players.length;
        loop++;
      }

      const nextPlayer = s.players[nextIndex];
      s.currentTurnPlayerId = nextPlayer.id;

      // Remove protection when turn starts
      nextPlayer.isProtected = false;

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
      if (s.deck.length > 0) {
        const nextDraw = s.deck.pop()!;
        s.secrets[nextPlayer.id].hand.push(nextDraw);
        nextPlayer.cardCount = s.secrets[nextPlayer.id].hand.length;
        events.push({
          type: 'CARD_DRAWN',
          playerId: nextPlayer.id,
          card: nextDraw,
          remainingDeckCount: s.deck.length,
        });
      }

      events.push({
        type: 'TURN_STARTED',
        playerId: nextPlayer.id,
        turnExpiresAt: s.turnExpiresAt,
        remainingDeckCount: s.deck.length,
      });

      return { nextState: s, events };
    }

    case 'FORFEIT':
    case 'TIMEOUT_FORFEIT':
    case 'PLAYER_LEAVE': {
      const { playerId } = command;
      const player = s.players.find(p => p.id === playerId);
      if (!player || player.isEliminated) {
        return { nextState: s, events };
      }

      player.isEliminated = true;
      player.eliminationReason = command.type === 'TIMEOUT_FORFEIT' ? '시간 초과 기권' : '게임 포기';
      const secret = s.secrets[playerId];
      if (secret && secret.hand.length > 0) {
        player.discardPile.push(...secret.hand);
        secret.hand = [];
        player.cardCount = 0;
      }

      events.push({
        type: 'PLAYER_ELIMINATED',
        playerId,
        reason: player.eliminationReason,
      });

      // A multiplayer match is only meaningful while at least two humans remain.
      // Bots are table-fillers, never a replacement for a departed person.
      const remainingHumans = s.players.filter((candidate) => !candidate.isBot && !candidate.isEliminated);
      if (remainingHumans.length <= 1) {
        const scores: Record<PlayerId, number> = {};
        const previousScores: Record<PlayerId, number> = {};
        for (const candidate of s.players) {
          scores[candidate.id] = candidate.tokens || 0;
          previousScores[candidate.id] = candidate.tokens || 0;
        }
        s.matchState = 'GAME_OVER';
        s.playPhase = 'GAME_OVER';
        s.currentTurnPlayerId = null;
        s.roundWinnerIds = [];
        s.roundWinnerReason = '참가자 부족으로 게임이 종료되었습니다.';
        s.matchWinnerId = null;
        s.outcome = {
          kind: 'MATCH',
          reason: 'INSUFFICIENT_HUMANS',
          winnerIds: [],
          winnerCards: {},
          scores,
          previousScores,
          nextStarterId: null,
          advanceAt: null,
        };
        events.push({
          type: 'MATCH_ENDED',
          matchWinnerId: null,
          finalScores: scores,
          reason: 'INSUFFICIENT_HUMANS',
        });
        return { nextState: s, events };
      }

      if (isRoundOver(s)) {
        s.playPhase = 'ROUND_END';
        s.matchState = 'ROUND_END';

        const winners = determineRoundWinners(s);
        s.roundWinnerIds = winners.map(w => w.id);
        const winnerCards: Record<PlayerId, CardInstance> = {};
        const scores: Record<PlayerId, number> = {};
        const previousScores: Record<PlayerId, number> = {};

        for (const p of s.players) previousScores[p.id] = p.tokens || 0;

        for (const w of winners) {
          w.tokens = (w.tokens || 0) + 1;
        }

        for (const p of s.players) {
          scores[p.id] = p.tokens;
          const sec = s.secrets[p.id];
          if (sec && sec.hand.length > 0) {
            winnerCards[p.id] = sec.hand[0];
          }
        }

        s.roundWinnerReason = '상대 탈락으로 인한 라운드 승리';
        s.outcome = { kind: 'ROUND', reason: 'FORFEIT', winnerIds: s.roundWinnerIds, winnerCards, scores, previousScores, nextStarterId: s.roundWinnerIds[0] || null, advanceAt: null };
        events.push({
          type: 'ROUND_ENDED',
          winnerIds: s.roundWinnerIds,
          winnerCards,
          scores,
          reason: '상대 탈락으로 인한 라운드 승리',
        });

        if (isMatchOver(s)) {
          const matchWinner = s.players.find(p => p.tokens >= s.config.targetTokens) || winners[0];
          s.matchState = 'GAME_OVER';
          s.playPhase = 'GAME_OVER';
          s.matchWinnerId = matchWinner ? matchWinner.id : null;

          if (s.matchWinnerId) s.outcome = { kind: 'MATCH', reason: 'FORFEIT', winnerIds: [s.matchWinnerId], winnerCards, scores, previousScores, nextStarterId: null, advanceAt: null };

          if (s.matchWinnerId) {
            events.push({
              type: 'MATCH_ENDED',
              matchWinnerId: s.matchWinnerId,
              finalScores: scores,
            });
          }
        }

        return { nextState: s, events };
      }

      // If eliminated player was turn player, pass turn to next
      if (s.currentTurnPlayerId === playerId) {
        const currentIndex = s.players.findIndex(p => p.id === playerId);
        let nextIndex = (currentIndex + 1) % s.players.length;
        let loop = 0;
        while (s.players[nextIndex].isEliminated && loop < s.players.length * 2) {
          nextIndex = (nextIndex + 1) % s.players.length;
          loop++;
        }

        const nextPlayer = s.players[nextIndex];
        s.currentTurnPlayerId = nextPlayer.id;
        nextPlayer.isProtected = false;

        s.playPhase = 'TURN_INPUT';
        s.turnStartedAt = Date.now();
        s.turnExpiresAt = s.turnStartedAt + s.config.turnTimeoutSeconds * 1000;

        if (s.deck.length > 0) {
          const nextDraw = s.deck.pop()!;
          s.secrets[nextPlayer.id].hand.push(nextDraw);
          nextPlayer.cardCount = s.secrets[nextPlayer.id].hand.length;
          events.push({
            type: 'CARD_DRAWN',
            playerId: nextPlayer.id,
            card: nextDraw,
            remainingDeckCount: s.deck.length,
          });
        }

        events.push({
          type: 'TURN_STARTED',
          playerId: nextPlayer.id,
          turnExpiresAt: s.turnExpiresAt,
          remainingDeckCount: s.deck.length,
        });
      }

      return { nextState: s, events };
    }

    default:
      return { nextState: s, events };
  }
}

export const executeCommand = resolveCommand;
