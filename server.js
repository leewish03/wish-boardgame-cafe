import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Serve static React build files in production
app.use(express.static(path.join(__dirname, 'dist')));

const PORT = process.env.PORT || 3001;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// -------------------------------------------------------------
// REST API Endpoints (All prefix with /api)
// -------------------------------------------------------------

// 1. Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 2. Google OAuth2 Authentication Endpoint
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential, demoUser } = req.body;

    // Demo/Dev Mode Fallback
    if (demoUser) {
      return res.json({
        success: true,
        user: {
          id: demoUser.id || `demo_${Math.random().toString(36).substring(2, 9)}`,
          name: demoUser.name || '방문자',
          email: demoUser.email || 'guest@loveletter.local',
          picture: demoUser.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(demoUser.name || 'guest')}`,
        },
      });
    }

    if (!credential) {
      return res.status(400).json({ error: '인증 토큰(credential)이 필요합니다.' });
    }

    let payload;
    if (GOOGLE_CLIENT_ID) {
      const ticket = await googleAuthClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else {
      // In local dev without GOOGLE_CLIENT_ID, decode payload safely
      const parts = credential.split('.');
      if (parts.length === 3) {
        payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      } else {
        throw new Error('잘못된 토큰 형식입니다.');
      }
    }

    if (!payload) {
      return res.status(401).json({ error: '구글 인증에 실패하였습니다.' });
    }

    const user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name || payload.given_name || '러브레터 플레이어',
      picture: payload.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${payload.sub}`,
    };

    return res.json({ success: true, user });
  } catch (error) {
    console.error('Google Auth Error:', error);
    return res.status(401).json({ error: '인증 검증 중 오류가 발생했습니다: ' + error.message });
  }
});

// 3. Room Validation Check
app.get('/api/rooms/:roomCode/check', (req, res) => {
  const { roomCode } = req.params;
  const upperCode = (roomCode || '').toUpperCase();
  const room = rooms[upperCode];

  if (!room) {
    return res.status(404).json({ exists: false, error: '존재하지 않는 방 번호입니다.' });
  }

  res.json({
    exists: true,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers || 6,
    isPlaying: room.gameState !== 'LOBBY',
  });
});

// -------------------------------------------------------------
// Love Letter Card Definitions & Rules Engine
// -------------------------------------------------------------

const CARD_DEFS = {
  1: { value: 1, name: '경비병', nameEn: 'Guard', count: 5, desc: '상대 1명을 지목하여 2~8번 카드 번호/이름을 추측합니다. 일치 시 상대는 즉시 탈락합니다.' },
  2: { value: 2, name: '사제', nameEn: 'Priest', count: 2, desc: '상대 1명을 지목하여 그 사람의 손패를 비밀리에 확인합니다.' },
  3: { value: 3, name: '남작', nameEn: 'Baron', count: 2, desc: '상대 1명을 지목하여 손패 숫자를 비밀리에 비교합니다. 더 낮은 숫자를 가진 사람이 탈락합니다.' },
  4: { value: 4, name: '하녀', nameEn: 'Handmaid', count: 2, desc: '자신의 다음 턴 시작 전까지 다른 사람의 모든 카드 효과 대상에서 제외(면역)됩니다.' },
  5: { value: 5, name: '왕자', nameEn: 'Prince', count: 2, desc: '자신을 포함한 1명을 지목합니다. 그 사람은 손패를 버리고 새로 1장 드로우합니다. (공주가 버려지면 탈락)' },
  6: { value: 6, name: '국왕', nameEn: 'King', count: 1, desc: '상대 1명을 지목하여 자신의 손패와 상대의 손패를 맞교환합니다.' },
  7: { value: 7, name: '백작부인', nameEn: 'Countess', count: 1, desc: '손에 왕자(5) 또는 국왕(6)이 함께 있을 경우, 반드시 백작부인을 먼저 내려놓아야 합니다.' },
  8: { value: 8, name: '공주', nameEn: 'Princess', count: 1, desc: '이 카드를 내거나 버려지게 되면 즉시 게임에서 탈락합니다.' },
};

function generateDeck(playerCount) {
  const deck = [];
  const baseCounts = { 1: 5, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1 };

  // If 5~6 players, slightly expand deck for balance
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
      deck.push({ ...CARD_DEFS[num], id: `card_${num}_${i}_${Math.random().toString(36).substr(2, 5)}` });
    }
  });

  // Fisher-Yates Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// -------------------------------------------------------------
