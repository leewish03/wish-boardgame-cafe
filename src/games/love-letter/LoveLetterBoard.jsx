import React, { useState, useEffect } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME } from '../../shared/theme';
import {
  Button,
  Card,
  Badge,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  SideDrawer,
  PauseOverlay,
} from '../../shared/components';
import { sfx } from '../../shared/sfx';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MessageSquare,
  Scroll,
  LogOut,
  Crown,
  Shield,
  Eye,
  Swords,
  Sparkles,
  Award,
  AlertTriangle,
  Play,
  RotateCcw,
} from 'lucide-react';

// =========================================================================
// Card Definitions
// =========================================================================

export const CARD_DATA = {
  1: { value: 1, name: '경비병', nameEn: 'Guard', count: 5, color: '#3b82f6', icon: '🛡️', desc: '상대 1명을 지목하여 2~8번 카드를 추측합니다. 일치 시 상대 탈락!' },
  2: { value: 2, name: '사제', nameEn: 'Priest', count: 2, color: '#06b6d4', icon: '📜', desc: '상대 1명을 지목하여 그 사람의 손패를 비밀리에 확인합니다.' },
  3: { value: 3, name: '남작', nameEn: 'Baron', count: 2, color: '#a855f7', icon: '⚔️', desc: '상대 1명과 비밀리에 손패 숫자를 비교하여 더 낮은 쪽이 탈락합니다.' },
  4: { value: 4, name: '하녀', nameEn: 'Handmaid', count: 2, color: '#10b981', icon: '🌸', desc: '다음 내 턴 시작 전까지 다른 플레이어의 모든 카드 효과로부터 면역 보호됩니다.' },
  5: { value: 5, name: '왕자', nameEn: 'Prince', count: 2, color: '#f59e0b', icon: '👑', desc: '자신 포함 1명을 지목하여 손패를 버리고 새로 1장 드로우하게 합니다.' },
  6: { value: 6, name: '국왕', nameEn: 'King', count: 1, color: '#f97316', icon: '🤴', desc: '상대 1명을 지목하여 자신의 손패와 상대의 손패를 맞교환합니다.' },
  7: { value: 7, name: '백작부인', nameEn: 'Countess', count: 1, color: '#ec4899', icon: '🌹', desc: '손에 왕자(5)나 국왕(6)이 함께 있을 경우, 반드시 백작부인을 먼저 내려놓아야 합니다.' },
  8: { value: 8, name: '공주', nameEn: 'Princess', count: 1, color: '#ef4444', icon: '👸', desc: '이 카드를 내거나 어떤 이유로든 버려지면 즉시 게임에서 탈락합니다.' },
};

// =========================================================================
// Styled Components & Visual Effects
// =========================================================================

const pulseWave = keyframes`
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.8); }
  70% { transform: scale(1.08); box-shadow: 0 0 0 14px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
`;

const turnGlow = keyframes`
  0% { box-shadow: 0 0 6px rgba(245, 158, 11, 0.4); }
  50% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.9); }
  100% { box-shadow: 0 0 6px rgba(245, 158, 11, 0.4); }
`;

const BoardContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
  background-color: ${THEME.background};
  color: ${THEME.foreground};
  position: relative;
  overflow: hidden;
  user-select: none;
`;

const TopNavBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background-color: rgba(9, 9, 11, 0.9);
  border-bottom: 1px solid ${THEME.border};
  backdrop-filter: blur(8px);
  z-index: 100;
  gap: 12px;
`;

const NavLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const GameTitle = styled.h1`
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  color: ${THEME.foreground};
  display: flex;
  align-items: center;
  gap: 6px;
`;

const TurnBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: ${({ $isMyTurn }) =>
    $isMyTurn ? 'rgba(245, 158, 11, 0.15)' : THEME.secondary};
  border: 1px solid
    ${({ $isMyTurn }) => ($isMyTurn ? THEME.gold : THEME.border)};
  padding: 6px 14px;
  border-radius: ${THEME.radius.full};
  font-size: 13px;
  font-weight: 600;
  color: ${({ $isMyTurn }) => ($isMyTurn ? THEME.goldLight : THEME.foreground)};
  animation: ${({ $isMyTurn }) => ($isMyTurn ? turnGlow : 'none')} 2s infinite;
