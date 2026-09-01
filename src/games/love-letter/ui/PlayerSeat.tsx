import React from 'react';
import styled, { css } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { CircleSlash, Heart, ShieldCheck } from 'lucide-react';
import { PlayerPublic } from '../../../../packages/love-letter-core/src/types';
import { THEME } from '../../../shared/theme';
import { getHeraldicIcon } from '../presentation/heraldicIcons';

interface PlayerSeatProps {
  player: PlayerPublic;
  isCurrentTurn: boolean;
  isTargetable: boolean;
  isSelectedTarget: boolean;
  isSelf: boolean;
  isSpeaking?: boolean;
  subtitle?: { text: string; timestamp: number } | null;
  targetDisabledReason?: string;
  onClickTarget?: () => void;
  onInspectDiscards?: () => void;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player, isCurrentTurn, isTargetable, isSelectedTarget, isSelf, isSpeaking = false,
  subtitle, targetDisabledReason, onClickTarget, onInspectDiscards,
}) => {
  const imageAvatar = player.avatar && /^(https?:|\/)/.test(player.avatar);
  const visibleDiscards = (player.discardPile || []).slice(-4);
  const hiddenDiscardCount = Math.max(0, (player.discardPile || []).length - visibleDiscards.length);

  return (
    <SeatWrapper>
      <AnimatePresence>
        {subtitle?.text && <SpeechBubble as={motion.div} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {subtitle.text}
        </SpeechBubble>}
      </AnimatePresence>
      <SeatContainer
        as={motion.button}
        type="button"
        $isCurrentTurn={isCurrentTurn}
        $isTargetable={isTargetable}
        $isSelectedTarget={isSelectedTarget}
        $isEliminated={player.isEliminated}
        $isProtected={player.isProtected}
        onClick={isTargetable ? onClickTarget : undefined}
        aria-disabled={!isTargetable}
        whileTap={isTargetable ? { scale: 0.97 } : undefined}
        data-player-id={player.id}
        aria-label={`${player.nickname}${isTargetable ? ' 선택 가능' : ''}`}
      >
        <IdentityRow>
          <AvatarRing $isCurrentTurn={isCurrentTurn} $isSpeaking={isSpeaking}>
            {imageAvatar ? <AvatarImage src={player.avatar} alt="" /> : <AvatarInitial>{player.nickname.slice(0, 1)}</AvatarInitial>}
            {player.isProtected && <StateIcon title="보호됨"><ShieldCheck size={11} /></StateIcon>}
            {player.isEliminated && <StateIcon title="탈락"><CircleSlash size={11} /></StateIcon>}
          </AvatarRing>
          <IdentityText>
            <NameRow><PlayerName>{player.nickname}</PlayerName>{player.isBot && <Tag>AI</Tag>}{isSelf && <Tag>나</Tag>}</NameRow>
            <StatsRow><Heart size={10} fill="currentColor" /> {player.tokens}<HandBack aria-label={`손패 ${player.cardCount}장`}>{player.cardCount}</HandBack></StatsRow>
          </IdentityText>
          {isCurrentTurn && <TurnMark>차례</TurnMark>}
        </IdentityRow>

        <PublicPile onClick={event => { if (isTargetable) return; event.stopPropagation(); onInspectDiscards?.(); }} title={`${player.nickname} 공개 패 ${player.discardPile?.length || 0}장`}>
          {visibleDiscards.length ? visibleDiscards.map((card, index) => (
            <PublicCard key={`${card.id}_${index}`} $index={index} aria-label={`${card.value} ${card.name}`}>
              <span>{card.value}</span>{getHeraldicIcon(card.value, 10)}
            </PublicCard>
          )) : <EmptyPile>공개 패 없음</EmptyPile>}
          {hiddenDiscardCount > 0 && <OverflowCount>+{hiddenDiscardCount}</OverflowCount>}
        </PublicPile>

        {player.isProtected && <StateText>보호</StateText>}
        {player.isEliminated && <StateText>탈락</StateText>}
        {!isTargetable && targetDisabledReason && <DisabledText>{targetDisabledReason}</DisabledText>}
      </SeatContainer>
    </SeatWrapper>
  );
};