// In-Memory Room & Game State Manager
// -------------------------------------------------------------

const rooms = {}; // key: roomCode -> room object
const socketToUser = {}; // socketId -> { roomCode, userId }

function getPublicRoomState(room, requestUserId = null) {
  if (!room) return null;

  return {
    code: room.code,
    hostId: room.hostId,
    gameState: room.gameState,
    targetTokens: room.targetTokens,
    maxPlayers: room.maxPlayers,
    deckCount: room.deck.length,
    setAsideOpenCards: room.setAsideOpenCards || [],
    turnPlayerId: room.turnPlayerId,
    roundWinner: room.roundWinner,
    gameWinner: room.gameWinner,
    lastActionLog: room.lastActionLog,
    players: room.players.map((p) => {
      const isSelf = p.id === requestUserId;
      return {
        id: p.id,
        name: p.name,
        picture: p.picture,
        isBot: p.isBot,
        isReady: p.isReady,
        tokens: p.tokens,
        isEliminated: p.isEliminated,
        isProtected: p.isProtected,
        discardPile: p.discardPile,
        handCount: p.hand.length,
        // Only disclose hand to the requesting player or when round is finished
        hand: isSelf || room.gameState === 'ROUND_END' || room.gameState === 'GAME_OVER' ? p.hand : [],
      };
    }),
  };
}

function broadcastRoomState(roomCode, specificActionLog = null) {
  const room = rooms[roomCode];
  if (!room) return;

  if (specificActionLog) {
    room.lastActionLog = specificActionLog;
  }

  room.players.forEach((p) => {
    if (!p.isBot && p.socketId) {
      const playerState = getPublicRoomState(room, p.id);
      io.to(p.socketId).emit('room:state_sync', playerState);
    }
  });
}

function startRound(room) {
  room.gameState = 'PLAYING';
  room.roundWinner = null;
  room.gameWinner = null;

  // Reset player round states
  room.players.forEach((p) => {
    p.hand = [];
    p.discardPile = [];
    p.isEliminated = false;
    p.isProtected = false;
  });

  // Create and shuffle deck
  const activeCount = room.players.length;
  const fullDeck = generateDeck(activeCount);

  // Set aside 1 face-down card
  room.setAsideCard = fullDeck.pop();
  room.setAsideOpenCards = [];

  // For 2 players, set aside 3 face-up cards
  if (activeCount === 2) {
    for (let i = 0; i < 3; i++) {
      if (fullDeck.length > 0) {
        room.setAsideOpenCards.push(fullDeck.pop());
      }
    }
  }

  room.deck = fullDeck;

  // Deal 1 card to each player
  room.players.forEach((p) => {
    if (room.deck.length > 0) {
      p.hand.push(room.deck.pop());
    }
  });

  // Determine starting player
  if (!room.turnPlayerId || !room.players.some((p) => p.id === room.turnPlayerId)) {
    room.turnPlayerId = room.players[0].id;
  }

  // Draw 1 card for the starting player
  const startingPlayer = room.players.find((p) => p.id === room.turnPlayerId);
  if (startingPlayer && room.deck.length > 0) {
    startingPlayer.hand.push(room.deck.pop());
  }

  broadcastRoomState(room.code, `새 라운드가 시작되었습니다! [${startingPlayer.name}]님의 턴입니다.`);

  // If first player is bot, trigger AI turn
  if (startingPlayer && startingPlayer.isBot) {
    triggerBotTurn(room, startingPlayer);
  }
}

function getAlivePlayers(room) {
  return room.players.filter((p) => !p.isEliminated);
}

