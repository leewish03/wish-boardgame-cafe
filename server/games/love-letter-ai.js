/**
 * Wish Boardgame Salon - Love Letter AI Bot Engine
 * 지능형 휴리스틱 추론 알고리즘 & 메모리 트래커
 */

// 살롱 VIP AI 봇 프로필 프리셋
export const AI_BOT_PROFILES = [
  {
    nickname: '알렉산더',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alexander&backgroundColor=3b0b17,1e293b,047857',
    personality: 'AGGRESSIVE', // 공격적/남작 결투 선호
  },
  {
    nickname: '마리안느',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Marianne&backgroundColor=047857,1e293b,090d16',
    personality: 'DEFENSIVE', // 방어적/하녀 면역 선호
  },
  {
    nickname: '줄리앙',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Julien&backgroundColor=1e293b,047857,3b0b17',
    personality: 'CALCULATING', // 계산적/확률 기반 저격
  },
  {
    nickname: '빅토리아',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Victoria&backgroundColor=c5a059,3b0b17,1e293b',
    personality: 'STRATEGIC', // 심리전/안전 패 위주
  },
  {
    nickname: '펠릭스',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=090d16,c5a059,047857',
    personality: 'INFORMATIVE', // 사제 투시 후 기억 저격
  },
];

// 각 카드별 기본 덱 수량
const CARD_TOTAL_COUNTS = {
  1: 5, // 경비병
  2: 2, // 사제
  3: 2, // 남작
  4: 2, // 하녀
  5: 2, // 왕자
  6: 1, // 국왕
  7: 1, // 백작부인
  8: 1, // 공주
};

/**
 * 봇 객체 초기화 (메모리 포함)
 */
export function createBotPlayer(existingPlayers = []) {
  const usedNames = new Set(existingPlayers.map((p) => p.nickname));
  const availableProfile =
    AI_BOT_PROFILES.find((p) => !usedNames.has(p.nickname)) ||
    AI_BOT_PROFILES[existingPlayers.length % AI_BOT_PROFILES.length];

  const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  return {
    id: botId,
    socketId: null,
    sessionToken: `bot_token_${botId}`,
    isBot: true,
    isReady: true,
    nickname: availableProfile.nickname,
    avatarUrl: availableProfile.avatarUrl,
    personality: availableProfile.personality,
    hand: [],
    discardPile: [],
    tokens: 0,
    isEliminated: false,
    isProtected: false,
    // AI 메모리 (사제로 확인한 패, 국왕으로 교환된 패 등 기록)
    memory: {
      knownPlayerCards: {}, // { [playerId]: { cardValue: number, timestamp: number } }
    },
  };
}

/**
 * 게임 내 테이블에 공개된(버려진 + 내 손패) 카드 카운트 집계
 */
function getSeenCardCounts(room, botPlayer) {
  const seen = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };

  // 1. 모든 플레이어의 버린 카드 더미
  (room.players || []).forEach((p) => {
    (p.discardPile || []).forEach((c) => {
      if (c && c.value) seen[c.value] = (seen[c.value] || 0) + 1;
    });
  });

  // 2. 봇 자신의 손패
  (botPlayer.hand || []).forEach((c) => {
    if (c && c.value) seen[c.value] = (seen[c.value] || 0) + 1;
  });

  return seen;
}

/**
 * AI 봇의 지능형 카드 제출 의사결정 함수
 * @param {object} room - 현재 룸 객체
 * @param {object} botPlayer - AI 봇 플레이어
 * @returns {object} { cardId, targetUserId, guessValue }
 */
