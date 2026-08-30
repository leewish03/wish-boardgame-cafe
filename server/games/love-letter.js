// =========================================================================
// Love Letter Game Engine Module (All 8 Cards, Edge Cases, Authoritative Rules)
// =========================================================================

import { rooms, socketToUser, broadcastRoomState } from '../shared/roomManager.js';

export const CARD_DEFS = {
  1: { value: 1, name: '경비병', nameEn: 'Guard', count: 5, color: '#3182CE', icon: '🛡️', desc: '상대 1명을 지목하여 2~8번 카드를 추측합니다. 일치 시 상대 탈락!' },
  2: { value: 2, name: '사제', nameEn: 'Priest', count: 2, color: '#4FD1C5', icon: '📜', desc: '상대 1명을 지목하여 그 사람의 손패를 비밀리에 확인합니다.' },
  3: { value: 3, name: '남작', nameEn: 'Baron', count: 2, color: '#9F7AEA', icon: '⚔️', desc: '상대 1명과 비밀리에 손패 숫자를 비교하여 더 낮은 쪽이 탈락합니다.' },
  4: { value: 4, name: '하녀', nameEn: 'Handmaid', count: 2, color: '#68D391', icon: '🌸', desc: '다음 내 턴 시작 전까지 다른 플레이어의 모든 카드 효과로부터 면역 보호됩니다.' },
  5: { value: 5, name: '왕자', nameEn: 'Prince', count: 2, color: '#ECC94B', icon: '👑', desc: '자신 포함 1명을 지목하여 손패를 버리고 새로 1장 드로우하게 합니다. (공주 버려지면 탈락)' },
  6: { value: 6, name: '국왕', nameEn: 'King', count: 1, color: '#ED8936', icon: '🤴', desc: '상대 1명을 지목하여 자신의 손패와 상대의 손패를 맞교환합니다.' },
  7: { value: 7, name: '백작부인', nameEn: 'Countess', count: 1, color: '#F687B3', icon: '🌹', desc: '손에 왕자(5)나 국왕(6)이 함께 있을 경우, 반드시 백작부인을 먼저 내려놓아야 합니다.' },
  8: { value: 8, name: '공주', nameEn: 'Princess', count: 1, color: '#E53E3E', icon: '👸', desc: '이 카드를 내거나 어떤 이유로든 버려지면 즉시 게임에서 탈락합니다.' },
};