function endRound(room, winner, reasonText) {
  room.gameState = 'ROUND_END';
  room.roundWinner = winner ? { id: winner.id, name: winner.name, picture: winner.picture } : null;

  if (winner) {
    winner.tokens += 1;
  }

  const logMessage = winner
    ? `🏆 [${winner.name}]님이 이번 라운드에서 승리하여 호감도 토큰을 획득했습니다! (${reasonText})`
    : `이번 라운드는 무승부로 종료되었습니다. (${reasonText})`;

  // Check Game Over Condition
  const champion = room.players.find((p) => p.tokens >= (room.targetTokens || 4));
  if (champion) {
    room.gameState = 'GAME_OVER';
    room.gameWinner = { id: champion.id, name: champion.name, picture: champion.picture, tokens: champion.tokens };
    broadcastRoomState(room.code, `👑 축하합니다! [${champion.name}]님이 최종 승리하였습니다!`);
    return;
  }

  broadcastRoomState(room.code, logMessage);

  // Auto start next round after 5 seconds
  setTimeout(() => {
    if (rooms[room.code] && rooms[room.code].gameState === 'ROUND_END') {
      // Starting player of next round is the winner
      if (winner) {
        room.turnPlayerId = winner.id;
      }
      startRound(rooms[room.code]);
    }
  }, 5000);
}

function advanceTurn(room) {
  const alivePlayers = getAlivePlayers(room);

  // Check Win Condition A: Only 1 player alive
  if (alivePlayers.length <= 1) {
    const winner = alivePlayers[0] || null;
    endRound(room, winner, '최후의 생존자');
    return;
  }

  // Check Win Condition B: Deck empty
  if (room.deck.length === 0) {
    // Reveal all hands and find highest card
    let highestVal = -1;
    let candidates = [];

    alivePlayers.forEach((p) => {
      const cardVal = p.hand[0] ? p.hand[0].value : 0;
      if (cardVal > highestVal) {
        highestVal = cardVal;
        candidates = [p];
      } else if (cardVal === highestVal) {
        candidates.push(p);
      }
    });

    if (candidates.length === 1) {
      endRound(room, candidates[0], `카드 번호 ${highestVal}번으로 최고점 달성`);
    } else {
      // Tiebreak: Sum of discard piles
      let bestDiscardSum = -1;
      let tieWinner = candidates[0];
      candidates.forEach((c) => {
        const sum = c.discardPile.reduce((acc, curr) => acc + curr.value, 0);
        if (sum > bestDiscardSum) {
          bestDiscardSum = sum;
          tieWinner = c;
        }
      });
      endRound(room, tieWinner, `동점 판정 (버린 카드 합산 점수 승리)`);
    }
    return;
  }

  // Next player in turn order
  const currentIndex = room.players.findIndex((p) => p.id === room.turnPlayerId);
  let nextIndex = (currentIndex + 1) % room.players.length;

  while (room.players[nextIndex].isEliminated) {
    nextIndex = (nextIndex + 1) % room.players.length;
  }

  const nextPlayer = room.players[nextIndex];
  room.turnPlayerId = nextPlayer.id;

  // Remove handmaid protection on new turn start
  nextPlayer.isProtected = false;

  // Draw 1 card for next player
  if (room.deck.length > 0) {
    nextPlayer.hand.push(room.deck.pop());
  }

  broadcastRoomState(room.code, `[${nextPlayer.name}]님의 턴입니다.`);

  if (nextPlayer.isBot) {
    triggerBotTurn(room, nextPlayer);
  }
}

// -------------------------------------------------------------
// AI Bot Decision Strategy Engine
// -------------------------------------------------------------

