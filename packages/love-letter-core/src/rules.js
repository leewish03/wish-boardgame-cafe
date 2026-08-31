import { CARD_DEFINITIONS } from './cards.js';

export function validatePlayCard(
  state,
  playerId,
  cardId,
  targetId,
  guessValue
) {
  if (state.matchState !== 'PLAYING') {
    return { valid: false, error: '게임이 진행 중이 아닙니다.' };
  }

  if (state.currentTurnPlayerId !== playerId) {
    return { valid: false, error: '현재 당신의 턴이 아닙니다.' };
  }

  const player = state.players.find((p) => p.id === playerId);
  const secret = state.secrets[playerId];

  if (!player || player.isEliminated || !secret) {
    return { valid: false, error: '유효하지 않거나 이미 탈락한 플레이어입니다.' };
  }

  const card = secret.hand.find((c) => c.id === cardId);
  if (!card) {
    return { valid: false, error: '손패에 해당 카드가 없습니다.' };
  }

  // Countess Rule (7) with Prince (5) or King (6)
  const hasCountess = secret.hand.some((c) => c.value === 7);
  const hasPrinceOrKing = secret.hand.some((c) => c.value === 5 || c.value === 6);

  if (hasCountess && hasPrinceOrKing && (card.value === 5 || card.value === 6)) {
    return {
      valid: false,
      error: '백작부인(7)을 손에 쥐고 있을 때 왕자(5)나 국왕(6)을 낼 수 없습니다.',
    };
  }

  const meta = CARD_DEFINITIONS[card.value];

  // Active opponents who are not protected
  const validOpponents = state.players.filter(
    (p) => p.id !== playerId && !p.isEliminated && !p.isProtected
  );

  if (meta.needsTarget) {
    if (meta.canTargetSelf) {
      // Prince (5): Can target self or unprotected opponents
      const eligiblePrinceTargets = state.players.filter(
        (p) => !p.isEliminated && (!p.isProtected || p.id === playerId)
      );

      if (!targetId) {
        return { valid: false, error: '왕자 카드의 대상을 선택해야 합니다.' };
      }

      const targetPlayer = state.players.find((p) => p.id === targetId);
      if (!targetPlayer || targetPlayer.isEliminated) {
        return { valid: false, error: '대상 플레이어가 유효하지 않거나 이미 탈락했습니다.' };
      }
      if (targetPlayer.isProtected && targetPlayer.id !== playerId) {
        return { valid: false, error: '대상 플레이어가 하녀의 보호를 받고 있습니다.' };
      }
    } else {
      // Guard (1), Priest (2), Baron (3), King (6)
      if (validOpponents.length > 0) {
        if (!targetId) {
          return { valid: false, error: '대상을 선택해야 합니다.' };
        }
        if (targetId === playerId) {
          return { valid: false, error: '자기 자신을 대상으로 지정할 수 없습니다.' };
        }
        const targetPlayer = state.players.find((p) => p.id === targetId);
        if (!targetPlayer || targetPlayer.isEliminated) {
          return { valid: false, error: '대상 플레이어가 유효하지 않거나 이미 탈락했습니다.' };
        }
        if (targetPlayer.isProtected) {
          return { valid: false, error: '대상 플레이어가 하녀의 보호를 받고 있습니다.' };
        }
      }
      // If validOpponents.length === 0, targeted cards can be played without target (fizzles safely)
    }
  }

  // Guard guess validation (cannot guess 1, must guess 2~8)
  if (card.value === 1 && targetId && validOpponents.length > 0) {
    if (!guessValue || guessValue < 2 || guessValue > 8) {
      return {
        valid: false,
        error: '경비병은 2번(사제)부터 8번(공주) 사이의 카드를 지목해야 합니다. (경비병 추측 불가)',
      };
    }
  }

  return { valid: true };
}