export function generateDeck(playerCount = 4) {
  const deck = [];
  const baseCounts = { 1: 5, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1 };

  if (playerCount >= 5) {
    baseCounts[1] += 2;
    baseCounts[2] += 1;
    baseCounts[3] += 1;
    baseCounts[4] += 1;
    baseCounts[5] += 1;
  }

  Object.entries(baseCounts).forEach(([val, cnt]) => {
    const num = parseInt(val, 10);
    for (let i = 0; i < cnt; i++) {
      deck.push({
        ...CARD_DEFS[num],
        id: `card_${num}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      });
    }
  });

  // Fisher-Yates Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export function startRound(io, room) {
  if (!room) return;

  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
  if (room.pauseTimeout) {
    clearTimeout(room.pauseTimeout);
    room.pauseTimeout = null;
  }

  room.isPaused = false;
  room.pausedPlayerId = null;
  room.pauseExpiresAt = null;
  room.savedTurnRemainingMs = null;

  room.gameState = 'PLAYING';
  room.roundWinner = null;

  // Reset players for new round
  room.players.forEach((p) => {
    p.isEliminated = false;
    p.isProtected = false;
    p.hand = [];
    p.discardPile = [];
  });

  const deck = generateDeck(room.players.length);

  // 1 secret card set aside
  room.setAsideSecretCard = deck.pop();
  room.setAsideOpenCards = [];

  // If 2 players, 3 cards face up
  if (room.players.length === 2) {
    room.setAsideOpenCards = [deck.pop(), deck.pop(), deck.pop()];
  }

  // Deal 1 card each
  room.players.forEach((p) => {
    p.hand.push(deck.pop());
  });

  room.deck = deck;

  // Decide first player
  if (!room.turnPlayerId || !room.players.some((p) => p.id === room.turnPlayerId)) {
    room.turnPlayerId = room.hostId;
  }

  logAction(room, `=== 라운드 ${room.roundNumber} 시작! ===`);
  broadcastRoomState(io, room.code);

  startTurn(io, room);
}

export function startTurn(io, room) {
  if (!room || room.gameState !== 'PLAYING') return;

  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }

  const turnPlayer = room.players.find((p) => p.id === room.turnPlayerId);
  if (!turnPlayer || turnPlayer.isEliminated) {
    passTurnToNextPlayer(io, room);
    return;
  }

  // Remove Handmaid protection when player's turn starts
  turnPlayer.isProtected = false;

  // Draw 1 card if deck has cards
  if (room.deck.length > 0) {
    const drawn = room.deck.pop();
    turnPlayer.hand.push(drawn);
  }

  room.turnStartTime = Date.now();
  logAction(room, `[${turnPlayer.nickname}] 님의 턴입니다. (남은 덱: ${room.deck.length}장)`);
  broadcastRoomState(io, room.code);

  // Auto-play timer fallback if limit set
  if (room.turnTimeLimit && room.turnTimeLimit > 0) {
    room.turnTimer = setTimeout(() => {
      autoPlayTimeout(io, room, turnPlayer.id);
    }, (room.turnTimeLimit + 2) * 1000);
  }
}

export function passTurnToNextPlayer(io, room) {
  const alivePlayers = room.players.filter((p) => !p.isEliminated);

  // Check 1: Only 1 player left alive
  if (alivePlayers.length <= 1) {
    endRound(io, room, alivePlayers[0] || null, '마지막 생존자 승리!');
    return;
  }

  // Check 2: Deck is empty
  if (room.deck.length === 0) {
    // Compare highest remaining card value
    let highestVal = -1;
    let candidates = [];

    alivePlayers.forEach((p) => {
      const cardVal = p.hand[0]?.value || 0;
      if (cardVal > highestVal) {
        highestVal = cardVal;
        candidates = [p];
      } else if (cardVal === highestVal) {
        candidates.push(p);
      }
    });

    if (candidates.length === 1) {
      endRound(io, room, candidates[0], `덱 소진! 최고 카드(${CARD_DEFS[highestVal]?.name}) 보유 승리!`);
    } else {
      // Tie-break: sum of discard piles
      let bestSum = -1;
      let tieWinner = candidates[0];
      candidates.forEach((c) => {
        const sum = c.discardPile.reduce((acc, card) => acc + card.value, 0);
        if (sum > bestSum) {
          bestSum = sum;
          tieWinner = c;
        }
      });
      endRound(io, room, tieWinner, `덱 소진 동점 판정! 버린 카드 점수 총합 승리!`);
    }
    return;
  }

  // Move to next alive player
  const currentIndex = room.players.findIndex((p) => p.id === room.turnPlayerId);
  let nextIndex = (currentIndex + 1) % room.players.length;

  while (room.players[nextIndex].isEliminated) {
    nextIndex = (nextIndex + 1) % room.players.length;
  }

  room.turnPlayerId = room.players[nextIndex].id;
  startTurn(io, room);
}

export function endRound(io, room, winner, reason) {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }

  room.gameState = 'ROUND_END';

  if (winner) {
    winner.tokens = (winner.tokens || 0) + 1;
    room.roundWinner = {
      id: winner.id,
      nickname: winner.nickname,
      avatarUrl: winner.avatarUrl,
      reason,
      tokens: winner.tokens,
    };
    logAction(room, `🎉 [${winner.nickname}] 라운드 승리! (토큰 ${winner.tokens}/${room.targetTokens}개) - ${reason}`);

    // Check game over
    if (winner.tokens >= room.targetTokens) {
      room.gameState = 'GAME_OVER';
      room.gameWinner = {
        id: winner.id,
        nickname: winner.nickname,
        avatarUrl: winner.avatarUrl,
        tokens: winner.tokens,
      };
      logAction(room, `🏆 [${winner.nickname}] 최종 우승!`);
    }
  }

  broadcastRoomState(io, room.code);
}

export function autoPlayTimeout(io, room, userId) {
  if (!room || room.isPaused) return;
  const player = room.players.find((p) => p.id === userId);
  if (!player || player.isEliminated || room.turnPlayerId !== userId) return;

  // If holding Countess and (Prince or King), MUST play Countess
  const countessIdx = player.hand.findIndex((c) => c.value === 7);
  const hasRoyal = player.hand.some((c) => c.value === 5 || c.value === 6);

  let playCardIdx = 0;
  if (countessIdx !== -1 && hasRoyal) {
    playCardIdx = countessIdx;
  } else {
    // Avoid playing Princess (8) if possible
    const nonPrincessIdx = player.hand.findIndex((c) => c.value !== 8);
    playCardIdx = nonPrincessIdx !== -1 ? nonPrincessIdx : 0;
  }

  const cardToPlay = player.hand[playCardIdx];
  const otherAlive = room.players.filter((p) => p.id !== userId && !p.isEliminated && !p.isProtected);
  const targetId = otherAlive.length > 0 ? otherAlive[0].id : null;

  executePlayCard(io, room, userId, {
    cardId: cardToPlay.id,
    targetUserId: targetId,
    guessValue: 2, // Default guess Priest
  });
}

export function executePlayCard(io, room, userId, payload) {
  if (!room) return { success: false, error: '방이 존재하지 않습니다.' };
  if (room.isPaused) {
    return { success: false, error: '게임이 일시정지 상태입니다. (플레이어 재접속 대기 중)' };
  }
  const { cardId, targetUserId, guessValue } = payload || {};
  const player = room.players.find((p) => p.id === userId);

  if (!player || player.isEliminated || room.turnPlayerId !== userId) {
    return { success: false, error: '현재 당신의 턴이 아닙니다.' };
  }

  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    return { success: false, error: '손패에 해당 카드가 없습니다.' };
  }

  const card = player.hand[cardIndex];

  // Countess Rule: if hand has Prince (5) or King (6), cannot play Prince or King
  const hasCountess = player.hand.some((c) => c.value === 7);
  if (hasCountess && (card.value === 5 || card.value === 6)) {
    return {
      success: false,
      error: '백작부인(7)을 손에 쥐고 있을 때 왕자(5)나 국왕(6)을 낼 수 없습니다.',
    };
  }

  // Remove played card from hand and push to discardPile
  player.hand.splice(cardIndex, 1);
  player.discardPile.push(card);

  // Validate Target Player
  let target = targetUserId ? room.players.find((p) => p.id === targetUserId) : null;
  if (target && (target.isEliminated || (target.isProtected && target.id !== player.id))) {
    target = null; // invalid target or protected
  }

  logAction(room, `[${player.nickname}] 님이 [${card.name}(${card.value})] 카드를 냈습니다.`);

  // 1. Guard (1)
  if (card.value === 1) {
    if (!target) {
      logAction(room, `지목 가능한 상대가 없어 경비병 효과가 무효화되었습니다.`);
    } else {
      const guess = Number(guessValue);
      if (guess >= 2 && guess <= 8) {
        const targetCard = target.hand[0];
        if (targetCard && targetCard.value === guess) {
          target.isEliminated = true;
          target.discardPile.push(...target.hand);
          target.hand = [];
          logAction(
            room,
            `🎯 [${player.nickname}] 저격 성공! [${target.nickname}] 님의 카드는 [${CARD_DEFS[guess]?.name}]였습니다! 탈락!`
          );
        } else {
          logAction(
            room,
            `❌ [${player.nickname}] 저격 실패! [${target.nickname}] 님은 [${CARD_DEFS[guess]?.name}]를 가지고 있지 않습니다.`
          );
        }
      }
    }
  }

  // 2. Priest (2)
  else if (card.value === 2) {
    if (!target) {
      logAction(room, `지목 가능한 상대가 없어 사제 효과가 무효화되었습니다.`);
    } else {
      const targetCard = target.hand[0];
      if (targetCard && player.socketId) {
        io.to(player.socketId).emit('game:priest-result', {
          targetUserId: target.id,
          targetNickname: target.nickname,
          card: targetCard,
        });
        logAction(room, `👁️ [${player.nickname}] 님이 [${target.nickname}] 님의 손패를 비밀리에 확인했습니다.`);
      }
    }
  }

  // 3. Baron (3)
  else if (card.value === 3) {
    if (!target) {
      logAction(room, `지목 가능한 상대가 없어 남작 효과가 무효화되었습니다.`);
    } else {
      const myCard = player.hand[0];
      const targetCard = target.hand[0];

      if (myCard && targetCard) {
        if (myCard.value > targetCard.value) {
          target.isEliminated = true;
          target.discardPile.push(...target.hand);
          target.hand = [];
          logAction(room, `⚔️ 남작 결투! [${player.nickname}] 승리! [${target.nickname}] (${targetCard.name}) 탈락!`);
        } else if (myCard.value < targetCard.value) {
          player.isEliminated = true;
          player.discardPile.push(...player.hand);
          player.hand = [];
          logAction(room, `⚔️ 남작 결투! [${target.nickname}] 승리! [${player.nickname}] (${myCard.name}) 탈락!`);
        } else {
          logAction(room, `⚔️ 남작 결투! [${player.nickname}] 와 [${target.nickname}] 의 카드 숫자가 같습니다. (무승부)`);
        }
      }
    }
  }

  // 4. Handmaid (4)
  else if (card.value === 4) {
    player.isProtected = true;
    logAction(room, `🌸 [${player.nickname}] 님이 하녀를 소환하여 다음 턴까지 모든 공격에 면역됩니다.`);
  }

  // 5. Prince (5)
  else if (card.value === 5) {
    // Prince can target self
    const princeTarget = target || player;

    if (princeTarget && !princeTarget.isEliminated) {
      const discarded = princeTarget.hand.pop();
      if (discarded) {
        princeTarget.discardPile.push(discarded);
        logAction(room, `👑 왕자의 명령! [${princeTarget.nickname}] 님이 [${discarded.name}] 카드를 버렸습니다.`);

        // If Princess is discarded, eliminate!
        if (discarded.value === 8) {
          princeTarget.isEliminated = true;
          logAction(room, `👸 공주 카드가 버려졌습니다! [${princeTarget.nickname}] 즉시 탈락!`);
        } else {
          // Draw new card
          let newCard = room.deck.length > 0 ? room.deck.pop() : room.setAsideSecretCard;
          if (newCard) {
            princeTarget.hand.push(newCard);
          }
        }
      }
    }
  }

  // 6. King (6)
  else if (card.value === 6) {
    if (!target) {
      logAction(room, `지목 가능한 상대가 없어 국왕 효과가 무효화되었습니다.`);
    } else {
      const myCard = player.hand[0];
      const targetCard = target.hand[0];
      if (myCard && targetCard) {
        player.hand = [targetCard];
        target.hand = [myCard];
        logAction(room, `🤴 국왕의 칙령! [${player.nickname}] 와 [${target.nickname}] 의 손패가 맞교환되었습니다.`);
      }
    }
  }

  // 7. Countess (7)
  else if (card.value === 7) {
    logAction(room, `🌹 [${player.nickname}] 님이 백작부인을 우아하게 내려놓았습니다.`);
  }

  // 8. Princess (8)
  else if (card.value === 8) {
    player.isEliminated = true;
    logAction(room, `👸 공주 카드를 플레이했습니다! [${player.nickname}] 즉시 탈락!`);
  }

  broadcastRoomState(io, room.code);

  // Check round transition
  passTurnToNextPlayer(io, room);

  return { success: true };
}

export function pauseGameTimer(room) {
  if (!room) return;
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
  if (room.turnStartTime && room.turnTimeLimit && room.turnTimeLimit > 0) {
    const elapsed = Date.now() - room.turnStartTime;
    const remaining = room.turnTimeLimit * 1000 - elapsed;
    room.savedTurnRemainingMs = Math.max(1000, remaining);
  } else {
    room.savedTurnRemainingMs = null;
  }
  logAction(room, '⏸️ 플레이어 연결 끊김으로 게임이 일시정지되었습니다.');
}

export function resumeGameTimer(io, room) {
  if (!room || room.gameState !== 'PLAYING') return;

  room.isPaused = false;
  room.pausedPlayerId = null;
  room.pauseExpiresAt = null;
  if (room.pauseTimeout) {
    clearTimeout(room.pauseTimeout);
    room.pauseTimeout = null;
  }

  logAction(room, '▶️ 게임이 다시 재개되었습니다.');

  if (room.turnTimeLimit && room.turnTimeLimit > 0) {
    const remaining = room.savedTurnRemainingMs || room.turnTimeLimit * 1000;
    room.savedTurnRemainingMs = null;
    room.turnStartTime = Date.now();
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = setTimeout(() => {
      autoPlayTimeout(io, room, room.turnPlayerId);
    }, remaining + 1000);
  }

  broadcastRoomState(io, room.code);
}

export function handleForfeitedPlayer(io, room, userId, removePlayer = false) {
  if (!room) return;
  const player = room.players.find((p) => p.id === userId);
  if (!player) return;

  // Clear pause state if this player was the cause
  if (room.pauseTimeout && room.pausedPlayerId === userId) {
    clearTimeout(room.pauseTimeout);
    room.pauseTimeout = null;
  }
  room.isPaused = false;
  room.pausedPlayerId = null;
  room.pauseExpiresAt = null;

  player.isEliminated = true;
  if (player.hand && player.hand.length > 0) {
    player.discardPile.push(...player.hand);
    player.hand = [];
  }

  logAction(room, `🚪 [${player.nickname}] 님이 게임에서 기권(탈락) 처리되었습니다.`);

  if (removePlayer) {
    room.players = room.players.filter((p) => p.id !== userId);
  }

  const alivePlayers = room.players.filter((p) => !p.isEliminated);
  if (alivePlayers.length <= 1) {
    endRound(io, room, alivePlayers[0] || null, '상대방 전원 탈락/기권 승리!');
    return;
  }

  if (room.turnPlayerId === userId) {
    passTurnToNextPlayer(io, room);
  } else {
    // If not their turn and game is ongoing, resume game timer if needed
    if (room.gameState === 'PLAYING') {
      resumeGameTimer(io, room);
    } else {
      broadcastRoomState(io, room.code);
    }
  }
}

export function logAction(room, text) {
  if (!room) return;
  room.lastActionLog = text;
  if (!room.actionLogs) room.actionLogs = [];
  room.actionLogs.push({
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    text,
    timestamp: Date.now(),
  });
  if (room.actionLogs.length > 50) {
    room.actionLogs.shift();
  }
}

export function registerLoveLetter(io) {
  io.on('connection', (socket) => {
    // 1. Host starts game or next round
    socket.on('game:start', (payload, callback) => {
      const mapping = socketToUser[socket.id];
      if (!mapping) return;
      const { roomCode, userId } = mapping;
      const room = rooms[roomCode];

      if (!room || room.hostId !== userId) {
        if (typeof callback === 'function') {
          callback({ success: false, error: '방장만 게임을 시작할 수 있습니다.' });
        }
        return;
      }

      if (room.players.length < 2) {
        if (typeof callback === 'function') {
          callback({ success: false, error: '최소 2명 이상의 플레이어가 필요합니다.' });
        }
        return;
      }

      // Check ready status for all non-host players if in LOBBY
      if (room.gameState === 'LOBBY') {
        const notReady = room.players.filter((p) => p.id !== room.hostId && !p.isReady);
        if (notReady.length > 0) {
          if (typeof callback === 'function') {
            callback({
              success: false,
              error: `모든 플레이어가 준비 완료해야 합니다. (미준비: ${notReady.map((p) => p.nickname).join(', ')})`,
            });
          }
          return;
        }
      }

      if (room.gameState === 'ROUND_END') {
        room.roundNumber = (room.roundNumber || 1) + 1;
      } else if (room.gameState === 'GAME_OVER') {
        room.roundNumber = 1;
        room.players.forEach((p) => (p.tokens = 0));
      }

      startRound(io, room);

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    });

    // 2. Play Card
    socket.on('game:play-card', (payload, callback) => {
      const mapping = socketToUser[socket.id];
      if (!mapping) return;
      const { roomCode, userId } = mapping;
      const room = rooms[roomCode];
      if (!room) return;

      const result = executePlayCard(io, room, userId, payload);
      if (typeof callback === 'function') {
        callback(result);
      }
    });
  });
}