function triggerBotTurn(room, botPlayer) {
  setTimeout(() => {
    // Check if room and game are still active and it's still bot's turn
    if (!rooms[room.code] || room.gameState !== 'PLAYING' || room.turnPlayerId !== botPlayer.id) return;
    if (botPlayer.isEliminated || botPlayer.hand.length === 0) return;

    const hand = botPlayer.hand;
    let cardToPlay = null;

    // Rule: Countess (7) constraint with Prince (5) or King (6)
    const hasCountess = hand.some((c) => c.value === 7);
    const hasPrinceOrKing = hand.some((c) => c.value === 5 || c.value === 6);

    if (hasCountess && hasPrinceOrKing) {
      cardToPlay = hand.find((c) => c.value === 7);
    } else {
      // Normal bot heuristic:
      // Try to avoid playing Princess (8)
      const playable = hand.filter((c) => c.value !== 8);
      if (playable.length > 0) {
        // Pick card: prefer Handmaid(4), Guard(1), Priest(2), Prince(5), Baron(3)
        // Sort by strategic priority
        cardToPlay = playable.sort((a, b) => a.value - b.value)[0];
      } else {
        cardToPlay = hand[0];
      }
    }

    const aliveOthers = getAlivePlayers(room).filter((p) => p.id !== botPlayer.id && !p.isProtected);
    let targetPlayerId = null;
    let guessedCardValue = null;

    if (cardToPlay.value === 1) { // Guard
      if (aliveOthers.length > 0) {
        targetPlayerId = aliveOthers[Math.floor(Math.random() * aliveOthers.length)].id;
        // Guess 2, 3, or 5 with high probability
        const guesses = [2, 3, 5, 6, 7];
        guessedCardValue = guesses[Math.floor(Math.random() * guesses.length)];
      }
    } else if (cardToPlay.value === 2 || cardToPlay.value === 3 || cardToPlay.value === 6) { // Priest, Baron, King
      if (aliveOthers.length > 0) {
        targetPlayerId = aliveOthers[Math.floor(Math.random() * aliveOthers.length)].id;
      }
    } else if (cardToPlay.value === 5) { // Prince
      if (aliveOthers.length > 0) {
        targetPlayerId = aliveOthers[Math.floor(Math.random() * aliveOthers.length)].id;
      } else {
        targetPlayerId = botPlayer.id; // Self target
      }
    }

    executePlayCard(room, botPlayer.id, cardToPlay.id, targetPlayerId, guessedCardValue);
  }, 1500);
}

// -------------------------------------------------------------
// Card Play Execution Function
// -------------------------------------------------------------