const SeatWrapper = styled.div`position: relative; min-width: 0; width: 100%;`;
const SpeechBubble = styled.div`
  position:absolute; z-index:8; top:-25px; left:50%; transform:translateX(-50%); max-width:120px;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:3px 7px; border-radius:999px;
  background:${THEME.primary}; color:#fff; font-size:9px; font-weight:700;
`;
const SeatContainer = styled.button<{ $isCurrentTurn:boolean; $isTargetable:boolean; $isSelectedTarget:boolean; $isEliminated:boolean; $isProtected:boolean }>`
  width:100%; min-width:0; padding:5px; border-radius:10px; text-align:left; font:inherit;
  background:rgba(255,255,255,.93); background-image:${THEME.gradients.marbleSlab}; border:1px solid ${THEME.border};
  cursor:${p => p.$isTargetable ? 'pointer' : 'default'}; color:${THEME.foreground}; box-sizing:border-box;
  transition:border-color .18s ease, background .18s ease, opacity .18s ease, transform .18s ease;
  ${p => p.$isCurrentTurn && css`border:2px solid ${THEME.gold}; background:#fffdf4; box-shadow:0 2px 10px rgba(197,160,89,.22);`}
  ${p => p.$isTargetable && css`border:2px solid ${THEME.burgundy}; background:#fff8f1;`}
  ${p => p.$isSelectedTarget && css`background:#fff1f2; border-color:${THEME.burgundy};`}
  ${p => p.$isEliminated && css`opacity:.54; filter:grayscale(1);`}
`;
const IdentityRow = styled.div`display:flex; min-width:0; align-items:center; gap:4px;`;
const AvatarRing = styled.div<{ $isCurrentTurn:boolean; $isSpeaking:boolean }>`
  position:relative; width:25px; height:25px; flex:0 0 25px; overflow:visible; border-radius:50%; background:${THEME.primary};
  border:1px solid ${p => p.$isCurrentTurn ? THEME.gold : THEME.border}; display:grid; place-items:center;
  ${p => p.$isSpeaking && css`box-shadow:0 0 0 2px ${THEME.emerald};`}
`;
const AvatarImage = styled.img`width:100%; height:100%; border-radius:inherit; object-fit:cover;`;
const AvatarInitial = styled.span`color:${THEME.goldLight}; font-family:${THEME.font.serif}; font-size:12px; font-weight:900;`;
const StateIcon = styled.span`position:absolute; display:grid; place-items:center; right:-4px; bottom:-4px; width:15px; height:15px; border-radius:50%; background:#fff; color:${THEME.burgundy}; border:1px solid ${THEME.border};`;
const IdentityText = styled.div`min-width:0; flex:1;`;
const NameRow = styled.div`display:flex; min-width:0; gap:3px; align-items:center;`;
const PlayerName = styled.span`font-size:10px; font-weight:850; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`;
const Tag = styled.span`font-size:7px; color:${THEME.mutedForeground}; border:1px solid ${THEME.border}; padding:0 2px; border-radius:3px; flex:0 0 auto;`;
const StatsRow = styled.div`display:flex; align-items:center; gap:2px; color:${THEME.burgundy}; font-size:9px; font-weight:800;`;
const HandBack = styled.span`margin-left:3px; color:${THEME.mutedForeground}; font-size:8px; border:1px solid ${THEME.border}; border-radius:3px; padding:0 3px;`;
const TurnMark = styled.span`font-size:8px; font-weight:900; color:${THEME.burgundy}; flex:0 0 auto;`;
const PublicPile = styled.div`position:relative; display:flex; align-items:flex-end; width:100%; height:31px; margin-top:4px; padding:0; cursor:pointer;`;
const PublicCard = styled.span<{ $index:number }>`
  position:absolute; left:${p => p.$index * 16}px; bottom:0; width:22px; height:29px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0;
  border-radius:3px; background:#fffdf7; border:1px solid ${THEME.gold}; color:${THEME.primary}; box-shadow:0 1px 3px rgba(9,13,22,.14); font-family:${THEME.font.serif}; font-size:11px; font-weight:900;
`;
const EmptyPile = styled.span`align-self:center; font-size:8px; color:${THEME.mutedForeground};`;
const OverflowCount = styled.span`margin-left:69px; padding-bottom:3px; font-size:8px; color:${THEME.mutedForeground}; font-weight:800;`;
const StateText = styled.div`font-size:8px; color:${THEME.burgundy}; font-weight:800; margin-top:2px;`;
const DisabledText = styled.div`font-size:8px; color:${THEME.mutedForeground}; margin-top:2px;`;
