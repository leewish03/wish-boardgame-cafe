import React from 'react';
import styled from 'styled-components';
import { GameCard } from './GameCard';
import { CardInstance, CardValue } from '../../../../packages/love-letter-core/src/types';
import { useTableAnchor } from '../presentation/TableAnchorRegistry';

interface PlayerHandProps {
  playerId: string; hand: CardInstance[]; isMyTurn: boolean; selectedCardId: string | null; interactionState: string;
  errorMessage?: string | null; onSelectCard:(card:CardInstance)=>void; onValidDrop:(card:CardInstance)=>void;
  onDragStateChange?: (isDragging:boolean, isOverDropZone:boolean)=>void; onCancelSelection?:()=>void;
}
const HandSlot: React.FC<{ playerId:string; index:number; children?:React.ReactNode }> = ({ playerId, index, children }) => {
  const anchor = useTableAnchor(playerId, index === 0 ? 'hand-slot-0' : 'hand-slot-1');
  return <Slot ref={anchor} $empty={!children}>{children}</Slot>;
};

export const PlayerHand: React.FC<PlayerHandProps> = ({ playerId, hand, isMyTurn, selectedCardId, interactionState, errorMessage, onSelectCard, onCancelSelection }) => {
  const hasCountess = hand.some(c => c.value === 7);
  const hasPrinceOrKing = hand.some(c => c.value === 5 || c.value === 6);
  const message = errorMessage || (isMyTurn ? interactionState === 'TARGETING' ? '상대 자리를 선택하세요' : interactionState === 'GUESSING' ? '카드 번호를 고르세요' : interactionState === 'SUBMITTING' ? '서버 확인 중' : '내 차례 · 카드를 선택하세요' : '상대의 차례');
  return <HandContainer data-player-id="self-seat">
    <HandHeader><span>{message}</span>{selectedCardId && <CancelButton type="button" onClick={onCancelSelection}>선택 취소</CancelButton>}</HandHeader>
    <CardsRow>{[0, 1].map((index) => {
      const card = hand[index];
      if (!card) return <HandSlot key={`empty_${index}`} playerId={playerId} index={index}/>;
      const countessLocked = hasCountess && hasPrinceOrKing && card.value !== 7;
      const locked = !isMyTurn || countessLocked || interactionState === 'SUBMITTING';
      return <HandSlot key={card.id || `hand_${index}`} playerId={playerId} index={index}><GameCard id={card.id} value={card.value as CardValue} name={card.name} isSelected={selectedCardId===card.id} isDisabled={locked} disabledReason={countessLocked ? '백작부인을 먼저 사용해야 합니다' : undefined} onClick={() => !locked && onSelectCard(card)} /></HandSlot>;
    })}</CardsRow>
  </HandContainer>;
};
const HandContainer = styled.section`width:100%; padding:4px 8px max(12px, env(safe-area-inset-bottom)); box-sizing:border-box; flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:4px;`;
const HandHeader = styled.div`display:flex; align-items:center; gap:7px; min-height:20px; color:#5f1d2c; font-size:11px; font-weight:850;`;
const CancelButton = styled.button`background:transparent; border:0; padding:0; color:#7c2d12; font:inherit; font-size:9px; text-decoration:underline; cursor:pointer;`;
const CardsRow = styled.div`display:grid; grid-template-columns:repeat(2,minmax(92px,126px)); align-items:flex-end; justify-content:center; gap:10px; width:100%;`;
const Slot = styled.div<{$empty:boolean}>`min-width:0; min-height:138px; display:flex; justify-content:center; align-items:flex-end; visibility:${p=>p.$empty?'hidden':'visible'}; @media(max-height:650px){min-height:142px;}`;
