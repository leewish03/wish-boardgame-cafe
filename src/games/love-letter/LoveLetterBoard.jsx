import React, { useState, useEffect, useMemo } from 'react';
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
  Sparkles,
  Play,
  RotateCcw,
  Check,
  Copy,
  Crosshair,
  Info,
  X,
  Settings,
} from 'lucide-react';

// =========================================================================
// Card Definitions & Rules
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
// Keyframes & Visual Effects
// =========================================================================

const pulseWave = keyframes`
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.8); }
  70% { transform: scale(1.08); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
`;

const turnGlow = keyframes`
  0% { box-shadow: 0 0 4px rgba(245, 158, 11, 0.4); }
  50% { box-shadow: 0 0 16px rgba(245, 158, 11, 0.9); }
  100% { box-shadow: 0 0 4px rgba(245, 158, 11, 0.4); }
`;

const turnPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.4), 0 0 20px rgba(245, 158, 11, 0.2);
    border-color: ${THEME.gold};
  }
  50% {
    box-shadow: 0 0 22px rgba(245, 158, 11, 0.8), 0 0 35px rgba(245, 158, 11, 0.45);
    border-color: ${THEME.goldLight};
  }
`;

const targetPulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.8); border-color: ${THEME.goldLight}; }
  70% { box-shadow: 0 0 0 12px rgba(245, 158, 11, 0); border-color: ${THEME.gold}; }
  100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); border-color: ${THEME.goldLight}; }
`;

const forcedPulse = keyframes`
  0% { transform: scale(1); box-shadow: 0 0 6px rgba(236, 72, 153, 0.5); }
  50% { transform: scale(1.03); box-shadow: 0 0 18px rgba(236, 72, 153, 0.9); }
  100% { transform: scale(1); box-shadow: 0 0 6px rgba(236, 72, 153, 0.5); }
`;

// =========================================================================
// 100dvh No-Scroll Layout Components
// =========================================================================

const BoardContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  background-color: ${THEME.background};
  color: ${THEME.foreground};
  position: relative;
  overflow: hidden;
  user-select: none;
  box-sizing: border-box;
`;

// 1줄 고정 초미니멀 네비바 (38px)
const TopNavBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  min-height: 38px;
  max-height: 38px;
  padding: 0 10px;
  background-color: rgba(9, 9, 11, 0.95);
  border-bottom: 1px solid ${THEME.border};
  backdrop-filter: blur(8px);
  z-index: 100;
  flex-shrink: 0;
  box-sizing: border-box;
`;

const NavLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;

const NavControls = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
`;

const NavIconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: ${THEME.radius.md};
  background-color: transparent;
  border: 1px solid transparent;
  color: ${THEME.foreground};
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;

  &:hover {
    background-color: ${THEME.secondary};
    border-color: ${THEME.border};
  }

  &.danger {
    color: ${THEME.rose};
    &:hover {
      background-color: rgba(244, 63, 94, 0.15);
      border-color: ${THEME.rose};
    }
  }
`;

// =========================================================================
// Main Game Table Area (100dvh - 38px)
// =========================================================================

const TableArea = styled.main`
  flex: 1;
  height: calc(100dvh - 38px);
  max-height: calc(100dvh - 38px);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 6px 10px;
  position: relative;
  background: radial-gradient(
    ellipse at center,
    ${THEME.feltGreen} 0%,
    ${THEME.feltGreenDeep} 70%,
    #01140f 100%
  );
  overflow: hidden;
  box-sizing: border-box;
`;

// =========================================================================
// 1. Opponents Area (25% Height)
// =========================================================================

const OpponentsArea = styled.section`
  height: 25%;
  max-height: 25%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 2px 4px;
  box-sizing: border-box;
  flex-shrink: 0;
  z-index: 20;

  /* Hide scrollbar */
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
`;

const OpponentSeat = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(9, 9, 11, 0.88);
  border: 1.5px solid
    ${({ $isTargetable, $isTurn }) =>
      $isTargetable
        ? THEME.gold
        : $isTurn
        ? THEME.gold
        : THEME.border};
  border-radius: ${THEME.radius.lg};
  padding: 6px 10px;
  min-width: 110px;
  max-width: 150px;
  height: 90%;
  position: relative;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  transition: all 0.2s;
  box-sizing: border-box;
  cursor: ${({ $isTargetable }) => ($isTargetable ? 'pointer' : 'default')};

  opacity: ${({ $isEliminated, $isDimmed }) =>
    $isEliminated ? 0.4 : $isDimmed ? 0.5 : 1};
  filter: ${({ $isEliminated }) => ($isEliminated ? 'grayscale(90%)' : 'none')};

  ${({ $isTargetable }) =>
    $isTargetable &&
    css`
      animation: ${targetPulse} 1.5s infinite;
      background-color: rgba(245, 158, 11, 0.12);
      &:hover {
        transform: scale(1.04);
        background-color: rgba(245, 158, 11, 0.22);
      }
    `}

  ${({ $isTurn, $isTargetable }) =>
    $isTurn &&
    !$isTargetable &&
    css`
      animation: ${turnPulse} 1.6s infinite ease-in-out;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(9, 9, 11, 0.95) 100%);
    `}
`;

const ThinkingBadge = styled.div`
  position: absolute;
  top: -8px;
  background: linear-gradient(135deg, ${THEME.gold} 0%, #b45309 100%);
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: ${THEME.radius.full};
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.6);
  white-space: nowrap;
  z-index: 25;
  display: flex;
  align-items: center;
  gap: 3px;
  animation: ${turnGlow} 1.5s infinite;
`;

const AvatarWrapper = styled.div`
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: ${THEME.radius.full};
  margin-bottom: 3px;
  flex-shrink: 0;
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
  bottom: 105%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 6px;
  background-color: rgba(9, 9, 11, 0.95);
  border: 1px solid ${THEME.emerald};
  border-radius: ${THEME.radius.md};
  padding: 4px 8px;
  font-size: 11px;
  color: ${THEME.foreground};
  white-space: nowrap;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
  z-index: 60;

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 4px;
    border-style: solid;
    border-color: ${THEME.emerald} transparent transparent transparent;
  }
`;

const OpponentName = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: ${THEME.foreground};
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.1;
  text-align: center;
`;

const OpponentStatsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  font-size: 10px;
`;

const TargetBadge = styled.div`
  position: absolute;
  top: -8px;
  background: linear-gradient(135deg, ${THEME.goldLight} 0%, ${THEME.gold} 100%);
  color: #000;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: ${THEME.radius.full};
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  white-space: nowrap;
  z-index: 25;
`;

// =========================================================================
// Discard Pile Stack Components
// =========================================================================

const DiscardStackWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-top: 3px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: ${THEME.radius.sm};
  background-color: rgba(255, 255, 255, 0.05);
  transition: background-color 0.15s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.12);
  }
`;

const DiscardOverlapRow = styled.div`
  display: flex;
  align-items: center;
  height: 22px;
`;

const MiniDiscardChip = styled.div`
  width: 18px;
  height: 22px;
  border-radius: 3px;
  background-color: ${({ $color }) => $color || THEME.card};
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  margin-left: ${({ $index }) => ($index === 0 ? '0' : '-6px')};
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  transform: ${({ $index }) => `rotate(${($index % 3 - 1) * 3}deg)`};
  z-index: ${({ $index }) => $index + 1};
  flex-shrink: 0;
`;

const DiscardMoreBadge = styled.span`
  font-size: 9px;
  color: ${THEME.mutedForeground};
  margin-left: 4px;
  font-weight: 700;
`;

function DiscardPileStack({ discardPile = [], onOpenHistory, playerName = '' }) {
  if (!discardPile || discardPile.length === 0) {
    return (
      <DiscardStackWrapper onClick={() => onOpenHistory({ playerName, discardPile })}>
        <span style={{ fontSize: '9px', color: THEME.mutedForeground }}>낸 패 없음</span>
      </DiscardStackWrapper>
    );
  }

  const visibleCards = discardPile.slice(-4);
  const remainingCount = discardPile.length - visibleCards.length;

  return (
    <DiscardStackWrapper
      onClick={() => onOpenHistory({ playerName, discardPile })}
      title={`${playerName}님이 낸 카드 목록 보기 (총 ${discardPile.length}장)`}
    >
      <DiscardOverlapRow>
        {visibleCards.map((card, idx) => {
          const meta = CARD_DATA[card.value] || {};
          return (
            <MiniDiscardChip key={`${card.id || card.value}-${idx}`} $color={meta.color} $index={idx}>
              {card.value}
            </MiniDiscardChip>
          );
        })}
      </DiscardOverlapRow>
      {remainingCount > 0 && <DiscardMoreBadge>+{remainingCount}</DiscardMoreBadge>}
    </DiscardStackWrapper>
  );
}

// =========================================================================
// 2. Center Table Area (25% Height)
// =========================================================================

const CenterTableArea = styled.section`
  height: 25%;
  max-height: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  gap: 8px;
  position: relative;
  box-sizing: border-box;
  flex-shrink: 0;
  z-index: 10;
  width: 100%;
`;

const CenterTurnBanner = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background-color: ${({ $isMyTurn }) =>
    $isMyTurn ? 'rgba(245, 158, 11, 0.18)' : 'rgba(9, 9, 11, 0.85)'};
  border: 1.5px solid
    ${({ $isMyTurn }) => ($isMyTurn ? THEME.gold : THEME.border)};
  padding: 5px 16px;
  border-radius: ${THEME.radius.full};
  font-size: 13px;
  font-weight: 700;
  color: ${({ $isMyTurn }) => ($isMyTurn ? THEME.goldLight : THEME.foreground)};
  animation: ${({ $isMyTurn }) => ($isMyTurn ? turnGlow : 'none')} 2s infinite;
  box-shadow: ${({ $isMyTurn }) =>
    $isMyTurn ? '0 0 18px rgba(245, 158, 11, 0.5)' : 'none'};
  white-space: nowrap;
  max-width: 92%;
  overflow: hidden;
  text-overflow: ellipsis;
  backdrop-filter: blur(8px);
`;

const DeckSlot = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: rgba(9, 9, 11, 0.85);
  border: 1.5px solid ${THEME.gold};
  border-radius: ${THEME.radius.lg};
  padding: 5px 14px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
  cursor: pointer;
  transition: transform 0.15s;

  &:hover {
    transform: scale(1.04);
  }
`;

const MiniDeckCardVisual = styled.div`
  width: 24px;
  height: 34px;
  border-radius: 4px;
  background: linear-gradient(135deg, #18181b 0%, #09090b 100%);
  border: 1px solid ${THEME.gold};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  box-shadow: 1.5px 1.5px 0 rgba(245, 158, 11, 0.5);
`;

const FloatingToast = styled(motion.div)`
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(9, 9, 11, 0.95);
  border: 1px solid ${THEME.gold};
  border-radius: ${THEME.radius.full};
  padding: 5px 14px;
  font-size: 11px;
  font-weight: 700;
  color: ${THEME.foreground};
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7);
  z-index: 80;
  pointer-events: none;
  white-space: nowrap;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  backdrop-filter: blur(8px);
`;

const TargetingBanner = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: rgba(9, 9, 11, 0.96);
  border: 1.5px solid ${THEME.gold};
  border-radius: ${THEME.radius.full};
  padding: 5px 14px;
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.5);
  z-index: 50;
  animation: ${turnGlow} 1.5s infinite;
  white-space: nowrap;
`;

// =========================================================================
// 3. My Play & Hand Area (45% Height - 38px)
// =========================================================================

const MyPlayArea = styled.section`
  height: calc(45% - 38px);
  max-height: calc(45% - 38px);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 2px 10px 6px;
  box-sizing: border-box;
  flex-shrink: 0;
  z-index: 30;
  position: relative;
  transition: background 0.3s ease;
  background: ${({ $isMyTurn }) =>
    $isMyTurn
      ? 'radial-gradient(ellipse at bottom, rgba(245, 158, 11, 0.16) 0%, transparent 75%)'
      : 'transparent'};
`;

const MyStatusBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 500px;
  padding: 0 4px;
  box-sizing: border-box;
  font-size: 11px;
`;

const MyStatusLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const MyStatusRight = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const HandCardsWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex: 1;
  width: 100%;
  max-width: 480px;
  position: relative;
