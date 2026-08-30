import { GameState, PlayerId, CardId, CardValue, CardInstance } from './types';
import { CARD_DEFINITIONS } from './cards';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePlayCard(
  state: GameState,
  playerId: PlayerId,
  cardId: CardId,
  targetId?: PlayerId,
  guessValue?: CardValue
): ValidationResult {
  if (state.matchState !== 'PLAYING') {
    return { valid: false, error: '게임이 진행 중이 아닙니다.' };
  }

  if (state.currentTurnPlayerId !== playerId) {
    return { valid: false, error: '현재 당신의 턴이 아닙니다.' };
  }

  const player = state.players.find(p => p.id === playerId);
  const secret = state.secrets[playerId];

  if (!player || player.isEliminated || !secret) {
    return { valid: false, error: '유효하지 않거나 이미 탈락한 플레이어입니다.' };
  }

  const card = secret.hand.find(c => c.id === cardId);
  if (!card) {
    return { valid: false, error: '보유하고 있지 않은 카드입니다.' };
  }

  // Countess Rule (7) with Prince (5) or King (6)
  const hasCountess = secret.hand.some(c => c.value === 7);
  const hasPrinceOrKing = secret.hand.some(c => c.value === 5 || c.value === 6);

  if (hasCountess && hasPrinceOrKing && card.value !== 7) {
    return { valid: false, error: '백작부인(7)을 들고 있을 때는 왕자(5)나 국왕(6) 대신 백작부인을 내야 합니다.' };
  }

  const meta = CARD_DEFINITIONS[card.value];

  // Target validation
  const eligibleTargets = state.players.filter(
    p => !p.isEliminated && (!p.isProtected || (meta.canTargetSelf && p.id === playerId))
  );

  // Exclude self if cannot target self
  const validOpponents = eligibleTargets.filter(p => p.id !== playerId);

  if (meta.needsTarget) {
    // If all opponents are protected/eliminated
    if (meta.canTargetSelf) {
      // Prince can target self
      if (!targetId) {
        return { valid: false, error: '대상을 선택해야 합니다.' };
      }
    } else {
      if (validOpponents.length > 0) {
        if (!targetId) {
          return { valid: false, error: '대상을 선택해야 합니다.' };
        }
        if (targetId === playerId) {
          return { valid: false, error: '자기 자신을 대상으로 지정할 수 없습니다.' };
        }
        const targetPlayer = state.players.find(p => p.id === targetId);
        if (!targetPlayer || targetPlayer.isEliminated) {
          return { valid: false, error: '대상 플레이어가 유효하지 않거나 이미 탈락했습니다.' };
        }
        if (targetPlayer.isProtected) {
          return { valid: false, error: '대상 플레이어가 하녀의 보호를 받고 있습니다.' };
        }
      }
      // If no valid opponents exist, targetId can be omitted (fizzles safely)
    }
  }

  // Guard guess validation
  if (card.value === 1 && targetId && validOpponents.length > 0) {
    if (!guessValue || guessValue < 2 || guessValue > 8) {
      return { valid: false, error: '경비병은 2번(사제)부터 8번(공주) 사이의 카드를 지목해야 합니다.' };
    }
  }

  return { valid: true };
}