export function decideBotAction(room, botPlayer) {
  const hand = botPlayer.hand || [];
  if (hand.length === 0) return null;

  const validTargets = (room.players || []).filter(
    (p) => p.id !== botPlayer.id && !p.isEliminated && !p.isProtected
  );

  const seenCounts = getSeenCardCounts(room, botPlayer);

  // 미출현 잔여 카드 계산 함수
  const getRemainingCount = (val) =>
    Math.max(0, (CARD_TOTAL_COUNTS[val] || 0) - (seenCounts[val] || 0));

  // 1. 백작부인(7) 강제 규칙 준수: 왕자(5) 또는 국왕(6)과 백작부인(7)을 동시에 든 경우
  const hasCountess = hand.some((c) => c.value === 7);
  const hasPrinceOrKing = hand.some((c) => c.value === 5 || c.value === 6);
  if (hasCountess && hasPrinceOrKing) {
    const countessCard = hand.find((c) => c.value === 7);
    return {
      cardId: countessCard.id,
      targetUserId: null,
      guessValue: null,
    };
  }

  // 2. 공주(8) 보호 규칙: 공주를 들고 있을 때 왕자(5)를 자신에게 쓰지 않음
  const hasPrincess = hand.some((c) => c.value === 8);

  // 사용할 카드와 타겟 결정 로직
  let chosenCard = null;
  let targetUserId = null;
  let guessValue = null;

  // 카드 2장 중 어떤 카드를 플레이할지 점수화(Scoring)
  const evaluatedCards = hand.map((card) => {
    let score = 50; // 기본 점수

    if (card.value === 8) {
      // 공주: 내면 탈락이므로 점수 -9999
      score = -9999;
    } else if (card.value === 7) {
      // 백작부인: 안전하게 버리기 좋음
      score = 45;
    } else if (card.value === 4) {
      // 하녀: 생존율 높임
      score = 80;
    } else if (card.value === 1) {
      // 경비병: 타겟이 있으면 고효율
      score = validTargets.length > 0 ? 85 : 30;
    } else if (card.value === 2) {
      // 사제: 정보 획득
      score = validTargets.length > 0 ? 75 : 25;
    } else if (card.value === 3) {
      // 남작: 다른 카드가 높을 때(>=5) 유리
      const otherCard = hand.find((c) => c.id !== card.id);
      if (otherCard && otherCard.value >= 5) {
        score = 80;
      } else if (otherCard && otherCard.value <= 2) {
        score = 20; // 패배 위험
      } else {
        score = 40;
      }
    } else if (card.value === 5) {
      // 왕자: 상대 카드 날리기
      if (hasPrincess && validTargets.length === 0) {
        score = -500; // 공주 든 상태에서 타겟 없으면 자폭이므로 봉인
      } else {
        score = 70;
      }
    } else if (card.value === 6) {
      // 국왕: 내 패가 낮고 상대가 높을 것 같을 때
      score = 65;
    }

    return { card, score };
  });

  // 점수가 가장 높은 카드 선택
  evaluatedCards.sort((a, b) => b.score - a.score);
  chosenCard = evaluatedCards[0].card;

  // 타겟 및 세부 파라미터 결정
  if (chosenCard.value === 1) {
    // 경비병 (1)
    if (validTargets.length > 0) {
      // 기억에 있는 타겟 우선
      let bestTarget = null;
      let knownGuess = null;

      for (const target of validTargets) {
        const mem = botPlayer.memory?.knownPlayerCards?.[target.id];
        if (mem && mem.cardValue && mem.cardValue >= 2 && mem.cardValue <= 8) {
          bestTarget = target;
          knownGuess = mem.cardValue;
          break;
        }
      }

      if (bestTarget && knownGuess) {
        targetUserId = bestTarget.id;
        guessValue = knownGuess;
      } else {
        // 무작위 타겟 + 확률적으로 가장 많이 남은 카드 번호 추측
        targetUserId =
          validTargets[Math.floor(Math.random() * validTargets.length)].id;

        let maxRemaining = -1;
        let mostProbableValue = 2; // 기본 사제

        // 2~8번 중 가장 많이 남아있는 카드 번호 계산
        for (let v = 2; v <= 8; v++) {
          const rem = getRemainingCount(v);
          if (rem > maxRemaining) {
            maxRemaining = rem;
            mostProbableValue = v;
          }
        }
        guessValue = mostProbableValue;
      }
    }
  } else if (chosenCard.value === 2) {
    // 사제 (2)
    if (validTargets.length > 0) {
      // 아직 손패를 모르는 타겟 우선
      const unknownTargets = validTargets.filter(
        (t) => !botPlayer.memory?.knownPlayerCards?.[t.id]
      );
      const targetPool = unknownTargets.length > 0 ? unknownTargets : validTargets;
      targetUserId = targetPool[Math.floor(Math.random() * targetPool.length)].id;
    }
  } else if (chosenCard.value === 3) {
    // 남작 (3)
    if (validTargets.length > 0) {
      targetUserId =
        validTargets[Math.floor(Math.random() * validTargets.length)].id;
    }
  } else if (chosenCard.value === 5) {
    // 왕자 (5)
    if (validTargets.length > 0) {
      targetUserId =
        validTargets[Math.floor(Math.random() * validTargets.length)].id;
    } else {
      targetUserId = botPlayer.id;
    }
  } else if (chosenCard.value === 6) {
    // 국왕 (6)
    if (validTargets.length > 0) {
      targetUserId =
        validTargets[Math.floor(Math.random() * validTargets.length)].id;
    }
  }

  return {
    cardId: chosenCard.id,
    targetUserId,
    guessValue,
  };
}

/**
 * 사제 투시 결과를 AI 봇 메모리에 기록
 */
export function recordPriestMemory(botPlayer, targetUserId, cardValue) {
  if (!botPlayer || !botPlayer.isBot || !botPlayer.memory) return;
  if (!botPlayer.memory.knownPlayerCards) {
    botPlayer.memory.knownPlayerCards = {};
  }
  botPlayer.memory.knownPlayerCards[targetUserId] = {
    cardValue,
    timestamp: Date.now(),
  };
}

/**
 * 대상 플레이어가 카드를 버리거나 바뀌었을 때 메모리 무효화 (단일 봇 또는 플레이어 목록 모두 지원)
 */
export function invalidatePlayerMemory(botOrPlayers, targetUserId) {
  if (Array.isArray(botOrPlayers)) {
    botOrPlayers.forEach((p) => {
      if (p && p.isBot && p.memory?.knownPlayerCards) {
        delete p.memory.knownPlayerCards[targetUserId];
      }
    });
  } else if (botOrPlayers && botOrPlayers.isBot && botOrPlayers.memory?.knownPlayerCards) {
    delete botOrPlayers.memory.knownPlayerCards[targetUserId];
  }
}