`;

const CardMotion = styled(motion.div)`
  width: 120px;
  height: 148px;
  border-radius: ${THEME.radius.lg};
  background-color: ${THEME.card};
  border: 2px solid
    ${({ $isSelected, $color, $isForced }) =>
      $isSelected
        ? THEME.gold
        : $isForced
        ? '#ec4899'
        : $color || THEME.gold};
  padding: 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: ${({ $isSelected }) =>
    $isSelected
      ? `0 0 20px rgba(245, 158, 11, 0.8), 0 8px 24px rgba(0, 0, 0, 0.8)`
      : `0 6px 18px rgba(0, 0, 0, 0.6)`};
  cursor: ${({ $canPlay, $isRestricted, $isMyTurn }) =>
    $canPlay && !$isRestricted && $isMyTurn ? 'pointer' : 'not-allowed'};
  position: relative;
  overflow: hidden;
  user-select: none;
  box-sizing: border-box;
  transform: ${({ $isSelected }) => ($isSelected ? 'translateY(-12px)' : 'translateY(0)')};
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, opacity 0.25s ease, filter 0.25s ease;

  opacity: ${({ $isRestricted, $isMyTurn }) =>
    $isRestricted ? 0.4 : $isMyTurn ? 1 : 0.45};
  filter: ${({ $isRestricted, $isMyTurn }) =>
    $isRestricted ? 'grayscale(80%)' : $isMyTurn ? 'none' : 'grayscale(40%)'};

  ${({ $isForced }) =>
    $isForced &&
    css`
      animation: ${forcedPulse} 1.8s infinite;
    `}

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

// =========================================================================
// Real-Time Action Showcase Components
// =========================================================================

const ShowcaseBackdrop = styled(motion.div)`
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 95;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
`;

const ShowcaseCardBox = styled(motion.div)`
  background: linear-gradient(135deg, #18181b 0%, #09090b 100%);
  border: 2px solid ${({ $color }) => $color || THEME.gold};
  border-radius: ${THEME.radius.xl};
  padding: 14px 18px;
  box-shadow: 0 0 40px ${({ $color }) => `${$color}77` || 'rgba(245, 158, 11, 0.7)'}, 0 20px 50px rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 230px;
  max-width: 85vw;
  box-sizing: border-box;
`;

const ShowcaseHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 800;
  color: ${THEME.foreground};
  text-align: center;
`;

const ShowcaseCardVisual = styled.div`
  width: 100px;
  height: 132px;
  border-radius: ${THEME.radius.lg};
  background-color: ${THEME.card};
  border: 2px solid ${({ $color }) => $color || THEME.gold};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8);
  box-sizing: border-box;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at top left,
      ${({ $color }) => `${$color}33`} 0%,
      transparent 70%
    );
  }
`;

const ShowcaseFooter = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: ${THEME.goldLight};
  text-align: center;
  line-height: 1.3;
`;

const CardHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CardValueBadge = styled.span`
  font-size: 1.25rem;
  font-weight: 900;
  color: ${({ $color }) => $color};
  line-height: 1;
`;

const CardEmblem = styled.div`
  font-size: 2rem;
  text-align: center;
  margin: 1px 0;
`;

const CardFooterInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const CardNameText = styled.div`
  font-size: 12px;
  font-weight: 800;
  color: ${THEME.foreground};
  line-height: 1.1;
`;

const CardDescSnippet = styled.div`
  font-size: 9px;
  color: ${THEME.mutedForeground};
  line-height: 1.15;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const RestrictionBadge = styled.div`
  position: absolute;
  top: 4px;
  right: 4px;
  left: 4px;
  background-color: rgba(239, 68, 68, 0.95);
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  padding: 2px 4px;
  border-radius: 4px;
  text-align: center;
  z-index: 10;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
`;

const ActionControlBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 480px;
  height: 42px;
  min-height: 42px;
  box-sizing: border-box;
`;

// =========================================================================
// Dialog / Modal Subcomponents
// =========================================================================

const SmartGuessGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 8px;
  margin-top: 12px;
`;

const SmartGuessButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  background-color: ${({ $selected }) =>
    $selected ? 'rgba(245, 158, 11, 0.2)' : THEME.secondary};
  border: 1.5px solid
    ${({ $selected, $isZero }) =>
      $selected
        ? THEME.gold
        : $isZero
        ? 'rgba(255, 255, 255, 0.08)'
        : THEME.border};
  border-radius: ${THEME.radius.md};
  padding: 8px 10px;
  color: ${THEME.foreground};
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  transition: all 0.15s;
  opacity: ${({ disabled }) => (disabled ? 0.4 : 1)};
  text-align: left;
  box-sizing: border-box;
  width: 100%;

  &:hover:not(:disabled) {
    border-color: ${THEME.gold};
    background-color: rgba(245, 158, 11, 0.12);
  }
`;

