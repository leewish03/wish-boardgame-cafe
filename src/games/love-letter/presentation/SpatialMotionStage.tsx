import React, { useMemo } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { GameEventEnvelope } from '../../../../packages/protocol/src/envelopes';
import { PlayerPublic, CardInstance, CardValue } from '../../../../packages/love-letter-core/src/types';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { getHeraldicIcon } from './heraldicIcons';
import { MOTION_TOKENS } from './motionTokens';
import { PresentationPhase } from '../machines/presentationMachine';
import { Shield, Eye, Swords, Crown, HeartCrack, Sparkles, Check, X, ArrowLeftRight, Lock } from 'lucide-react';

interface SpatialMotionStageProps {
  currentAction: GameEventEnvelope | null;
  phase?: PresentationPhase;
  myUserId?: string;
  players?: PlayerPublic[];
}

export const SpatialMotionStage: React.FC<SpatialMotionStageProps> = ({
  currentAction,
  phase = 'IDLE',
  myUserId = '',
  players = [],
}) => {
  if (!currentAction || !currentAction.event || phase === 'IDLE') return null;

  const { event } = currentAction;

  // Helper to look up player by id
  const getPlayer = (id?: string): { nickname: string; avatar: string } => {
    if (!id) return { nickname: '플레이어', avatar: '👑' };
    const p = players.find(pl => pl.id === id);
    return {
      nickname: p?.nickname || id,
      avatar: p?.avatar || '👑',
    };
  };

  // Determine action card value and metadata
  const cardVal: CardValue = (event as any).card?.value ||
    (event as any).guessedCard?.value ||
    (event as any).discardedCard?.value ||
    (event as any).revealedCard?.value ||
    1;

  const cardMeta = CARD_DEFINITIONS[cardVal] || { name: (event as any).card?.name || '카드', nameEn: '', description: '' };

  const actorId: string = (event as any).actorId || (event as any).playerId || '';
  const targetId: string = (event as any).targetId || '';
  const actor = getPlayer(actorId);
  const target = getPlayer(targetId);

  const isActorMe = actorId === myUserId;
  const isTargetMe = targetId === myUserId;

  return (
    <OverlayContainer pointerEvents="none">
      <AnimatePresence mode="wait">
        {/* ========================================================================= */}
        {/* 1. TOP ACTION BANNER (WHO & CARD) - Displayed across all active phases */}
        {/* ========================================================================= */}
        {(event.type === 'CARD_PLAYED' || event.type === 'CARD_GUESSED' || event.type === 'GUARD_SUCCEEDED' || event.type === 'GUARD_FAILED' || event.type === 'BARON_COMPARED' || event.type === 'HANDMAID_PROTECTED' || event.type === 'PRINCE_DISCARDED' || event.type === 'HANDS_SWAPPED' || event.type === 'PLAYER_ELIMINATED') && (
          <ActionBanner
            key={`banner_${currentAction.eventId}`}
            as={motion.div}
            initial={{ opacity: 0, y: -24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={MOTION_TOKENS.spring.cardPlay}
          >
            <ActionEmblem>{getHeraldicIcon(cardVal, 22)}</ActionEmblem>
            <ActionText>
              <ActorName>{actor.nickname}</ActorName>
              <span> 님이 </span>
              <CardHighlight>[{cardVal}번 {cardMeta.name}]</CardHighlight>
              <span> {cardVal === 4 ? '활성화' : '사용'}</span>
              {targetId && (
                <>
                  <TargetArrow>➔</TargetArrow>
                  <TargetName>{target.nickname}</TargetName>
                </>
              )}
            </ActionText>
          </ActionBanner>
        )}
      </AnimatePresence>

      <CenterStageArea>
        <AnimatePresence mode="wait">
          {/* ========================================================================= */}
          {/* 1. GUARD (1) - 저격: 추측 -> MATCH(공개+탈락) / MISS(비공개 방어) */}
          {/* ========================================================================= */}
          {cardVal === 1 && (
            <GuardPresentation key={`guard_${currentAction.eventId}_${phase}`}>
              {/* TARGET & GUESS PHASE */}
              {(phase === 'CARD_PLAYING' || phase === 'TARGET_REVEAL' || phase === 'EFFECT') && (
                <GuardAimCard
                  as={motion.div}
                  initial={{ scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={MOTION_TOKENS.spring.snappy}
                >
                  <ReticleTargetRing>
                    <ReticleCrosshair />
                    <ReticleCenterIcon>{target.avatar}</ReticleCenterIcon>
                  </ReticleTargetRing>
                  <AimDetails>
                    <TargetHeader>🎯 저격 지목: <strong>{target.nickname}</strong></TargetHeader>
                    {(event as any).guessValue ? (
                      <GuessBadge>
                        <span>추측 카드: </span>
                        <strong>{(event as any).guessValue}번 {CARD_DEFINITIONS[(event as any).guessValue as CardValue]?.name || '카드'}</strong>
                      </GuessBadge>
                    ) : (
                      <GuessBadge>
                        <span>상대방의 손패를 날카롭게 추측합니다...</span>
                      </GuessBadge>
                    )}
                  </AimDetails>
                </GuardAimCard>
              )}

              {/* RESULT: MATCH vs MISS */}
              {(phase === 'RESULT' || phase === 'DISCARDING' || phase === 'SETTLING') && (
                <AnimatePresence>
                  {event.type === 'GUARD_SUCCEEDED' || (event as any).guessedCard || ((event as any).reason && (event as any).reason.includes('경비병')) ? (
                    // MATCH: 카드 공개 + 탈락 스탬프
                    <MatchResultBox
                      as={motion.div}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={MOTION_TOKENS.spring.impact}
                    >
                      <ResultHeader $success>
                        <Check size={18} />
                        <span>MATCH! 저격 성공</span>
                      </ResultHeader>
                      <RevealedCardContainer>
                        <MiniCardFace $val={(event as any).guessedCard?.value || (event as any).guessValue || 1}>
                          <EmblemWrap>{getHeraldicIcon((event as any).guessedCard?.value || (event as any).guessValue || 1, 26)}</EmblemWrap>
                          <MiniVal>{(event as any).guessedCard?.value || (event as any).guessValue || 1}</MiniVal>
                          <MiniName>{(event as any).guessedCard?.name || CARD_DEFINITIONS[(event as any).guessValue as CardValue]?.name || '카드'}</MiniName>
                        </MiniCardFace>
                      </RevealedCardContainer>
                      <EliminatedStamp>💥 {target.nickname} 탈락</EliminatedStamp>
                    </MatchResultBox>
                  ) : (
                    // MISS: 카드 비공개 + 튕김 방패
                    <MissResultBox
                      as={motion.div}
                      initial={{ scale: 0.7, opacity: 0, x: -10 }}
                      animate={{ scale: 1, opacity: 1, x: 0 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={MOTION_TOKENS.spring.deflect}
                    >
                      <ResultHeader $success={false}>
                        <X size={18} />
                        <span>MISS (저격 실패)</span>
                      </ResultHeader>
                      <MissDeflectIcon>🛡️</MissDeflectIcon>
                      <MissText>
                        <strong>{target.nickname}</strong> 님은 해당 카드가 아닙니다.
                        <SecretNote>(상대 손패는 공개되지 않습니다)</SecretNote>
                      </MissText>
                    </MissResultBox>
                  )}
                </AnimatePresence>
              )}
            </GuardPresentation>
          )}

          {/* ========================================================================= */}
          {/* 2. PRIEST (2) - 사제: 시전자 전용 Private Reveal (타인 미공개) */}
          {/* ========================================================================= */}
          {cardVal === 2 && (
            <PriestPresentation key={`priest_${currentAction.eventId}_${phase}`}>
              <PriestMirrorBox
                as={motion.div}
                initial={{ scale: 0.8, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={MOTION_TOKENS.spring.gentle}
              >
                <MirrorHeader>
                  <Eye size={18} color="#2dd4bf" />
                  <span>사제의 은밀한 신탁 투시</span>
                </MirrorHeader>

                {isActorMe && (event as any).revealedCard ? (
                  // 시전자 화면: 손패 100% 공개
                  <PrivatePeekBody>
                    <PeekNotice>[{target.nickname}] 님의 손패를 확인했습니다</PeekNotice>
                    <RevealedCardContainer>
                      <MiniCardFace $val={(event as any).revealedCard.value}>
                        <EmblemWrap>{getHeraldicIcon((event as any).revealedCard.value, 32)}</EmblemWrap>
                        <MiniVal>{(event as any).revealedCard.value}</MiniVal>
                        <MiniName>{(event as any).revealedCard.name}</MiniName>
                      </MiniCardFace>
                    </RevealedCardContainer>
                    <PrivateTag>🔒 나에게만 보이는 은밀한 정보</PrivateTag>
                  </PrivatePeekBody>
                ) : (
                  // 타 플레이어 화면: 비밀 확인 중 안내만 표시
                  <PublicPeekBody>
                    <PeekTargetInfo>
                      <PeekAvatar>{target.avatar}</PeekAvatar>
                      <PeekText>
                        <strong>{actor.nickname}</strong> 님이 <strong>{target.nickname}</strong> 님의 손패를 은밀히 확인했습니다.
                      </PeekText>
                    </PeekTargetInfo>
                    <SecretLockNote>
                      <Lock size={13} />
                      <span>카드의 정체는 시전자에게만 공개됩니다.</span>
                    </SecretLockNote>
                  </PublicPeekBody>
                )}
              </PriestMirrorBox>
            </PriestPresentation>
          )}

          {/* ========================================================================= */}
          {/* 3. BARON (3) - 남작: 양측 대결 -> 패자 카드만 공개+탈락 (승자 비공개) */}
          {/* ========================================================================= */}
          {cardVal === 3 && (
            <BaronPresentation key={`baron_${currentAction.eventId}_${phase}`}>
              <DuelBox
                as={motion.div}
                initial={{ scale: 0.75, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={MOTION_TOKENS.spring.impact}
              >
                <DuelHeader>
                  <Swords size={18} color="#f43f5e" />
                  <span>비밀 남작 결투 (손패 크기 비교)</span>
                </DuelHeader>

                <DuelArena>
                  {/* Actor side */}
                  <DuelistSide>
                    <DuelistAvatar>{actor.avatar}</DuelistAvatar>
                    <DuelistName>{actor.nickname}</DuelistName>
                    {/* Only revealed if actor is eliminated */}
                    {(phase === 'RESULT' || phase === 'DISCARDING' || phase === 'SETTLING') &&
                    (event as any).eliminatedId === actorId ? (
                      <MiniCardFace $val={1}>
                        <EmblemWrap>{getHeraldicIcon(1, 20)}</EmblemWrap>
                        <MiniName>패배 공개</MiniName>
                      </MiniCardFace>
                    ) : (
                      <SecretMysteryCard>🎴 ?</SecretMysteryCard>
                    )}
                  </DuelistSide>

                  <ClashIconWrap
                    as={motion.div}
                    animate={{ scale: [1, 1.25, 1], rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                  >
                    VS
                  </ClashIconWrap>

                  {/* Target side */}
                  <DuelistSide>
                    <DuelistAvatar>{target.avatar}</DuelistAvatar>
                    <DuelistName>{target.nickname}</DuelistName>
                    {/* Only revealed if target is eliminated */}
                    {(phase === 'RESULT' || phase === 'DISCARDING' || phase === 'SETTLING') &&
                    (event as any).eliminatedId === targetId ? (
                      <MiniCardFace $val={1}>
                        <EmblemWrap>{getHeraldicIcon(1, 20)}</EmblemWrap>
                        <MiniName>패배 공개</MiniName>
                      </MiniCardFace>
                    ) : (
                      <SecretMysteryCard>🎴 ?</SecretMysteryCard>
                    )}
                  </DuelistSide>
                </DuelArena>

                {/* RESULT: Loser eliminated banner */}
                {(phase === 'RESULT' || phase === 'DISCARDING' || phase === 'SETTLING') && (
                  <DuelResultBanner>
                    {(event as any).eliminatedId ? (
                      <DuelResultText>
                        💥 <strong>{getPlayer((event as any).eliminatedId).nickname}</strong> 결투 패배로 탈락!
                        <WinnerSecretNote>(승자의 카드는 계속 비공개로 유지됩니다)</WinnerSecretNote>
                      </DuelResultText>
                    ) : (
                      <DuelResultText>
                        ⚖️ 무승부! (두 사람의 손패 숫자가 같습니다)
                      </DuelResultText>
                    )}
                  </DuelResultBanner>
                )}
              </DuelBox>
            </BaronPresentation>
          )}

          {/* ========================================================================= */}
          {/* 4. HANDMAID (4) - 하녀: 작은 shield indicator 전개 (지속 glow 금지) */}
          {/* ========================================================================= */}
          {cardVal === 4 && (
            <HandmaidPresentation key={`handmaid_${currentAction.eventId}_${phase}`}>
              <ShieldDeployBox
                as={motion.div}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={MOTION_TOKENS.spring.gentle}
              >
                <ShieldIconWrap>
                  <Shield size={32} color="#10b981" />
                </ShieldIconWrap>
                <ShieldTitle>하녀의 면역 결계 전개</ShieldTitle>
                <ShieldSub>
                  <strong>{actor.nickname}</strong> 님은 다음 턴 시작 전까지 모든 지목 효과로부터 보호됩니다.
                </ShieldSub>
                <RestrainedSealBadge>🛡️ 보호 인디케이터 활성화</RestrainedSealBadge>
              </ShieldDeployBox>
            </HandmaidPresentation>
          )}

          {/* ========================================================================= */}
          {/* 5. PRINCE (5) - 왕자: 대상 카드 공개 버림 -> 새 드로우 (공주 버림 시 즉시 탈락) */}
          {/* ========================================================================= */}
          {cardVal === 5 && (
            <PrincePresentation key={`prince_${currentAction.eventId}_${phase}`}>
              <PrinceBox
                as={motion.div}
                initial={{ scale: 0.8, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={MOTION_TOKENS.spring.snappy}
              >
                <PrinceHeader>
                  <Crown size={20} color="#f59e0b" />
                  <span>황실 왕자의 칙령: 강제 버림 및 재드로우</span>
                </PrinceHeader>

                <PrinceBody>
                  <TargetCallout>
                    대상: <strong>{target.nickname}</strong>
                  </TargetCallout>

                  {/* Discarded card reveal */}
                  {(event as any).discardedCard && (
                    <DiscardRevealWrap
                      as={motion.div}
                      initial={{ scale: 0.7, rotate: -8 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={MOTION_TOKENS.spring.cardDeal}
                    >
                      <DiscardLabel>버려진 손패:</DiscardLabel>
                      <MiniCardFace $val={(event as any).discardedCard.value}>
                        <EmblemWrap>{getHeraldicIcon((event as any).discardedCard.value, 30)}</EmblemWrap>
                        <MiniVal>{(event as any).discardedCard.value}</MiniVal>
                        <MiniName>{(event as any).discardedCard.name}</MiniName>
                      </MiniCardFace>
                    </DiscardRevealWrap>
                  )}

                  {/* Princess discarded check */}
                  {(event as any).discardedCard?.value === 8 ? (
                    <PrincessElimNotice>
                      💥 <strong>[공주 (8)]</strong>를 버렸으므로 즉시 게임에서 탈락합니다!
                    </PrincessElimNotice>
                  ) : (
                    <DrawNewCardNotice>
                      🃏 버림패로 이동 완료 ➔ 덱에서 새 카드 1장을 드로우합니다.
                    </DrawNewCardNotice>
                  )}
                </PrinceBody>
              </PrinceBox>
            </PrincePresentation>
          )}

          {/* ========================================================================= */}
          {/* 6. KING (6) - 국왕: 카드 뒷면 swap (정보 철저 미노출) */}
          {/* ========================================================================= */}
          {cardVal === 6 && (
            <KingPresentation key={`king_${currentAction.eventId}_${phase}`}>
              <KingSwapBox
                as={motion.div}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={MOTION_TOKENS.spring.snappy}
              >
                <KingHeader>
                  <Crown size={20} color="#d97706" />
                  <span>국왕의 칙령: 비밀 손패 맞교환</span>
                </KingHeader>

                <SwapFlightStage>
                  <PlayerSideBox>
                    <SideAvatar>{actor.avatar}</SideAvatar>
                    <SideNick>{actor.nickname}</SideNick>
                  </PlayerSideBox>

                  {/* Card backs swapping positions */}
                  <SwapCardsAnimation>
                    <CardBackMotion
                      as={motion.div}
                      animate={{ x: [0, 45, 90], y: [0, -18, 0], rotateZ: [0, 15, 0] }}
                      transition={{ duration: 0.8, ease: 'easeInOut' }}
                    >
                      🎴
                      <BackFoilSeal>SEAL</BackFoilSeal>
                    </CardBackMotion>

                    <SwapArrowsCenter>
                      <ArrowLeftRight size={22} color="#d4af37" />
                    </SwapArrowsCenter>

                    <CardBackMotion
                      as={motion.div}
                      animate={{ x: [0, -45, -90], y: [0, 18, 0], rotateZ: [0, -15, 0] }}
                      transition={{ duration: 0.8, ease: 'easeInOut' }}
                    >
                      🎴
                      <BackFoilSeal>SEAL</BackFoilSeal>
                    </CardBackMotion>
                  </SwapCardsAnimation>

                  <PlayerSideBox>
                    <SideAvatar>{target.avatar}</SideAvatar>
                    <SideNick>{target.nickname}</SideNick>
                  </PlayerSideBox>
                </SwapFlightStage>

                <KingNoticeText>
                  🔒 두 플레이어의 손패가 서로 교환되었습니다. (카드 앞면 미노출)
                </KingNoticeText>
              </KingSwapBox>
            </KingPresentation>
          )}

          {/* ========================================================================= */}
          {/* 7. COUNTESS (7) - 백작부인: 단순 제출 및 버림패 이동 */}
          {/* ========================================================================= */}
          {cardVal === 7 && (
            <CountessPresentation key={`countess_${currentAction.eventId}_${phase}`}>
              <CountessBox
                as={motion.div}
                initial={{ scale: 0.85, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={MOTION_TOKENS.spring.gentle}
              >
                <CountessEmblemWrap>
                  {getHeraldicIcon(7, 36)}
                </CountessEmblemWrap>
                <CountessTitle>🌹 황실 백작부인의 우아한 이동</CountessTitle>
                <CountessSub>
                  <strong>{actor.nickname}</strong> 님이 백작부인 카드를 안전하게 버림패로 제출했습니다.
                </CountessSub>
              </CountessBox>
            </CountessPresentation>
          )}

          {/* ========================================================================= */}
          {/* 8. PRINCESS (8) - 공주: 공개 -> 자기 탈락 표시 */}
          {/* ========================================================================= */}
          {cardVal === 8 && (
            <PrincessPresentation key={`princess_${currentAction.eventId}_${phase}`}>
              <PrincessElimBox
                as={motion.div}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={MOTION_TOKENS.spring.impact}
              >
                <HeartCrack size={38} color="#be123c" />
                <PrincessTitle>비극적인 결말: 공주 카드 플레이</PrincessTitle>
                <PrincessSub>
                  공주 카드는 플레이되거나 버려지는 즉시 해당 플레이어를 탈락시킵니다!
                </PrincessSub>
                <PrincessElimStamp>💥 {actor.nickname} 즉시 탈락</PrincessElimStamp>
              </PrincessElimBox>
            </PrincessPresentation>
          )}
        </AnimatePresence>
      </CenterStageArea>
    </OverlayContainer>
  );
};

// =========================================================================
// Styled Components
// =========================================================================

const OverlayContainer = styled.div<{ pointerEvents?: string }>`
  position: absolute;
  inset: 0;
  pointer-events: ${props => props.pointerEvents || 'none'};
  z-index: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 48px;
  overflow: hidden;
`;

const ActionBanner = styled.div`
  background: rgba(24, 24, 27, 0.95);
  border: 1.5px solid #d4af37;
  border-radius: 20px;
  padding: 6px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 16px rgba(212, 175, 55, 0.3);
  backdrop-filter: blur(8px);
  max-width: 92%;
  box-sizing: border-box;
`;

const ActionEmblem = styled.div`
  display: flex;
  align-items: center;
`;

const ActionText = styled.div`
  font-size: 12px;
  color: #fafafa;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
`;

const ActorName = styled.span`
  color: #fef08a;
  font-weight: 800;
`;

const CardHighlight = styled.strong`
  color: #d4af37;
  font-weight: 800;
`;

const TargetArrow = styled.span`
  color: #a1a1aa;
  font-weight: 900;
  margin: 0 2px;
`;

const TargetName = styled.span`
  color: #f43f5e;
  font-weight: 800;
`;

const CenterStageArea = styled.div`
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
`;

// Common Box Container
const BaseCardPresentationBox = styled.div`
  background: rgba(24, 24, 27, 0.96);
  border: 1.5px solid #d4af37;
  border-radius: 16px;
  padding: 16px 20px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(212, 175, 55, 0.25);
  backdrop-filter: blur(10px);
  width: 100%;
  max-width: 380px;
  box-sizing: border-box;
`;

// 1. Guard
const GuardPresentation = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
`;

const GuardAimCard = styled(BaseCardPresentationBox)`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const ReticleTargetRing = styled.div`
  position: relative;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 2px dashed #f59e0b;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ReticleCrosshair = styled.div`
  position: absolute;
  inset: 0;
  &::before, &::after {
    content: '';
    position: absolute;
    background: rgba(245, 158, 11, 0.6);
  }
  &::before {
    top: 50%; left: 0; right: 0; height: 1px;
  }
  &::after {
    left: 50%; top: 0; bottom: 0; width: 1px;
  }
`;

const ReticleCenterIcon = styled.span`
  font-size: 24px;
`;

const AimDetails = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const TargetHeader = styled.div`
  font-size: 13px;
  color: #fafafa;
  strong { color: #f59e0b; }
`;

const GuessBadge = styled.div`
  font-size: 12px;
  color: #a1a1aa;
  strong { color: #fef08a; font-weight: 800; }
`;

const MatchResultBox = styled(BaseCardPresentationBox)`
  border-color: #be123c;
  box-shadow: 0 10px 30px rgba(190, 18, 60, 0.4);
`;

const MissResultBox = styled(BaseCardPresentationBox)`
  border-color: #3b82f6;
  box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
`;

const ResultHeader = styled.div<{ $success: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 800;
  color: ${props => props.$success ? '#f43f5e' : '#60a5fa'};
  margin-bottom: 10px;
`;

const RevealedCardContainer = styled.div`
  display: flex;
  justify-content: center;
  margin: 10px 0;
`;

const MiniCardFace = styled.div<{ $val: number }>`
  width: 72px;
  height: 104px;
  background: radial-gradient(circle at 50% 30%, #ffffff 0%, #f7f4ed 100%);
  border: 1.5px solid #d4af37;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  box-sizing: border-box;
`;

const EmblemWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MiniVal = styled.span`
  font-size: 16px;
  font-weight: 900;
  color: #c5a059;
  font-family: serif;
`;

const MiniName = styled.span`
  font-size: 10px;
  font-weight: 800;
  color: #18181b;
`;

const EliminatedStamp = styled.div`
  background: #be123c;
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  padding: 4px 12px;
  border-radius: 12px;
  display: inline-block;
  margin-top: 4px;
`;

const MissDeflectIcon = styled.div`
  font-size: 32px;
  margin-bottom: 6px;
`;

const MissText = styled.div`
  font-size: 12px;
  color: #e2e8f0;
  strong { color: #93c5fd; }
`;

const SecretNote = styled.span`
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
`;

// 2. Priest
const PriestPresentation = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
`;

const PriestMirrorBox = styled(BaseCardPresentationBox)`
  border-color: #2dd4bf;
  box-shadow: 0 10px 30px rgba(45, 212, 191, 0.35);
`;

const MirrorHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
  color: #5eead4;
  margin-bottom: 12px;
`;

const PrivatePeekBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const PeekNotice = styled.p`
  margin: 0 0 8px;
  font-size: 12px;
  color: #e2e8f0;
`;

const PrivateTag = styled.span`
  font-size: 10.5px;
  color: #2dd4bf;
  margin-top: 6px;
`;

const PublicPeekBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
`;

const PeekTargetInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PeekAvatar = styled.span`
  font-size: 24px;
`;

const PeekText = styled.span`
  font-size: 12px;
  color: #e2e8f0;
  strong { color: #fef08a; }
`;

const SecretLockNote = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #94a3b8;
`;

// 3. Baron
const BaronPresentation = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
`;

const DuelBox = styled(BaseCardPresentationBox)`
  border-color: #f43f5e;
  box-shadow: 0 10px 30px rgba(244, 63, 94, 0.35);
`;

const DuelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 800;
  color: #fda4af;
  margin-bottom: 14px;
`;

const DuelArena = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-bottom: 12px;
`;

const DuelistSide = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

const DuelistAvatar = styled.div`
  font-size: 24px;
`;

const DuelistName = styled.span`
  font-size: 11px;
  color: #e2e8f0;
  font-weight: 700;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SecretMysteryCard = styled.div`
  width: 60px;
  height: 88px;
  background: #27272a;
  border: 1.5px solid #d4af37;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  color: #d4af37;
`;

const ClashIconWrap = styled.div`
  font-size: 18px;
  font-weight: 900;
  color: #f43f5e;
`;

const DuelResultBanner = styled.div`
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(244, 63, 94, 0.2);
`;

const DuelResultText = styled.div`
  font-size: 12px;
  color: #fecdd3;
  strong { color: #fff; }
`;

const WinnerSecretNote = styled.span`
  display: block;
  font-size: 10.5px;
  color: #94a3b8;
  margin-top: 2px;
`;

// 4. Handmaid
const HandmaidPresentation = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
`;

const ShieldDeployBox = styled(BaseCardPresentationBox)`
  border-color: #10b981;
  box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

const ShieldIconWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
`;

const ShieldTitle = styled.h4`
  margin: 0;
  font-size: 13.5px;
  color: #6ee7b7;
  font-weight: 800;
`;

const ShieldSub = styled.p`
  margin: 0;
  font-size: 11.5px;
  color: #e2e8f0;
  strong { color: #fef08a; }
`;

const RestrainedSealBadge = styled.span`
  background: rgba(6, 95, 70, 0.8);
  color: #a7f3d0;
  font-size: 10.5px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 10px;
  margin-top: 6px;
`;

// 5. Prince
const PrincePresentation = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
`;

const PrinceBox = styled(BaseCardPresentationBox)`
  border-color: #f59e0b;
`;

const PrinceHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
  color: #fbbf24;
  margin-bottom: 10px;
`;

const PrinceBody = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const TargetCallout = styled.div`
  font-size: 12px;
  color: #fafafa;
  strong { color: #f59e0b; }
`;

const DiscardRevealWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const DiscardLabel = styled.span`
  font-size: 11px;
  color: #a1a1aa;
`;

const PrincessElimNotice = styled.div`
  font-size: 12px;
  color: #f43f5e;
  font-weight: 800;
  margin-top: 4px;
`;

const DrawNewCardNotice = styled.div`
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
`;

// 6. King
const KingPresentation = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
`;

const KingSwapBox = styled(BaseCardPresentationBox)`
  border-color: #d97706;
`;

const KingHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
  color: #fcd34d;
  margin-bottom: 12px;
`;

const SwapFlightStage = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
`;

const PlayerSideBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 60px;
`;

const SideAvatar = styled.div`
  font-size: 22px;
`;

const SideNick = styled.span`
  font-size: 11px;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60px;
`;

const SwapCardsAnimation = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
`;

const CardBackMotion = styled.div`
  width: 44px;
  height: 64px;
  background: radial-gradient(circle at 50% 50%, #451a03 0%, #18181b 100%);
  border: 1.5px solid #d4af37;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
`;

const BackFoilSeal = styled.span`
  font-size: 7px;
  font-weight: 900;
  color: #d4af37;
  letter-spacing: 0.05em;
`;

const SwapArrowsCenter = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const KingNoticeText = styled.div`
  font-size: 11.5px;
  color: #fed7aa;
  margin-top: 8px;
`;

// 7. Countess
const CountessPresentation = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
`;

const CountessBox = styled(BaseCardPresentationBox)`
  border-color: #f43f5e;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

const CountessEmblemWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CountessTitle = styled.h4`
  margin: 0;
  font-size: 13.5px;
  color: #fda4af;
  font-weight: 800;
`;

const CountessSub = styled.p`
  margin: 0;
  font-size: 11.5px;
  color: #e2e8f0;
  strong { color: #fef08a; }
`;

// 8. Princess
const PrincessPresentation = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
`;

const PrincessElimBox = styled(BaseCardPresentationBox)`
  border-color: #be123c;
  box-shadow: 0 10px 30px rgba(190, 18, 60, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const PrincessTitle = styled.h4`
  margin: 0;
  font-size: 14px;
  color: #fb7185;
  font-weight: 800;
`;

const PrincessSub = styled.p`
  margin: 0;
  font-size: 11.5px;
  color: #e2e8f0;
`;

const PrincessElimStamp = styled.div`
  background: #be123c;
  color: #fff;
  font-size: 12.5px;
  font-weight: 900;
  padding: 5px 14px;
  border-radius: 12px;
  margin-top: 4px;
`;

