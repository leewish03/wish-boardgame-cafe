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
  if (isEliminated) return <HandContainer data-player-id="self-seat"><EliminatedRail><CircleSlash size={18}/><strong>이번 라운드에서 탈락했습니다</strong><span>관전 중 · 다음 라운드를 기다려 주세요</span></EliminatedRail></HandContainer>;
  return <HandContainer data-player-id="self-seat">
    <HandHeader><span>{message}</span></HandHeader>
    <CardsRow>{actionSlot && <ActionSlot>{actionSlot}</ActionSlot>}{[0, 1].map((index) => {
      const card = hand[index];
      const start = hand.length === 1 ? (index === 0 ? 3 : 2) : index + 2;
      if (!card) return <HandCell key={index} $column={start}><HandSlot playerId={playerId} index={index}/></HandCell>;
      const countessLocked = hasCountess && hasPrinceOrKing && card.value !== 7;
      return <HandCell key={index} $column={start}><HandSlot playerId={playerId} index={index} cardId={card.id}><GameCard id={card.id} value={card.value as CardValue} name={card.name} isSelected={selectedCardId===card.id} isDisabled={countessLocked} isInteractive={canSelectCards && !countessLocked} disabledReason={countessLocked ? '백작부인을 먼저 사용해야 합니다' : undefined} onClick={() => canSelectCards && !countessLocked && onSelectCard(card)} /></HandSlot></HandCell>;
    })}</CardsRow>
  </HandContainer>;
};
const HandContainer = styled.section`width:100%; padding:4px 8px max(12px, env(safe-area-inset-bottom)); box-sizing:border-box; flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:4px;`;
const HandHeader = styled.div`display:flex; align-items:center; gap:7px; min-height:20px; color:#5f1d2c; font-size:11px; font-weight:850;`;
const CardsRow = styled.div`--decision-card:clamp(106px,29vw,154px);display:grid;grid-template-columns:repeat(3,var(--decision-card));align-items:flex-end;justify-content:center;gap:clamp(4px,2vw,12px);width:100%;@media(max-width:340px){--decision-card:96px;}@media(max-height:650px){--decision-card:96px;}`;
const HandCell=styled.div<{$column:number}>`grid-column:${p=>p.$column};min-width:0;display:flex;justify-content:center;`;
const ActionSlot=styled.div`grid-column:1;min-width:0;width:100%;aspect-ratio:154 / 220;display:flex;align-items:flex-end;justify-content:center;`;
const Slot = styled.div<{$empty:boolean}>`min-width:0;width:100%;aspect-ratio:154 / 220;justify-self:center;display:flex;justify-content:center;align-items:flex-end;visibility:${p=>p.$empty?'hidden':'visible'};`;
const EliminatedRail=styled.div`width:min(460px,100%);min-height:64px;display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:9px;padding:10px 13px;box-sizing:border-box;border:1px solid ${THEME.border};border-radius:12px;background:rgba(255,253,247,.72);color:${THEME.mutedForeground};filter:grayscale(.9);svg{grid-row:1 / span 2;color:${THEME.burgundy};}strong{font-size:12px;color:${THEME.foreground};}span{font-size:10px;}`;