function executePlayCard(room, playerId, cardId, targetPlayerId, guessedCardValue) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.isEliminated || room.turnPlayerId !== playerId) return { success: false, error: '현재 턴이 아닙니다.' };

  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return { success: false, error: '보유하지 않은 카드입니다.' };

  const card = player.hand[cardIndex];

  // Validate Countess Rule
  const otherCard = player.hand.find((c) => c.id !== cardId);
  if (otherCard && otherCard.value === 7 && (card.value === 5 || card.value === 6)) {
    return { success: false, error: '백작부인을 보유 중일 때는 왕자나 국왕을 낼 수 없습니다.' };
  }

  // Remove card from player hand and push to discard pile
  player.hand.splice(cardIndex, 1);
  player.discardPile.push(card);

  let target = targetPlayerId ? room.players.find((p) => p.id === targetPlayerId) : null;
  let actionLog = `[${player.name}]님이 [${card.name}] 카드를 사용했습니다.`;

  // Process Card Effects
  switch (card.value) {
    case 1: { // Guard
      if (target && !target.isProtected && !target.isEliminated) {
        const targetCard = target.hand[0];
        if (targetCard && targetCard.value === guessedCardValue) {
          target.isEliminated = true;
          actionLog = `🎯 [${player.name}]님이 [${target.name}]님의 [${CARD_DEFS[guessedCardValue].name}] 카드를 정확히 맞춰 탈락시켰습니다!`;
          if (target.hand.length > 0) {
            target.discardPile.push(target.hand.pop());
          }
        } else {
          actionLog = `[${player.name}]님이 [${target.name}]님을 [${CARD_DEFS[guessedCardValue]?.name || guessedCardValue}번]으로 추측했으나 빗나갔습니다.`;
        }
      } else {
        actionLog = `[${player.name}]님이 [경비병]을 냈으나 대상이 없거나 보호 상태입니다.`;
      }
      break;
    }

    case 2: { // Priest
      if (target && !target.isProtected && !target.isEliminated) {
        const targetCard = target.hand[0];
        if (targetCard && !player.isBot && player.socketId) {
          io.to(player.socketId).emit('game:priest_reveal', {
            targetName: target.name,
            card: targetCard,
          });
        }
        actionLog = `👁️ [${player.name}]님이 [${target.name}]님의 손패를 은밀히 확인했습니다.`;
      } else {
        actionLog = `[${player.name}]님이 [사제]를 냈으나 대상이 없거나 보호 상태입니다.`;
      }
      break;
    }

    case 3: { // Baron
      if (target && !target.isProtected && !target.isEliminated) {
        const myCard = player.hand[0];
        const targetCard = target.hand[0];

        if (myCard && targetCard) {
          if (myCard.value > targetCard.value) {
            target.isEliminated = true;
            target.discardPile.push(target.hand.pop());
            actionLog = `⚔️ [${player.name}]님과 [${target.name}]님의 결투! [${target.name}]님이 더 낮은 카드(${targetCard.name})로 탈락했습니다.`;
          } else if (myCard.value < targetCard.value) {
            player.isEliminated = true;
            player.discardPile.push(player.hand.pop());
            actionLog = `⚔️ [${player.name}]님과 [${target.name}]님의 결투! [${player.name}]님이 더 낮은 카드(${myCard.name})로 탈락했습니다.`;
          } else {
            actionLog = `⚔️ [${player.name}]님과 [${target.name}]님의 결투! 두 사람의 카드 숫자가 같아 무승부입니다.`;
          }
        }
      } else {
        actionLog = `[${player.name}]님이 [남작]을 냈으나 대상이 없거나 보호 상태입니다.`;
      }
      break;
    }

    case 4: { // Handmaid
      player.isProtected = true;
      actionLog = `🛡️ [${player.name}]님이 [하녀]를 사용하여 다음 턴까지 보호막을 생성했습니다.`;
      break;
    }

    case 5: { // Prince
      if (target && !target.isProtected && !target.isEliminated) {
        const discardedCard = target.hand.pop();
        if (discardedCard) {
          target.discardPile.push(discardedCard);
          if (discardedCard.value === 8) { // Princess discarded!
            target.isEliminated = true;
            actionLog = `💥 [${target.name}]님이 [공주] 카드를 버려 즉시 탈락했습니다!`;
          } else {
            // Draw new card (from deck or set-aside card if empty)
            if (room.deck.length > 0) {
              target.hand.push(room.deck.pop());
            } else if (room.setAsideCard) {
              target.hand.push(room.setAsideCard);
              room.setAsideCard = null;
            }
            actionLog = `👑 [${player.name}]님의 왕자 효과로 [${target.name}]님이 손패(${discardedCard.name})를 버리고 새로 뽑았습니다.`;
          }
        }
      } else {
        actionLog = `[${player.name}]님이 [왕자]를 냈으나 대상이 보호 상태입니다.`;
      }
      break;
    }

    case 6: { // King
      if (target && !target.isProtected && !target.isEliminated) {
        const myCard = player.hand.pop();
        const targetCard = target.hand.pop();
        if (myCard && targetCard) {
          player.hand.push(targetCard);
          target.hand.push(myCard);
          actionLog = `🔄 [${player.name}]님과 [${target.name}]님이 서로 손패를 맞교환했습니다.`;
        }
      } else {
        actionLog = `[${player.name}]님이 [국왕]을 냈으나 대상이 없거나 보호 상태입니다.`;
      }
      break;
    }

    case 7: { // Countess
      actionLog = `🌹 [${player.name}]님이 [백작부인] 카드를 내려놓았습니다.`;
      break;
    }

    case 8: { // Princess
      player.isEliminated = true;
      actionLog = `💀 [${player.name}]님이 [공주] 카드를 제출하여 즉시 탈락했습니다!`;
      break;
    }
  }

  broadcastRoomState(room.code, actionLog);
  advanceTurn(room);
  return { success: true };
}

