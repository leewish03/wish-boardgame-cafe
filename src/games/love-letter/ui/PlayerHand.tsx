import React from 'react';
import styled from 'styled-components';
import { GameCard } from './GameCard';
import { CardInstance, CardValue } from '../../../../packages/love-letter-core/src/types';
import { useTableAnchor } from '../presentation/TableAnchorRegistry';
import { useHiddenHand } from '../presentation/PhysicalTableContext';
import { CircleSlash } from 'lucide-react';
import { THEME } from '../../../shared/theme';

interface PlayerHandProps {
  playerId: string; hand: CardInstance[]; isMyTurn: boolean; canSelectCards: boolean; selectedCardId: string | null; interactionState: string;
  errorMessage?: string | null; onSelectCard:(card:CardInstance)=>void; onValidDrop:(card:CardInstance)=>void;
  onDragStateChange?: (isDragging:boolean, isOverDropZone:boolean)=>void; onCancelSelection?:()=>void;
  actionSlot?: React.ReactNode; isEliminated?: boolean;
}
const HandSlot: React.FC<{ playerId:string; index:number; cardId?:string; children?:React.ReactNode }> = ({ playerId, index, cardId, children }) => {
  const anchor = useTableAnchor(playerId, index === 0 ? 'hand-slot-0' : 'hand-slot-1');
  const cardAnchor = useTableAnchor(playerId, `card:${cardId}`);
  const hidden = useHiddenHand(playerId);
  return <Slot ref={anchor} $empty={!children}><div ref={cardAnchor} style={{visibility: hidden.all || (cardId && hidden.playedCardId === cardId) ? 'hidden' : undefined}}>{children}</div></Slot>;
};

export const PlayerHand: React.FC<PlayerHandProps> = ({ playerId, hand, isMyTurn, canSelectCards, selectedCardId, interactionState, errorMessage, onSelectCard, actionSlot, isEliminated=false }) => {
  const hasCountess = hand.some(c => c.value === 7);
  const hasPrinceOrKing = hand.some(c => c.value === 5 || c.value === 6);
  const message = errorMessage || (interactionState === 'TARGETING' ? '빛나는 플레이어 자리를 선택하세요' : interactionState === 'GUESSING' ? '경비병이 추측할 카드를 고르세요' : interactionState === 'READY' ? '사용 내용을 확인한 뒤 확정하세요' : interactionState === 'SUBMITTING' ? '행동을 서버에 전달했습니다' : !isMyTurn ? '상대의 차례 · 내 카드를 확인할 수 있어요' : !canSelectCards ? '이전 행동을 확인하는 중' : '내 차례 · 카드를 선택하세요');
  if (isEliminated) return <HandContainer data-player-id="self-seat" $eliminated><EliminatedRail><EliminatedMark><CircleSlash size={38}/></EliminatedMark><EliminatedCopy><small>ROUND SPECTATOR</small><strong>이번 라운드에서 탈락했습니다</strong><span>공개된 테이블을 관전하며 다음 라운드를 기다려 주세요</span></EliminatedCopy></EliminatedRail></HandContainer>;
  return <HandContainer data-player-id="self-seat">
    <HandHeader><span>{message}</span></HandHeader>
    <CardsRow>{actionSlot && <ActionSlot>{actionSlot}</ActionSlot>}{[0, 1].map((index) => {
      const card = hand[index];
      const start = actionSlot
        ? (hand.length === 1 ? (index === 0 ? 3 : 2) : index + 2)
        : (hand.length === 1 ? 2 : index === 0 ? 1 : 3);
      if (!card) return <HandCell key={index} $column={start}><HandSlot playerId={playerId} index={index}/></HandCell>;
      const countessLocked = hasCountess && hasPrinceOrKing && card.value !== 7;
      return <HandCell key={index} $column={start}><HandSlot playerId={playerId} index={index} cardId={card.id}><GameCard id={card.id} value={card.value as CardValue} name={card.name} isSelected={selectedCardId===card.id} isDisabled={countessLocked} isInteractive={canSelectCards && !countessLocked} disabledReason={countessLocked ? '백작부인을 먼저 사용해야 합니다' : undefined} onClick={() => canSelectCards && !countessLocked && onSelectCard(card)} /></HandSlot></HandCell>;
    })}</CardsRow>
  </HandContainer>;
};
const HandContainer = styled.section<{$eliminated?:boolean}>`width:100%;height:100%;min-height:${p=>p.$eliminated?'190px':'0'};padding:4px 8px max(12px, env(safe-area-inset-bottom));box-sizing:border-box;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:${p=>p.$eliminated?'stretch':'flex-end'};gap:4px;`;
const HandHeader = styled.div`display:flex; align-items:center; gap:7px; min-height:20px; color:#5f1d2c; font-size:11px; font-weight:850;`;
const CardsRow = styled.div`--decision-card:clamp(106px,29vw,154px);display:grid;grid-template-columns:repeat(3,var(--decision-card));align-items:flex-end;justify-content:center;gap:clamp(4px,2vw,12px);width:100%;@media(max-width:340px){--decision-card:96px;}@media(max-height:650px){--decision-card:96px;}`;
const HandCell=styled.div<{$column:number}>`grid-column:${p=>p.$column};min-width:0;display:flex;justify-content:center;`;
const ActionSlot=styled.div`grid-column:1;min-width:0;width:100%;aspect-ratio:154 / 220;display:flex;align-items:flex-end;justify-content:center;`;
const Slot = styled.div<{$empty:boolean}>`min-width:0;width:100%;aspect-ratio:154 / 220;justify-self:center;display:flex;justify-content:center;align-items:flex-end;visibility:${p=>p.$empty?'hidden':'visible'};`;
const EliminatedRail=styled.div`width:min(460px,100%);min-height:190px;flex:1;display:flex;align-items:center;justify-content:center;gap:16px;padding:22px;box-sizing:border-box;border:1px solid ${THEME.border};border-radius:14px;background:linear-gradient(145deg,rgba(255,253,247,.92),rgba(240,239,235,.78));color:${THEME.mutedForeground};box-shadow:0 10px 28px rgba(9,13,22,.07);`;
const EliminatedMark=styled.div`width:70px;height:96px;flex:0 0 70px;display:grid;place-items:center;border:1px solid rgba(95,29,44,.22);border-radius:10px;background:rgba(255,255,255,.7);color:${THEME.burgundy};box-shadow:inset 0 0 0 3px rgba(184,161,107,.10);`;
const EliminatedCopy=styled.div`min-width:0;display:flex;flex-direction:column;gap:6px;small{font:800 8px ${THEME.font.sans};letter-spacing:.12em;color:${THEME.goldAntique};}strong{font:900 16px ${THEME.font.serif};color:${THEME.foreground};}span{font-size:10px;line-height:1.45;color:${THEME.mutedForeground};}@media(max-width:360px){strong{font-size:14px;}}`;