// =========================================================================
// LoveLetterBoard Main Component
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
  const [copiedCode, setCopiedCode] = useState(false);

  // Selected Hand Card Index for 2-Step Touch (0 or 1 or null)
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);

  // Table Direct Targeting Mode (true when targeting a player)
  const [isTargetingMode, setIsTargetingMode] = useState(false);

  // Guard Smart Guess Modal
  const [guardModalOpen, setGuardModalOpen] = useState(false);
  const [guardTargetPlayer, setGuardTargetPlayer] = useState(null);
  const [selectedGuessValue, setSelectedGuessValue] = useState(2);

  // Priest Secret Reveal Modal
  const [priestResultModalOpen, setPriestResultModalOpen] = useState(false);
  const [priestData, setPriestData] = useState(null);

  // Discard History Modal
  const [discardHistoryModalOpen, setDiscardHistoryModalOpen] = useState(false);
  const [discardHistoryTarget, setDiscardHistoryTarget] = useState(null);

  // Forfeit Confirmation Modal
  const [forfeitModalOpen, setForfeitModalOpen] = useState(false);

  // Floating Action Toast state
  const [activeToast, setActiveToast] = useState(null);

  // Real-Time Action Showcase state
  const [actionShowcase, setActionShowcase] = useState(null);

  const isMyTurn = roomState?.turnPlayerId === currentUser?.id;
  const myPlayer = roomState?.players?.find((p) => p.id === currentUser?.id);
  const opponents = roomState?.players?.filter((p) => p.id !== currentUser?.id) || [];
  const currentTurnPlayer = roomState?.players?.find((p) => p.id === roomState?.turnPlayerId);

  // Listen for Real-Time Action Showcase broadcast from server
  useEffect(() => {
    if (!socket) return;
    let timer = null;
    const handleActionShowcase = (data) => {
      setActionShowcase(data);
      sfx.playCardPlay();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setActionShowcase(null);
      }, 1800);
    };
    socket.on('game:action-showcase', handleActionShowcase);
    return () => {
      socket.off('game:action-showcase', handleActionShowcase);
      if (timer) clearTimeout(timer);
    };
  }, [socket]);

  // Auto-dismissing Floating Toast on action log update
  useEffect(() => {
    if (roomState?.lastActionLog) {
      setActiveToast(roomState.lastActionLog);
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 2600);
      return () => clearTimeout(timer);
    }
  }, [roomState?.lastActionLog]);

  // Selected card object
  const selectedCard =
    selectedCardIndex !== null && myPlayer?.hand?.[selectedCardIndex]
      ? myPlayer.hand[selectedCardIndex]
      : null;

  // Sound triggers on turn and round end
  useEffect(() => {
    if (isMyTurn) {
      sfx.playTurnAlert();
    }
  }, [isMyTurn]);

  useEffect(() => {
    if (roomState?.gameState === 'ROUND_END' || roomState?.gameState === 'GAME_OVER') {
      sfx.playVictoryFanfare();
      setIsTargetingMode(false);
      setSelectedCardIndex(null);
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

  // Reset selection when turn changes or hand changes
  useEffect(() => {
    if (!isMyTurn) {
      setSelectedCardIndex(null);
      setIsTargetingMode(false);
    }
  }, [isMyTurn, myPlayer?.hand?.length]);

  // Toggle SFX
  const toggleSFX = () => {
    const next = !sfxEnabled;
    sfx.setEnabled(next);
    setSfxEnabled(next);
  };

  // Copy Room Code
  const handleCopyCode = () => {
    if (!roomState?.code) return;
    navigator.clipboard.writeText(roomState.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // =========================================================================
  // Countess Constraint Evaluation
  // =========================================================================
  const hasCountess = useMemo(() => {
    return myPlayer?.hand?.some((c) => c.value === 7) || false;
  }, [myPlayer?.hand]);

  const hasPrinceOrKing = useMemo(() => {
    return myPlayer?.hand?.some((c) => c.value === 5 || c.value === 6) || false;
  }, [myPlayer?.hand]);

  const isCountessForced = hasCountess && hasPrinceOrKing;

  // =========================================================================
  // Card Counter (Smart Helper for Guard Guessing)
  // =========================================================================
  const cardCounter = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };

    // 1. All players' discard piles
    (roomState?.players || []).forEach((p) => {
      (p.discardPile || []).forEach((c) => {
        if (counts[c.value] !== undefined) counts[c.value]++;
      });
    });

    // 2. Set aside open cards (2-player game)
    (roomState?.setAsideOpenCards || []).forEach((c) => {
      if (counts[c.value] !== undefined) counts[c.value]++;
    });

    // 3. My own hand
    (myPlayer?.hand || []).forEach((c) => {
      if (counts[c.value] !== undefined) counts[c.value]++;
    });

    return counts;
  }, [roomState?.players, roomState?.setAsideOpenCards, myPlayer?.hand]);

  // =========================================================================
  // Card Selection & Play Actions (2-Step Safety Touch)
  // =========================================================================

  // Step 1: Tap card to select/unselect
  const handleCardTap = (index, card) => {
    if (!isMyTurn || myPlayer?.isEliminated) return;

    // Block Prince(5)/King(6) when Countess(7) is present
    if (isCountessForced && (card.value === 5 || card.value === 6)) {
      alert('백작부인(7)을 손에 쥐고 있을 때는 반드시 백작부인을 먼저 사용해야 합니다!');
      return;
    }

    if (selectedCardIndex === index) {
      // Unselect
      setSelectedCardIndex(null);
      setIsTargetingMode(false);
    } else {
      setSelectedCardIndex(index);
      setIsTargetingMode(false);
    }
  };

  // Step 2: Trigger Play Button
  const handleTriggerCardPlay = (card) => {
    if (!card || !isMyTurn || myPlayer?.isEliminated) return;

    // Eligible opponents (alive & not protected)
    const eligibleOpponents = opponents.filter((p) => !p.isEliminated && !p.isProtected);

    // 1. Guard (1)
    if (card.value === 1) {
      if (eligibleOpponents.length === 0) {
        // Everyone protected -> play without target
        executePlay(card.id, null, null);
      } else {
        setIsTargetingMode(true);
      }
    }
    // 2. Priest (2) / 3. Baron (3) / 6. King (6)
    else if (card.value === 2 || card.value === 3 || card.value === 6) {
      if (eligibleOpponents.length === 0) {
        // Everyone protected -> play without target
        executePlay(card.id, null, null);
      } else {
        setIsTargetingMode(true);
      }
    }
    // 5. Prince (5) - can target anyone alive (including self)
    else if (card.value === 5) {
      setIsTargetingMode(true);
    }
    // 4. Handmaid (4) / 7. Countess (7) / 8. Princess (8)
    else {
      executePlay(card.id, null, null);
    }
  };

  // Step 3: Direct Table Seat Click in Targeting Mode
  const handleSeatClick = (targetPlayer) => {
    if (!isTargetingMode || !selectedCard) return;

    // Guard (1) -> Open Smart Guess Modal
    if (selectedCard.value === 1) {
      setGuardTargetPlayer(targetPlayer);
      // Pick the first available number that has remaining cards >= 1
      let defaultGuess = 2;
      for (let n = 2; n <= 8; n++) {
        const remaining = (CARD_DATA[n]?.count || 0) - (cardCounter[n] || 0);
        if (remaining > 0) {
          defaultGuess = n;
          break;
        }
      }
      setSelectedGuessValue(defaultGuess);
      setGuardModalOpen(true);
      setIsTargetingMode(false);
    } else {
      // Priest (2), Baron (3), Prince (5), King (6)
      executePlay(selectedCard.id, targetPlayer.id, null);
      setIsTargetingMode(false);
    }
  };

  // Execute Play Card Socket Event
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
    setSelectedCardIndex(null);
    setIsTargetingMode(false);
    setGuardModalOpen(false);
  };

  // Open Discard History Modal
  const handleOpenDiscardHistory = ({ playerName, discardPile }) => {
    setDiscardHistoryTarget({ playerName, discardPile });
    setDiscardHistoryModalOpen(true);
  };

  // Next Round or Restart
  const handleNextRoundOrRestart = () => {
    socket.emit('game:start', {}, (res) => {
      if (!res?.success) alert(res?.error || '게임 시작 실패');
    });
  };

  return (
    <BoardContainer>
      {/* ========================================================= */}
      {/* 1. TOP NAVIGATION BAR (38px Ultra-Slim) */}
      {/* ========================================================= */}
      <TopNavBar>
        <NavLeft>
          <Badge $variant="gold" style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 800 }}>
            Round {roomState?.roundNumber || 1}/{roomState?.targetTokens || 4}
          </Badge>
        </NavLeft>

        <NavControls>
          <NavIconButton
            onClick={stt?.toggleSTT}
            title={stt?.isSTTEnabled ? '한국어 자막 끄기' : '한국어 자막 켜기'}
          >
            <MessageSquare size={15} color={stt?.isSTTEnabled ? THEME.emerald : undefined} />
          </NavIconButton>

          <NavIconButton
            onClick={() => setDrawerOpen(true)}
            title="방 설정 및 가이드"
          >
            <Settings size={15} color={THEME.goldLight} />
          </NavIconButton>

          <NavIconButton
            className="danger"
            onClick={() => setForfeitModalOpen(true)}
            title="게임 포기 및 나가기"
          >
            <LogOut size={15} />
          </NavIconButton>
        </NavControls>
      </TopNavBar>

      {/* ========================================================= */}
      {/* 2. MAIN FELT TABLE AREA (100dvh - 38px) */}
      {/* ========================================================= */}
      <TableArea>
        {/* ========================================================= */}
        {/* AREA 1: Opponents Seats (25% Height) */}
        {/* ========================================================= */}
        <OpponentsArea>
          {opponents.map((p) => {
            const isTurn = p.id === roomState?.turnPlayerId;
            const isSpeaking = webrtc?.speakingUsers?.[p.id];
            const bubble = stt?.activeBubbles?.[p.id];

            // Direct Table Targeting availability
            const isTargetable =
              isTargetingMode &&
              !p.isEliminated &&
              (selectedCard?.value === 5 || !p.isProtected);

            const isDimmed = isTargetingMode && !isTargetable;

            return (
              <OpponentSeat
                key={p.id}
                $isTurn={isTurn}
                $isEliminated={p.isEliminated}
                $isTargetable={isTargetable}
                $isDimmed={isDimmed}
                onClick={() => {
                  if (isTargetable) handleSeatClick(p);
                }}
              >
                {isTargetable && <TargetBadge>🎯 터치하여 지목</TargetBadge>}
                {isTurn && !isTargetable && <ThinkingBadge>⏳ 생각 중...</ThinkingBadge>}

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

                <OpponentStatsRow>
                  <Badge $variant="gold" style={{ padding: '1px 4px', fontSize: '9px' }}>
                    ⭐{p.tokens || 0}
                  </Badge>
                  <Badge $variant="outline" style={{ padding: '1px 4px', fontSize: '9px' }}>
                    🃏{p.handCount || 0}
                  </Badge>
                  {p.isProtected && (
                    <Badge $variant="emerald" style={{ padding: '1px 4px', fontSize: '9px' }}>
                      🌸보호
                    </Badge>
                  )}
                  {p.isEliminated && (
                    <Badge $variant="rose" style={{ padding: '1px 4px', fontSize: '9px' }}>
                      ☠️탈락
                    </Badge>
                  )}
                </OpponentStatsRow>

                {/* Overlapped Discard Pile Stack */}
                <DiscardPileStack
                  discardPile={p.discardPile}
                  onOpenHistory={handleOpenDiscardHistory}
                  playerName={p.nickname}
                />
              </OpponentSeat>
            );
          })}
        </OpponentsArea>

        {/* ========================================================= */}
        {/* AREA 2: Center Table (25% Height) */}
        {/* ========================================================= */}
        <CenterTableArea>
          {/* Floating Action Toast */}
          <AnimatePresence>
            {activeToast && (
              <FloatingToast
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <span>💬</span>
                <span>{activeToast}</span>
              </FloatingToast>
            )}
          </AnimatePresence>

          {/* Big Clear Turn Banner */}
          <CenterTurnBanner $isMyTurn={isMyTurn}>
            {isMyTurn ? (
              <>
                <Sparkles size={14} color={THEME.goldLight} />
                <span>👑 [내 턴] 카드를 선택하세요</span>
              </>
            ) : (
              <>
                <span>⏳</span>
                <span>[{currentTurnPlayer?.nickname || '상대방'}] 님의 턴</span>
              </>
            )}
          </CenterTurnBanner>

          {/* Centered Deck Slot */}
          <DeckSlot
            onClick={() => setDrawerOpen(true)}
            title="남은 덱 카드 수 (탭하여 카드 가이드 열기)"
          >
            <MiniDeckCardVisual>💌</MiniDeckCardVisual>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '10px', color: THEME.gold, fontWeight: 700 }}>
                남은 덱
              </span>
              <span style={{ fontSize: '13px', fontWeight: 800 }}>
                {roomState?.deckCount || 0}장
              </span>
            </div>
            {(roomState?.setAsideOpenCards || []).length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderLeft: `1px solid ${THEME.border}`, paddingLeft: '6px' }}>
                <span style={{ fontSize: '9px', color: THEME.mutedForeground }}>제외:</span>
                {roomState.setAsideOpenCards.map((card, idx) => {
                  const meta = CARD_DATA[card.value] || {};
                  return (
                    <span key={idx} style={{ fontSize: '9px', fontWeight: 800, color: meta.color }}>
                      {meta.icon}{card.value}
                    </span>
                  );
                })}
              </div>
            )}
          </DeckSlot>

          {/* Active Direct Targeting Banner Overlay */}
          {isTargetingMode && (
            <TargetingBanner>
              <Crosshair size={15} color={THEME.goldLight} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: THEME.goldLight }}>
                🎯 지목할 상대를 직접 터치하세요!
              </span>
              <Button
                $variant="outline"
                $size="sm"
                onClick={() => setIsTargetingMode(false)}
                style={{ padding: '2px 6px', height: '22px', fontSize: '10px', marginLeft: '4px' }}
              >
                <X size={11} />
                <span>취소</span>
              </Button>
            </TargetingBanner>
          )}
        </CenterTableArea>

        {/* ========================================================= */}
        {/* AREA 3: My Play & Hand Area (45% Height - 38px) */}
        {/* ========================================================= */}
        <MyPlayArea $isMyTurn={isMyTurn}>
          {/* My Minimal Status Bar */}
          <MyStatusBar>
            <MyStatusLeft>
              <Badge $variant="gold" style={{ padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>
                ⭐ {myPlayer?.tokens || 0}/{roomState?.targetTokens || 4}개
              </Badge>
              {myPlayer?.isProtected && (
                <Badge $variant="emerald" style={{ padding: '1px 6px', fontSize: '10px' }}>
                  🌸 보호막 활성
                </Badge>
              )}
              {myPlayer?.isEliminated && (
                <Badge $variant="rose" style={{ padding: '1px 6px', fontSize: '10px' }}>
                  ☠️ 탈락
                </Badge>
              )}
            </MyStatusLeft>

            <MyStatusRight>
              {/* If Prince is in targeting mode, provide self-target button */}
              {isTargetingMode && selectedCard?.value === 5 && (
                <Button
                  $variant="gold"
                  $size="sm"
                  onClick={() => handleSeatClick(currentUser)}
                  style={{ height: '22px', padding: '0 8px', fontSize: '10px' }}
                >
                  🎯 나 자신 지목
                </Button>
              )}

              <span style={{ color: THEME.mutedForeground, fontSize: '10px' }}>내 낸 패:</span>
              <DiscardPileStack
                discardPile={myPlayer?.discardPile}
                onOpenHistory={handleOpenDiscardHistory}
                playerName={currentUser?.nickname || '나'}
              />
            </MyStatusRight>
          </MyStatusBar>

          {/* Hand Cards (2-Step Touch) */}
          <HandCardsWrapper>
            <AnimatePresence>
              {myPlayer?.hand?.map((card, idx) => {
                const cardMeta = CARD_DATA[card.value] || {};
                const isSelected = selectedCardIndex === idx;
                const isRestricted = isCountessForced && (card.value === 5 || card.value === 6);
                const isForced = isCountessForced && card.value === 7;

                return (
                  <CardMotion
                    key={card.id || `${card.value}-${idx}`}
                    $color={cardMeta.color}
                    $isSelected={isSelected}
                    $isRestricted={isRestricted}
                    $isForced={isForced}
                    $isMyTurn={isMyTurn}
                    $canPlay={isMyTurn && !myPlayer.isEliminated}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    onClick={() => handleCardTap(idx, card)}
                  >
                    {isRestricted && (
                      <RestrictionBadge>⚠️ 백작부인 필수</RestrictionBadge>
                    )}
                    {isForced && (
                      <RestrictionBadge style={{ backgroundColor: '#ec4899' }}>
                        ✨ 필수 사용
                      </RestrictionBadge>
                    )}

                    <CardHeaderRow>
                      <CardValueBadge $color={cardMeta.color}>
                        {card.value}
                      </CardValueBadge>
                      <span style={{ fontSize: '10px', color: cardMeta.color, fontWeight: 800 }}>
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

          {/* 2-Step Action Control Bar */}
          <ActionControlBar>
            {isMyTurn && !myPlayer?.isEliminated ? (
              selectedCard && (
                <Button
                  $variant="gold"
                  $size="default"
                  $fullWidth
                  onClick={() => handleTriggerCardPlay(selectedCard)}
                  style={{
                    height: '38px',
                    fontSize: '13px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                  }}
                >
                  <Sparkles size={16} />
                  <span>
                    ✨ [{selectedCard.name} ({selectedCard.value})] 카드 사용하기
                  </span>
                </Button>
              )
            ) : myPlayer?.isEliminated ? (
              <div
                style={{
                  fontSize: '11px',
                  color: THEME.rose,
                  fontWeight: 600,
                }}
              >
                ☠️ 이번 라운드 탈락 (다음 라운드 대기 중)
              </div>
            ) : null}
          </ActionControlBar>
        </MyPlayArea>
      </TableArea>

      {/* ========================================================= */}
      {/* 4. GUARD SMART CARD COUNTER GUESS MODAL */}
      {/* ========================================================= */}
      <Dialog open={guardModalOpen} onClose={() => setGuardModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>🛡️ 경비병: 상대 카드 추측</DialogTitle>
          <DialogDescription>
            [{guardTargetPlayer?.nickname}] 님이 보유 중일 카드를 추측하세요.
            (테이블에 소진된 카드는 자동 비활성화됩니다)
          </DialogDescription>
        </DialogHeader>

        <div style={{ fontSize: '12px', fontWeight: 700, color: THEME.gold, marginTop: '6px' }}>
          추측할 카드 선택 (2~8번)
        </div>

        <SmartGuessGrid>
          {[2, 3, 4, 5, 6, 7, 8].map((num) => {
            const meta = CARD_DATA[num];
            const totalCount = meta.count;
            const revealed = cardCounter[num] || 0;
            const remaining = totalCount - revealed;
            const isZero = remaining <= 0;

            return (
              <SmartGuessButton
                key={num}
                $selected={selectedGuessValue === num}
                $isZero={isZero}
                disabled={isZero}
                onClick={() => setSelectedGuessValue(num)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                  <span style={{ fontSize: '16px' }}>{meta.icon}</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: meta.color }}>
                    {num}. {meta.name}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: isZero ? THEME.rose : THEME.emerald,
                    fontWeight: 700,
                    marginTop: '2px',
                  }}
                >
                  {isZero ? '0장 남음 (소진됨)' : `${remaining}/${totalCount}장 남음`}
                </div>
              </SmartGuessButton>
            );
          })}
        </SmartGuessGrid>

        <DialogFooter>
          <Button $variant="outline" onClick={() => setGuardModalOpen(false)}>
            취소
          </Button>
          <Button
            $variant="gold"
            onClick={() =>
              executePlay(selectedCard?.id, guardTargetPlayer?.id, selectedGuessValue)
            }
            disabled={!guardTargetPlayer || (CARD_DATA[selectedGuessValue]?.count - (cardCounter[selectedGuessValue] || 0) <= 0)}
          >
            추측 제출
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ========================================================= */}
      {/* 5. PRIEST SECRET REVEAL MODAL */}
      {/* ========================================================= */}
      <Dialog open={priestResultModalOpen} onClose={() => setPriestResultModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>📜 사제: 손패 투시 결과</DialogTitle>
          <DialogDescription>
            [{priestData?.targetNickname}] 님의 비밀 손패를 확인했습니다.
          </DialogDescription>
        </DialogHeader>

        {priestData?.card && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
            <Card
              style={{
                width: '130px',
                height: '180px',
                padding: '12px',
                borderColor: CARD_DATA[priestData.card.value]?.color || THEME.gold,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 900,
                  color: CARD_DATA[priestData.card.value]?.color || THEME.gold,
                  textAlign: 'left',
                }}
              >
                {priestData.card.value}
              </div>
              <div style={{ fontSize: '2.8rem', margin: '4px 0' }}>
                {CARD_DATA[priestData.card.value]?.icon}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800 }}>
                  {priestData.card.name}
                </div>
                <div style={{ fontSize: '10px', color: THEME.mutedForeground, marginTop: '2px' }}>
                  {CARD_DATA[priestData.card.value]?.desc}
                </div>
              </div>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button $variant="gold" $fullWidth onClick={() => setPriestResultModalOpen(false)}>
            확인 완료
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ========================================================= */}
      {/* 6. DISCARD HISTORY POPOVER / MODAL */}
      {/* ========================================================= */}
      <Dialog open={discardHistoryModalOpen} onClose={() => setDiscardHistoryModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>🎴 [{discardHistoryTarget?.playerName}] 님의 사용한 패</DialogTitle>
          <DialogDescription>
            지금까지 내려놓은 카드 내역 (총 {discardHistoryTarget?.discardPile?.length || 0}장)
          </DialogDescription>
        </DialogHeader>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '260px',
            overflowY: 'auto',
            margin: '10px 0',
          }}
        >
          {(!discardHistoryTarget?.discardPile || discardHistoryTarget.discardPile.length === 0) ? (
            <div style={{ textAlign: 'center', color: THEME.mutedForeground, fontSize: '12px', padding: '20px 0' }}>
              아직 낸 카드가 없습니다.
            </div>
          ) : (
            discardHistoryTarget.discardPile.map((card, idx) => {
              const meta = CARD_DATA[card.value] || {};
              return (
                <div
                  key={`${card.id || card.value}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    backgroundColor: THEME.secondary,
                    borderRadius: THEME.radius.md,
                    borderLeft: `3px solid ${meta.color}`,
                  }}
                >
                  <span style={{ fontSize: '11px', color: THEME.mutedForeground, width: '24px', fontWeight: 700 }}>
                    #{idx + 1}
                  </span>
                  <span style={{ fontSize: '18px' }}>{meta.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: meta.color }}>
                      {card.value}. {meta.name} ({meta.nameEn})
                    </div>
                    <div style={{ fontSize: '10px', color: THEME.mutedForeground, marginTop: '2px' }}>
                      {meta.desc}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button $variant="outline" $fullWidth onClick={() => setDiscardHistoryModalOpen(false)}>
            닫기
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ========================================================= */}
      {/* 7. ROUND END & GAME OVER MODAL */}
      {/* ========================================================= */}
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

        <div style={{ textAlign: 'center', margin: '12px 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '6px' }}>
            {roomState?.gameState === 'GAME_OVER' ? '👑' : '⭐'}
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: THEME.gold }}>
            {roomState?.gameState === 'GAME_OVER'
              ? roomState?.gameWinner?.nickname
              : roomState?.roundWinner?.nickname}
          </div>
          <div style={{ fontSize: '12px', color: THEME.mutedForeground, marginTop: '4px' }}>
            {roomState?.roundWinner?.reason || '라운드가 종료되었습니다.'}
          </div>

          {/* Reveal All Players' Final Hands */}
          {roomState?.players && (
            <div style={{ marginTop: '14px', textAlign: 'left' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: THEME.gold, marginBottom: '6px' }}>
                전원 손패 공개:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {roomState.players.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      backgroundColor: THEME.secondary,
                      borderRadius: THEME.radius.md,
                      fontSize: '11px',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{p.nickname}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {p.hand && p.hand.length > 0 ? (
                        p.hand.map((c, i) => {
                          const meta = CARD_DATA[c.value] || {};
                          return (
                            <Badge key={i} $variant="gold" style={{ fontSize: '10px' }}>
                              {meta.icon} {c.value} {meta.name}
                            </Badge>
                          );
                        })
                      ) : (
                        <span style={{ color: THEME.mutedForeground, fontSize: '10px' }}>
                          {p.isEliminated ? '☠️ 탈락' : '없음'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            <div
              style={{
                fontSize: '12px',
                color: THEME.mutedForeground,
                textAlign: 'center',
                width: '100%',
                padding: '8px 0',
              }}
            >
              방장이 다음 라운드를 시작할 때까지 대기 중입니다...
            </div>
          )}
        </DialogFooter>
      </Dialog>

      {/* ========================================================= */}
      {/* 8. SIDE DRAWER (Settings, Room Info, Action Logs & Guide) */}
      {/* ========================================================= */}
      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="⚙️ 방 설정 및 게임 가이드"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Room Info & Invite Code */}
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: THEME.secondary,
              borderRadius: THEME.radius.md,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: THEME.mutedForeground }}>방 코드 (터치하여 복사)</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: THEME.goldLight, letterSpacing: '1px' }}>
                {roomState?.code}
              </div>
            </div>
            <Button $variant="outline" $size="sm" onClick={handleCopyCode} style={{ height: '30px' }}>
              {copiedCode ? <Check size={14} color={THEME.emerald} /> : <Copy size={14} />}
              <span style={{ marginLeft: '4px' }}>{copiedCode ? '복사됨' : '복사'}</span>
            </Button>
          </div>

          {/* Voice & Sound Controls */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: THEME.gold, marginBottom: '8px' }}>
              🎛️ 음성 통화 및 사운드 설정
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <Button
                $variant={webrtc?.isMicOn ? 'emerald' : 'outline'}
                $size="sm"
                onClick={webrtc?.toggleMic}
                style={{ height: '36px', fontSize: '12px' }}
              >
                {webrtc?.isMicOn ? <Mic size={14} /> : <MicOff size={14} />}
                <span style={{ marginLeft: '4px' }}>마이크 {webrtc?.isMicOn ? 'ON' : 'OFF'}</span>
              </Button>

              <Button
                $variant={webrtc?.isSpeakerOn ? 'secondary' : 'outline'}
                $size="sm"
                onClick={webrtc?.toggleSpeaker}
                style={{ height: '36px', fontSize: '12px' }}
              >
                {webrtc?.isSpeakerOn ? <Volume2 size={14} /> : <VolumeX size={14} color={THEME.rose} />}
                <span style={{ marginLeft: '4px' }}>스피커 {webrtc?.isSpeakerOn ? 'ON' : 'OFF'}</span>
              </Button>

              <Button
                $variant={sfxEnabled ? 'secondary' : 'outline'}
                $size="sm"
                onClick={toggleSFX}
                style={{ height: '36px', fontSize: '12px' }}
              >
                <span>{sfxEnabled ? '🎵' : '🔇'}</span>
                <span style={{ marginLeft: '4px' }}>효과음 {sfxEnabled ? 'ON' : 'OFF'}</span>
              </Button>

              <Button
                $variant={stt?.isSTTEnabled ? 'emerald' : 'outline'}
                $size="sm"
                onClick={stt?.toggleSTT}
                style={{ height: '36px', fontSize: '12px' }}
              >
                <MessageSquare size={14} />
                <span style={{ marginLeft: '4px' }}>STT 자막 {stt?.isSTTEnabled ? 'ON' : 'OFF'}</span>
              </Button>
            </div>
          </div>

          {/* Action History Log */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: THEME.gold, marginBottom: '6px' }}>
              📜 전체 액션 히스토리
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                maxHeight: '140px',
                overflowY: 'auto',
                fontSize: '11px',
              }}
            >
              {(roomState?.actionLogs || []).map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '5px 8px',
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

          {/* 1~8 Card Guide */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: THEME.gold, marginBottom: '6px' }}>
              🃏 러브레터 1~8번 카드 가이드
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px' }}>
              {Object.values(CARD_DATA).map((c) => (
                <div
                  key={c.value}
                  style={{
                    padding: '5px 8px',
                    backgroundColor: THEME.secondary,
                    borderRadius: THEME.radius.md,
                    borderLeft: `3px solid ${c.color}`,
                  }}
                >
                  <div style={{ fontWeight: 800, color: c.color, marginBottom: '1px' }}>
                    {c.icon} {c.value}. {c.name} ({c.nameEn}) - 총 {c.count}장
                  </div>
                  <div style={{ color: THEME.mutedForeground, fontSize: '10px' }}>
                    {c.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SideDrawer>

      {/* ========================================================= */}
      {/* 9. 3-MINUTE PAUSE OVERLAY */}
      {/* ========================================================= */}
      <PauseOverlay
        open={!!roomState?.isPaused}
        pausedPlayerNickname={
          roomState?.players?.find((p) => p.id === roomState?.pausedPlayerId)?.nickname || '플레이어'
        }
        pauseExpiresAt={roomState?.pauseExpiresAt}
        onForfeit={() => setForfeitModalOpen(true)}
      />

      {/* ========================================================= */}
      {/* 10. FORFEIT CONFIRMATION MODAL */}
      {/* ========================================================= */}
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

      {/* ========================================================= */}
      {/* 11. REAL-TIME CARD ACTION SHOWCASE MODAL */}
      {/* ========================================================= */}
      <AnimatePresence>
        {actionShowcase && (
          <ShowcaseBackdrop
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ShowcaseCardBox
              $color={CARD_DATA[actionShowcase.card.value]?.color}
              initial={{ scale: 0.7, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: -20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <ShowcaseHeader>
                <span>
                  {actionShowcase.actorNickname === currentUser?.nickname
                    ? '👤 [나]'
                    : `🤖 [${actionShowcase.actorNickname}]`}
                </span>
                <span style={{ color: THEME.gold }}>님이 카드 사용!</span>
              </ShowcaseHeader>

              <ShowcaseCardVisual $color={CARD_DATA[actionShowcase.card.value]?.color}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 900, color: CARD_DATA[actionShowcase.card.value]?.color }}>
                    {actionShowcase.card.value}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: CARD_DATA[actionShowcase.card.value]?.color }}>
                    {CARD_DATA[actionShowcase.card.value]?.nameEn}
                  </span>
                </div>

                <div style={{ fontSize: '32px' }}>
                  {CARD_DATA[actionShowcase.card.value]?.icon}
                </div>

                <div style={{ fontSize: '11px', fontWeight: 800, color: '#fff', textAlign: 'center' }}>
                  {actionShowcase.card.name}
                </div>
              </ShowcaseCardVisual>

              <ShowcaseFooter>
                {actionShowcase.targetNickname && (
                  <div>
                    🎯 대상: <strong style={{ color: '#fff' }}>[{actionShowcase.targetNickname}]</strong>
                  </div>
                )}
                {actionShowcase.guessCardName && (
                  <div style={{ color: THEME.emerald, marginTop: '2px' }}>
                    🔮 추측: [{actionShowcase.guessValue}. {actionShowcase.guessCardName}]
                  </div>
                )}
                {!actionShowcase.targetNickname && !actionShowcase.guessCardName && (
                  <div style={{ color: THEME.mutedForeground }}>
                    {actionShowcase.card.desc}
                  </div>
                )}
              </ShowcaseFooter>
            </ShowcaseCardBox>
          </ShowcaseBackdrop>
        )}
      </AnimatePresence>
    </BoardContainer>
  );
}
