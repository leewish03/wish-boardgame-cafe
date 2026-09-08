import React from 'react';
import styled from 'styled-components';
import { GameCard } from './GameCard';
import { CardInstance, CardValue } from '../../../../packages/love-letter-core/src/types';
import { useTableAnchor } from '../presentation/TableAnchorRegistry';
import { useHiddenHand } from '../presentation/PhysicalTableContext';

interface PlayerHandProps {
  playerId: string; hand: CardInstance[]; isMyTurn: boolean; canSelectCards: boolean; selectedCardId: string | null; interactionState: string;
  errorMessage?: string | null; onSelectCard:(card:CardInstance)=>void; onValidDrop:(card:CardInstance)=>void;
  onDragStateChange?: (isDragging:boolean, isOverDropZone:boolean)=>void; onCancelSelection?:()=>void;
}
const HandSlot: React.FC<{ playerId:string; index:number; cardId?:string; children?:React.ReactNode }> = ({ playerId, index, cardId, children }) => {
  const anchor = useTableAnchor(playerId, index === 0 ? 'hand-slot-0' : 'hand-slot-1');
  const cardAnchor = useTableAnchor(playerId, `card:${cardId}`);
  const hidden = useHiddenHand(playerId);
  return <Slot ref={anchor} $empty={!children}><div ref={cardAnchor} style={{visibility: hidden.all || (cardId && hidden.playedCardId === cardId) ? 'hidden' : undefined}}>{children}</div></Slot>;
};

export const PlayerHand: React.FC<PlayerHandProps> = ({ playerId, hand, isMyTurn, canSelectCards, selectedCardId, interactionState, errorMessage, onSelectCard, onCancelSelection }) => {
  const hasCountess = hand.some(c => c.value === 7);
  const hasPrinceOrKing = hand.some(c => c.value === 5 || c.value === 6);
  const message = errorMessage || (interactionState === 'TARGETING' ? '빛나는 플레이어 자리를 선택하세요' : interactionState === 'GUESSING' ? '경비병이 추측할 카드를 고르세요' : interactionState === 'READY' ? '사용 내용을 확인한 뒤 확정하세요' : interactionState === 'SUBMITTING' ? '행동을 서버에 전달했습니다' : !isMyTurn ? '상대의 차례 · 내 카드를 확인할 수 있어요' : !canSelectCards ? '이전 행동을 확인하는 중' : '내 차례 · 카드를 선택하세요');
  return <HandContainer data-player-id="self-seat">
    <HandHeader><span>{message}</span></HandHeader>
    <CardsRow>{[0, 1].map((index) => {
      const card = hand[index];
      if (!card) return <HandSlot key={index} playerId={playerId} index={index}/>;
      const countessLocked = hasCountess && hasPrinceOrKing && card.value !== 7;
      return <HandSlot key={index} playerId={playerId} index={index} cardId={card.id}><GameCard id={card.id} value={card.value as CardValue} name={card.name} isSelected={selectedCardId===card.id} isDisabled={countessLocked} isInteractive={canSelectCards && !countessLocked} disabledReason={countessLocked ? '백작부인을 먼저 사용해야 합니다' : undefined} onClick={() => canSelectCards && !countessLocked && onSelectCard(card)} /></HandSlot>;
    })}</CardsRow>
  </HandContainer>;
};
const HandContainer = styled.section`width:100%; padding:4px 8px max(12px, env(safe-area-inset-bottom)); box-sizing:border-box; flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:4px;`;
const HandHeader = styled.div`display:flex; align-items:center; gap:7px; min-height:20px; color:#5f1d2c; font-size:11px; font-weight:850;`;
const CardsRow = styled.div`display:grid; grid-template-columns:repeat(2,minmax(104px,154px)); align-items:flex-end; justify-content:center; gap:12px; width:100%;`;
const Slot = styled.div<{$empty:boolean}>`min-width:0; min-height:158px; display:flex; justify-content:center; align-items:flex-end; visibility:${p=>p.$empty?'hidden':'visible'}; @media(max-height:650px){min-height:142px;}`;