`;

const NavControls = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const TableArea = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px;
  position: relative;
  background: radial-gradient(
    ellipse at center,
    ${THEME.feltGreen} 0%,
    ${THEME.feltGreenDeep} 70%,
    #01140f 100%
  );
  border-radius: ${THEME.radius.xl};
  margin: 12px;
  border: 1px solid rgba(245, 158, 11, 0.25);
  box-shadow: inset 0 0 50px rgba(0, 0, 0, 0.8), 0 10px 30px rgba(0, 0, 0, 0.6);
`;

const OpponentsGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  z-index: 10;
`;

const OpponentSeat = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: rgba(9, 9, 11, 0.85);
  border: 1px solid
    ${({ $isTurn }) => ($isTurn ? THEME.gold : THEME.border)};
  border-radius: ${THEME.radius.xl};
  padding: 10px 14px;
  min-width: 130px;
  position: relative;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transition: all 0.2s;
  opacity: ${({ $isEliminated }) => ($isEliminated ? 0.45 : 1)};
  filter: ${({ $isEliminated }) => ($isEliminated ? 'grayscale(80%)' : 'none')};

  ${({ $isTurn }) =>
    $isTurn &&
    css`
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.5);
    `}
`;

const AvatarWrapper = styled.div`
  position: relative;
  width: 50px;
  height: 50px;
  border-radius: ${THEME.radius.full};
  margin-bottom: 6px;
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  border-radius: ${THEME.radius.full};
  object-fit: cover;
  border: 2px solid ${({ $isTurn }) => ($isTurn ? THEME.gold : THEME.border)};

  ${({ $isSpeaking }) =>
    $isSpeaking &&
    css`
      animation: ${pulseWave} 1.2s infinite;
      border-color: ${THEME.emerald};
    `}
`;

const SpeechBubble = styled.div`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  background-color: rgba(9, 9, 11, 0.95);
  border: 1px solid ${THEME.emerald};
  border-radius: ${THEME.radius.lg};
  padding: 6px 12px;
  font-size: 12px;
  color: ${THEME.foreground};
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  z-index: 50;

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 5px;
    border-style: solid;
    border-color: ${THEME.emerald} transparent transparent transparent;
  }
`;

const OpponentName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${THEME.foreground};
  margin-bottom: 4px;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StatusPills = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
`;

const CenterBoard = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  margin: 20px 0;
  z-index: 5;
`;

const DeckCard = styled.div`
  width: 90px;
  height: 130px;
  border-radius: ${THEME.radius.lg};
  background: linear-gradient(135deg, #18181b 0%, #09090b 100%);
  border: 2px solid ${THEME.gold};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  position: relative;
`;

const PlayedCardSlot = styled.div`
  width: 90px;
  height: 130px;
  border-radius: ${THEME.radius.lg};
  border: 1px dashed rgba(245, 158, 11, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
`;

const HandSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  z-index: 20;
`;

const HandCardsWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 12px;
  height: 170px;
`;

const CardMotion = styled(motion.div)`
  width: 115px;
  height: 165px;
  border-radius: ${THEME.radius.xl};
  background-color: ${THEME.card};
  border: 2px solid ${({ $color }) => $color || THEME.gold};
  padding: 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
  cursor: ${({ $canPlay }) => ($canPlay ? 'pointer' : 'not-allowed')};
  position: relative;
  overflow: hidden;
  user-select: none;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at top left,
      ${({ $color }) => `${$color}22`} 0%,
      transparent 70%
    );
    pointer-events: none;
  }
`;

const CardHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CardValueBadge = styled.span`
  font-size: 1.2rem;
  font-weight: 800;
  color: ${({ $color }) => $color};
  line-height: 1;
`;

const CardEmblem = styled.div`
  font-size: 2.2rem;
  text-align: center;
  margin: 4px 0;
`;

const CardFooterInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const CardNameText = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${THEME.foreground};
  line-height: 1.2;
`;

const CardDescSnippet = styled.div`
  font-size: 9px;
  color: ${THEME.mutedForeground};
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const TargetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  margin-top: 12px;
`;

const TargetButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background-color: ${({ $selected }) =>
    $selected ? 'rgba(245, 158, 11, 0.2)' : THEME.secondary};
  border: 1px solid
    ${({ $selected }) => ($selected ? THEME.gold : THEME.border)};
  border-radius: ${THEME.radius.lg};
  padding: 10px;
  color: ${THEME.foreground};
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: ${THEME.gold};
    background-color: rgba(245, 158, 11, 0.1);
  }
`;

const GuessGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 12px;
`;

const GuessButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: ${({ $selected }) =>
    $selected ? 'rgba(245, 158, 11, 0.2)' : THEME.secondary};
  border: 1px solid
    ${({ $selected }) => ($selected ? THEME.gold : THEME.border)};
  border-radius: ${THEME.radius.md};
  padding: 8px 4px;
  color: ${THEME.foreground};
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: ${THEME.gold};
  }
`;

// =========================================================================
// Love Letter Board Component
// =========================================================================

export default function LoveLetterBoard({
  roomState,
  currentUser,
  socket,
  webrtc,
  stt,
  onLeave,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(true);

  // Card Play Modal States
  const [selectedCard, setSelectedCard] = useState(null);
  const [guardModalOpen, setGuardModalOpen] = useState(false);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [priestResultModalOpen, setPriestResultModalOpen] = useState(false);
  const [priestData, setPriestData] = useState(null);
  const [forfeitModalOpen, setForfeitModalOpen] = useState(false);

  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [selectedGuessValue, setSelectedGuessValue] = useState(2);

  const isMyTurn = roomState?.turnPlayerId === currentUser?.id;
  const myPlayer = roomState?.players?.find((p) => p.id === currentUser?.id);
  const opponents = roomState?.players?.filter((p) => p.id !== currentUser?.id) || [];
  const currentTurnPlayer = roomState?.players?.find((p) => p.id === roomState?.turnPlayerId);

  // Toggle SFX
  const toggleSFX = () => {
    const next = !sfxEnabled;
    sfx.setEnabled(next);
    setSfxEnabled(next);
  };

  // Sound triggers on game events
  useEffect(() => {
    if (isMyTurn) {
      sfx.playTurnAlert();
    }
  }, [isMyTurn]);

  useEffect(() => {
    if (roomState?.gameState === 'ROUND_END' || roomState?.gameState === 'GAME_OVER') {
      sfx.playVictoryFanfare();
    }
  }, [roomState?.gameState]);

  // Listen for Priest private result
  useEffect(() => {
    if (!socket) return;
    const handlePriest = (data) => {
      setPriestData(data);
      setPriestResultModalOpen(true);
    };
    socket.on('game:priest-result', handlePriest);
    return () => socket.off('game:priest-result', handlePriest);
  }, [socket]);

  // Handle Card Click
  const handleCardClick = (card) => {
    if (!isMyTurn || myPlayer?.isEliminated) return;

    // Check Countess constraint: if holding Countess (7) and (Prince 5 or King 6)
    const hasCountess = myPlayer.hand.some((c) => c.value === 7);
    if (hasCountess && (card.value === 5 || card.value === 6)) {
      alert('백작부인(7)을 손에 쥐고 있을 때 왕자(5)나 국왕(6)을 낼 수 없습니다!');
      return;
    }

    setSelectedCard(card);

    // Eligible opponents (alive & not protected)
    const eligibleOpponents = opponents.filter((p) => !p.isEliminated && !p.isProtected);

    // 1. Guard (1)
    if (card.value === 1) {
      if (eligibleOpponents.length === 0) {
        // Everyone protected -> play without target
        executePlay(card.id, null, null);
      } else {
        setSelectedTargetId(eligibleOpponents[0].id);
        setSelectedGuessValue(2);
        setGuardModalOpen(true);
      }
    }
    // 2. Priest (2) / 3. Baron (3) / 6. King (6)
    else if (card.value === 2 || card.value === 3 || card.value === 6) {
      if (eligibleOpponents.length === 0) {
        executePlay(card.id, null, null);
      } else {
        setSelectedTargetId(eligibleOpponents[0].id);
        setTargetModalOpen(true);
      }
    }
    // 5. Prince (5) - can target anyone alive (including self!)
    else if (card.value === 5) {
      const eligiblePrinceTargets = roomState.players.filter((p) => !p.isEliminated && (!p.isProtected || p.id === currentUser.id));
      setSelectedTargetId(currentUser.id);
      setTargetModalOpen(true);
    }
    // 4. Handmaid (4) / 7. Countess (7) / 8. Princess (8)
    else {
      executePlay(card.id, null, null);
    }
  };

  const executePlay = (cardId, targetUserId, guessValue) => {
    sfx.playCardPlay();
    socket.emit(
      'game:play-card',
      {
        cardId,
        targetUserId,
        guessValue,
      },
      (res) => {
        if (!res?.success) {
          alert(res?.error || '카드 제출 실패');
        }
      }
    );
    setSelectedCard(null);
    setGuardModalOpen(false);
    setTargetModalOpen(false);
  };

  const handleNextRoundOrRestart = () => {
    socket.emit('game:start', {}, (res) => {
      if (!res?.success) alert(res?.error || '게임 시작 실패');
    });
  };

  return (
    <BoardContainer>
      {/* 1. Top Navigation Bar */}
      <TopNavBar>
        <NavLeft>
          <GameTitle>
            <span>💌</span> 러브레터
          </GameTitle>
          <Badge $variant="gold">Round {roomState?.roundNumber || 1}</Badge>
          <Badge $variant="outline">{roomState?.code}</Badge>
        </NavLeft>

        <TurnBanner $isMyTurn={isMyTurn}>
          {isMyTurn ? (
            <>
              <Sparkles size={16} />
              <span>당신의 턴입니다! 카드를 선택하세요</span>
            </>
          ) : (
            <>
              <span>🎴</span>
              <span>{currentTurnPlayer?.nickname || '상대방'}의 턴</span>
            </>
          )}
        </TurnBanner>

        <NavControls>
          <Button
            $variant="ghost"
            $size="icon"
            onClick={webrtc?.toggleMic}
            title={webrtc?.isMicOn ? '마이크 끄기' : '마이크 켜기'}
          >
            {webrtc?.isMicOn ? <Mic size={18} color={THEME.emerald} /> : <MicOff size={18} />}
          </Button>

          <Button
            $variant="ghost"
            $size="icon"
            onClick={webrtc?.toggleSpeaker}
            title={webrtc?.isSpeakerOn ? '스피커 끄기' : '스피커 켜기'}
          >
            {webrtc?.isSpeakerOn ? <Volume2 size={18} /> : <VolumeX size={18} color={THEME.rose} />}
          </Button>

          <Button
            $variant="ghost"
            $size="icon"
            onClick={stt?.toggleSTT}
            title={stt?.isSTTEnabled ? '한국어 자막 끄기' : '한국어 자막 켜기'}
          >
            <MessageSquare size={18} color={stt?.isSTTEnabled ? THEME.emerald : undefined} />
          </Button>

          <Button
            $variant="ghost"
            $size="icon"
            onClick={toggleSFX}
            title={sfxEnabled ? '효과음 끄기' : '효과음 켜기'}
          >
            <span>{sfxEnabled ? '🎵' : '🔇'}</span>
          </Button>

          <Button
            $variant="outline"
            $size="sm"
            onClick={() => setDrawerOpen(true)}
            title="게임 기록 및 규칙"
          >
            <Scroll size={15} />
            <span>기록</span>
          </Button>

          <Button
            $variant="destructive"
            $size="sm"
            onClick={() => setForfeitModalOpen(true)}
            title="게임 포기 및 나가기"
          >
            <LogOut size={15} />
          </Button>
        </NavControls>
      </TopNavBar>

      {/* 2. 3D Felt Game Table */}
      <TableArea>
        {/* Opponents Seats */}
        <OpponentsGrid>
          {opponents.map((p) => {
            const isTurn = p.id === roomState.turnPlayerId;
            const isSpeaking = webrtc?.speakingUsers?.[p.id];
            const bubble = stt?.activeBubbles?.[p.id];

            return (
              <OpponentSeat
                key={p.id}
                $isTurn={isTurn}
                $isEliminated={p.isEliminated}
              >
                <AvatarWrapper>
                  <AvatarImg
                    src={p.avatarUrl}
                    alt={p.nickname}
                    $isTurn={isTurn}
                    $isSpeaking={isSpeaking}
                  />
                  {bubble && <SpeechBubble>{bubble.text}</SpeechBubble>}
                </AvatarWrapper>

                <OpponentName>{p.nickname}</OpponentName>

                <StatusPills>
                  <Badge $variant="gold">⭐ {p.tokens || 0}</Badge>
                  <Badge $variant="outline">🃏 {p.handCount || 0}</Badge>
                  {p.isProtected && <Badge $variant="emerald">🌸 보호</Badge>}
                  {p.isEliminated && <Badge $variant="rose">☠️ 탈락</Badge>}
                </StatusPills>
              </OpponentSeat>
            );
          })}
        </OpponentsGrid>

        {/* Center Board: Deck & Discard Zone */}
        <CenterBoard>
          <DeckCard>
            <span style={{ fontSize: '24px' }}>💌</span>
            <span style={{ fontSize: '11px', color: THEME.gold, fontWeight: 700 }}>
              남은 덱
            </span>
            <Badge $variant="gold">{roomState?.deckCount || 0}장</Badge>
          </DeckCard>

          <div style={{ textAlign: 'center', maxWidth: '300px' }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
              최근 액션
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: THEME.foreground,
                backgroundColor: 'rgba(9, 9, 11, 0.75)',
                padding: '8px 14px',
                borderRadius: THEME.radius.md,
                border: `1px solid ${THEME.border}`,
              }}
            >
              {roomState?.lastActionLog || '게임을 시작합니다.'}
            </div>
          </div>
        </CenterBoard>

        {/* 3. Bottom Player Hand (3D Fan-out Arc) */}
        <HandSection>
          <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Badge $variant={myPlayer?.isEliminated ? 'rose' : 'emerald'}>
              {myPlayer?.isEliminated ? '☠️ 탈락하였습니다' : '🃏 내 손패'}
            </Badge>
            <span style={{ fontSize: '12px', color: THEME.gold }}>
              보유 토큰: {myPlayer?.tokens || 0}/{roomState?.targetTokens || 4}개
            </span>
            {myPlayer?.isProtected && <Badge $variant="emerald">🌸 보호막 활성</Badge>}
          </div>

          <HandCardsWrapper>
            <AnimatePresence>
              {myPlayer?.hand?.map((card, idx) => {
                const totalCards = myPlayer.hand.length;
                const rotation = totalCards === 2 ? (idx === 0 ? -7 : 7) : 0;
                const xOffset = totalCards === 2 ? (idx === 0 ? -12 : 12) : 0;
                const cardMeta = CARD_DATA[card.value] || {};

                return (
                  <CardMotion
                    key={card.id}
                    $color={cardMeta.color}
                    $canPlay={isMyTurn && !myPlayer.isEliminated}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1, rotate: rotation, x: xOffset }}
                    exit={{ y: -80, opacity: 0, scale: 0.8 }}
                    whileHover={
                      isMyTurn && !myPlayer.isEliminated
                        ? { y: -24, scale: 1.08, rotate: 0, zIndex: 30 }
                        : {}
                    }
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    onClick={() => handleCardClick(card)}
                  >
                    <CardHeaderRow>
                      <CardValueBadge $color={cardMeta.color}>
                        {card.value}
                      </CardValueBadge>
                      <span style={{ fontSize: '11px', color: cardMeta.color, fontWeight: 700 }}>
                        {cardMeta.nameEn}
                      </span>
                    </CardHeaderRow>

                    <CardEmblem>{cardMeta.icon}</CardEmblem>

                    <CardFooterInfo>
                      <CardNameText>{card.name}</CardNameText>
                      <CardDescSnippet title={card.desc}>
                        {card.desc}
                      </CardDescSnippet>
                    </CardFooterInfo>
                  </CardMotion>
                );
              })}
            </AnimatePresence>
          </HandCardsWrapper>
        </HandSection>
      </TableArea>

      {/* 4. Guard Guess Dialog */}
      <Dialog open={guardModalOpen} onClose={() => setGuardModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>🛡️ 경비병: 상대 지목 및 카드 추측</DialogTitle>
          <DialogDescription>
            지목할 상대방과 그 사람이 가지고 있을 것으로 예상되는 카드를 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div style={{ fontSize: '13px', fontWeight: 600, color: THEME.gold, marginTop: '8px' }}>
          1. 지목할 상대방 선택
        </div>
        <TargetGrid>
          {opponents
            .filter((p) => !p.isEliminated && !p.isProtected)
            .map((p) => (
              <TargetButton
                key={p.id}
                $selected={selectedTargetId === p.id}
                onClick={() => setSelectedTargetId(p.id)}
              >
                <img
                  src={p.avatarUrl}
                  alt={p.nickname}
                  style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{p.nickname}</span>
              </TargetButton>
            ))}
        </TargetGrid>

        <div style={{ fontSize: '13px', fontWeight: 600, color: THEME.gold, marginTop: '16px' }}>
          2. 추측할 카드 번호 선택 (2~8번)
        </div>
        <GuessGrid>
          {[2, 3, 4, 5, 6, 7, 8].map((num) => {
            const meta = CARD_DATA[num];
            return (
              <GuessButton
                key={num}
                $selected={selectedGuessValue === num}
                onClick={() => setSelectedGuessValue(num)}
              >
                <span style={{ fontSize: '16px' }}>{meta.icon}</span>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>
                  {num} {meta.name}
                </span>
              </GuessButton>
            );
          })}
        </GuessGrid>

        <DialogFooter>
          <Button $variant="outline" onClick={() => setGuardModalOpen(false)}>
            취소
          </Button>
          <Button
            $variant="gold"
            onClick={() =>
              executePlay(selectedCard?.id, selectedTargetId, selectedGuessValue)
            }
            disabled={!selectedTargetId}
          >
            추측 제출
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 5. General Target Selection Dialog (Priest, Baron, Prince, King) */}
      <Dialog open={targetModalOpen} onClose={() => setTargetModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>
            {selectedCard?.name} ({selectedCard?.value}): 대상 지목
          </DialogTitle>
          <DialogDescription>카드 효과를 적용할 플레이어를 선택하세요.</DialogDescription>
        </DialogHeader>

        <TargetGrid>
          {(selectedCard?.value === 5
            ? roomState.players.filter((p) => !p.isEliminated && (!p.isProtected || p.id === currentUser.id))
            : opponents.filter((p) => !p.isEliminated && !p.isProtected)
          ).map((p) => (
            <TargetButton
              key={p.id}
              $selected={selectedTargetId === p.id}
              onClick={() => setSelectedTargetId(p.id)}
            >
              <img
                src={p.avatarUrl}
                alt={p.nickname}
                style={{ width: '36px', height: '36px', borderRadius: '50%' }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                {p.nickname} {p.id === currentUser.id && '(자신)'}
              </span>
            </TargetButton>
          ))}
        </TargetGrid>

        <DialogFooter>
          <Button $variant="outline" onClick={() => setTargetModalOpen(false)}>
            취소
          </Button>
          <Button
            $variant="gold"
            onClick={() => executePlay(selectedCard?.id, selectedTargetId, null)}
            disabled={!selectedTargetId}
          >
            선택 완료
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 6. Priest Secret Reveal Popup */}
      <Dialog open={priestResultModalOpen} onClose={() => setPriestResultModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>📜 사제: 손패 비밀 투시 결과</DialogTitle>
          <DialogDescription>
            [{priestData?.targetNickname}] 님의 손패를 당신만 확인하였습니다.
          </DialogDescription>
        </DialogHeader>

        {priestData?.card && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
            <Card
              style={{
                width: '140px',
                height: '200px',
                padding: '16px',
                borderColor: CARD_DATA[priestData.card.value]?.color || THEME.gold,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: THEME.gold }}>
                {priestData.card.value}
              </div>
              <div style={{ fontSize: '3rem', margin: '12px 0' }}>
                {CARD_DATA[priestData.card.value]?.icon}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>
                {priestData.card.name}
              </div>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button $variant="default" onClick={() => setPriestResultModalOpen(false)}>
            확인
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 7. Round End & Game Over Celebration Modals */}
      <Dialog
        open={roomState?.gameState === 'ROUND_END' || roomState?.gameState === 'GAME_OVER'}
        onClose={() => {}}
      >
        <DialogHeader>
          <DialogTitle>
            {roomState?.gameState === 'GAME_OVER' ? '🏆 최종 우승!' : '🎉 라운드 종료!'}
          </DialogTitle>
          <DialogDescription>
            {roomState?.gameState === 'GAME_OVER'
              ? `[${roomState?.gameWinner?.nickname}] 님이 목표 토큰을 모두 달성하여 최종 챔피언이 되었습니다!`
              : `[${roomState?.roundWinner?.nickname}] 님이 승리하여 토큰을 획득했습니다!`}
          </DialogDescription>
        </DialogHeader>

        <div style={{ textAlign: 'center', margin: '16px 0' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '8px' }}>
            {roomState?.gameState === 'GAME_OVER' ? '👑' : '⭐'}
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: THEME.gold }}>
            {roomState?.gameState === 'GAME_OVER'
              ? roomState?.gameWinner?.nickname
              : roomState?.roundWinner?.nickname}
          </div>
          <div style={{ fontSize: '13px', color: THEME.mutedForeground, marginTop: '4px' }}>
            {roomState?.roundWinner?.reason}
          </div>
        </div>

        <DialogFooter>
          {roomState?.hostId === currentUser?.id ? (
            <Button $variant="gold" $fullWidth onClick={handleNextRoundOrRestart}>
              <Play size={16} />
              <span>
                {roomState?.gameState === 'GAME_OVER' ? '새 게임 시작' : '다음 라운드 시작'}
              </span>
            </Button>
          ) : (
            <div style={{ fontSize: '13px', color: THEME.mutedForeground, textAlign: 'center', width: '100%' }}>
              방장이 다음 라운드를 시작할 때까지 대기 중입니다...
            </div>
          )}
        </DialogFooter>
      </Dialog>

      {/* 8. Transparent Side Drawer (Logs & Reference) */}
      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="📜 게임 기록 및 카드 가이드"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: THEME.gold, marginBottom: '8px' }}>
              액션 히스토리
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                maxHeight: '200px',
                overflowY: 'auto',
                fontSize: '12px',
              }}
            >
              {(roomState?.actionLogs || []).map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '6px 8px',
                    backgroundColor: THEME.secondary,
                    borderRadius: THEME.radius.sm,
                    color: THEME.foreground,
                  }}
                >
                  {log.text}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: THEME.gold, marginBottom: '8px' }}>
              러브레터 1~8번 카드 가이드
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              {Object.values(CARD_DATA).map((c) => (
                <div
                  key={c.value}
                  style={{
                    padding: '8px',
                    backgroundColor: THEME.secondary,
                    borderRadius: THEME.radius.md,
                    borderLeft: `3px solid ${c.color}`,
                  }}
                >
                  <div style={{ fontWeight: 700, color: c.color, marginBottom: '2px' }}>
                    {c.icon} {c.value}. {c.name} ({c.nameEn}) - {c.count}장
                  </div>
                  <div style={{ color: THEME.mutedForeground, fontSize: '11px' }}>
                    {c.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SideDrawer>

      {/* 9. 3-Minute Pause Overlay */}
      <PauseOverlay
        open={!!roomState?.isPaused}
        pausedPlayerNickname={
          roomState?.players?.find((p) => p.id === roomState?.pausedPlayerId)?.nickname || '플레이어'
        }
        pauseExpiresAt={roomState?.pauseExpiresAt}
        onForfeit={() => setForfeitModalOpen(true)}
      />

      {/* 10. Forfeit Confirmation Dialog */}
      <Dialog open={forfeitModalOpen} onClose={() => setForfeitModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>🚪 게임 포기 및 퇴장</DialogTitle>
          <DialogDescription>
            정말 게임을 포기하고 퇴장하시겠습니까?
          </DialogDescription>
        </DialogHeader>

        <div style={{ margin: '12px 0', fontSize: '13px', color: THEME.mutedForeground, lineHeight: 1.5 }}>
          진행 중인 게임에서 퇴장하시면 즉시 <strong style={{ color: THEME.rose }}>기권(패배)</strong> 처리되며, 3분 대기 없이 방에서 완전히 나갑니다.
        </div>

        <DialogFooter>
          <Button $variant="outline" onClick={() => setForfeitModalOpen(false)}>
            계속 플레이
          </Button>
          <Button
            $variant="destructive"
            onClick={() => {
              setForfeitModalOpen(false);
              onLeave && onLeave();
            }}
          >
            게임 포기 및 퇴장
          </Button>
        </DialogFooter>
      </Dialog>
    </BoardContainer>
  );
}