// -------------------------------------------------------------
// Socket.io Real-time Event Handler
// -------------------------------------------------------------

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 1. Room Creation
  socket.on('room:create', ({ user, targetTokens = 4, maxPlayers = 6 }) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newRoom = {
      code: roomCode,
      hostId: user.id,
      gameState: 'LOBBY',
      targetTokens,
      maxPlayers,
      deck: [],
      setAsideCard: null,
      turnPlayerId: null,
      roundWinner: null,
      gameWinner: null,
      lastActionLog: '대기실이 생성되었습니다.',
      players: [
        {
          id: user.id,
          socketId: socket.id,
          name: user.name,
          picture: user.picture,
          isBot: false,
          isReady: true, // Host is ready by default
          tokens: 0,
          hand: [],
          discardPile: [],
          isEliminated: false,
          isProtected: false,
        },
      ],
    };

    rooms[roomCode] = newRoom;
    socketToUser[socket.id] = { roomCode, userId: user.id };
    socket.join(roomCode);

    socket.emit('room:joined', { roomCode, isHost: true });
    broadcastRoomState(roomCode, `[${user.name}]님이 방을 생성했습니다.`);
  });

  // 2. Room Join
  socket.on('room:join', ({ roomCode, user }) => {
    const upperCode = (roomCode || '').toUpperCase();
    const room = rooms[upperCode];

    if (!room) {
      return socket.emit('room:error', '존재하지 않는 방 번호입니다.');
    }

    if (room.players.length >= room.maxPlayers) {
      return socket.emit('room:error', '방 인원이 가득 찼습니다.');
    }

    // Check if player already in room
    let player = room.players.find((p) => p.id === user.id);
    if (player) {
      player.socketId = socket.id;
      player.name = user.name || player.name;
    } else {
      if (room.gameState !== 'LOBBY') {
        return socket.emit('room:error', '이미 게임이 진행 중인 방입니다.');
      }
      room.players.push({
        id: user.id,
        socketId: socket.id,
        name: user.name,
        picture: user.picture,
        isBot: false,
        isReady: false,
        tokens: 0,
        hand: [],
        discardPile: [],
        isEliminated: false,
        isProtected: false,
      });
    }

    socketToUser[socket.id] = { roomCode: upperCode, userId: user.id };
    socket.join(upperCode);

    socket.emit('room:joined', { roomCode: upperCode, isHost: room.hostId === user.id });
    
    // WebRTC mesh: notify other peers
    socket.to(upperCode).emit('webrtc:peer_joined', { peerId: user.id, socketId: socket.id });
    broadcastRoomState(upperCode, `[${user.name}]님이 입장하였습니다.`);
  });

  // 3. Toggle Ready
  socket.on('room:ready', () => {
    const mapping = socketToUser[socket.id];
    if (!mapping) return;
    const room = rooms[mapping.roomCode];
    if (!room || room.gameState !== 'LOBBY') return;

    const player = room.players.find((p) => p.id === mapping.userId);
    if (player && player.id !== room.hostId) {
      player.isReady = !player.isReady;
      broadcastRoomState(room.code);
    }
  });

  // 4. Add AI Bot
  socket.on('room:add_bot', () => {
    const mapping = socketToUser[socket.id];
    if (!mapping) return;
    const room = rooms[mapping.roomCode];
    if (!room || room.hostId !== mapping.userId || room.gameState !== 'LOBBY') return;

    if (room.players.length >= room.maxPlayers) {
      return socket.emit('room:error', '최대 인원을 초과할 수 없습니다.');
    }

    const botNames = ['알파봇', '베타봇', '감마봇', '델타봇', '오메가봇'];
    const botIndex = room.players.filter((p) => p.isBot).length;
    const botName = botNames[botIndex % botNames.length] + ` #${botIndex + 1}`;
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    room.players.push({
      id: botId,
      socketId: null,
      name: botName,
      picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${botId}`,
      isBot: true,
      isReady: true,
      tokens: 0,
      hand: [],
      discardPile: [],
      isEliminated: false,
      isProtected: false,
    });

    broadcastRoomState(room.code, `🤖 AI [${botName}]이(가) 방에 참가했습니다.`);
  });

  // 5. Remove AI Bot
  socket.on('room:remove_bot', ({ botId }) => {
    const mapping = socketToUser[socket.id];
    if (!mapping) return;
    const room = rooms[mapping.roomCode];
    if (!room || room.hostId !== mapping.userId || room.gameState !== 'LOBBY') return;

    const idx = room.players.findIndex((p) => p.id === botId && p.isBot);
    if (idx !== -1) {
      const removed = room.players.splice(idx, 1)[0];
      broadcastRoomState(room.code, `🤖 AI [${removed.name}]이(가) 퇴장했습니다.`);
    }
  });

  // 6. Start Game
  socket.on('game:start', () => {
    const mapping = socketToUser[socket.id];
    if (!mapping) return;
    const room = rooms[mapping.roomCode];
    if (!room || room.hostId !== mapping.userId) return;

    if (room.players.length < 2) {
      return socket.emit('room:error', '게임을 시작하려면 최소 2명(AI 포함) 이상이어야 합니다.');
    }

    // Reset tokens for all players
    room.players.forEach((p) => {
      p.tokens = 0;
    });

    startRound(room);
  });

  // 7. Play Card Action
  socket.on('game:play_card', ({ cardId, targetPlayerId, guessedCardValue }) => {
    const mapping = socketToUser[socket.id];
    if (!mapping) return;
    const room = rooms[mapping.roomCode];
    if (!room || room.gameState !== 'PLAYING') return;

    const result = executePlayCard(room, mapping.userId, cardId, targetPlayerId, guessedCardValue);
    if (!result.success) {
      socket.emit('game:error', result.error);
    }
  });

  // 8. STT Realtime Interim / Final Broadcast
  socket.on('stt:speech', ({ text, isFinal }) => {
    const mapping = socketToUser[socket.id];
    if (!mapping) return;
    const room = rooms[mapping.roomCode];
    if (!room) return;

    const player = room.players.find((p) => p.id === mapping.userId);
    if (!player) return;

    io.to(room.code).emit('stt:bubble', {
      senderId: player.id,
      senderName: player.name,
      text,
      isFinal,
    });

    // If final transcription, also record into chat feed
    if (isFinal && text.trim().length > 0) {
      io.to(room.code).emit('chat:broadcast', {
        id: `stt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        senderId: player.id,
        senderName: player.name,
        senderPicture: player.picture,
        text: text.trim(),
        isSTT: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    }
  });

  // 9. Text Chat Message
  socket.on('chat:send', ({ text }) => {
    const mapping = socketToUser[socket.id];
    if (!mapping || !text || !text.trim()) return;
    const room = rooms[mapping.roomCode];
    if (!room) return;

    const player = room.players.find((p) => p.id === mapping.userId);
    if (!player) return;

    io.to(room.code).emit('chat:broadcast', {
      id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      senderId: player.id,
      senderName: player.name,
      senderPicture: player.picture,
      text: text.trim(),
      isSTT: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });
  });

  // 10. WebRTC P2P Signaling (Offer, Answer, ICE Candidate)
  socket.on('webrtc:offer', ({ toSocketId, offer }) => {
    const mapping = socketToUser[socket.id];
    if (toSocketId && mapping) {
      io.to(toSocketId).emit('webrtc:offer', {
        fromSocketId: socket.id,
        fromUserId: mapping.userId,
        offer,
      });
    }
  });

  socket.on('webrtc:answer', ({ toSocketId, answer }) => {
    const mapping = socketToUser[socket.id];
    if (toSocketId && mapping) {
      io.to(toSocketId).emit('webrtc:answer', {
        fromSocketId: socket.id,
        fromUserId: mapping.userId,
        answer,
      });
    }
  });

  socket.on('webrtc:ice_candidate', ({ toSocketId, candidate }) => {
    if (toSocketId) {
      io.to(toSocketId).emit('webrtc:ice_candidate', {
        fromSocketId: socket.id,
        candidate,
      });
    }
  });

  // 11. Disconnect
  socket.on('disconnect', () => {
    const mapping = socketToUser[socket.id];
    if (mapping) {
      const room = rooms[mapping.roomCode];
      if (room) {
        const idx = room.players.findIndex((p) => p.id === mapping.userId);
        if (idx !== -1) {
          const leavingPlayer = room.players[idx];
          
          // Notify WebRTC peers
          socket.to(room.code).emit('webrtc:peer_left', { socketId: socket.id, userId: mapping.userId });

          if (room.gameState === 'LOBBY') {
            room.players.splice(idx, 1);
            if (room.players.length === 0) {
              delete rooms[mapping.roomCode];
            } else {
              // Host migration
              if (room.hostId === mapping.userId) {
                const nextHuman = room.players.find((p) => !p.isBot);
                if (nextHuman) {
                  room.hostId = nextHuman.id;
                  nextHuman.isReady = true;
                }
              }
              broadcastRoomState(room.code, `[${leavingPlayer.name}]님이 방을 나갔습니다.`);
            }
          } else {
            // In Game: eliminate player or replace with AI
            leavingPlayer.isEliminated = true;
            broadcastRoomState(room.code, `[${leavingPlayer.name}]님의 연결이 끊겨 탈락 처리되었습니다.`);
            
            // Advance turn if it was their turn
            if (room.turnPlayerId === leavingPlayer.id) {
              advanceTurn(room);
            }
          }
        }
      }
      delete socketToUser[socket.id];
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Fallback to index.html for SPA client routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🎲 ☕ Wish Boardgame Cafe Server running on port ${PORT}`);
  console.log(`- API URL: http://localhost:${PORT}/api/health`);
  console.log(`=========================================`);
});
