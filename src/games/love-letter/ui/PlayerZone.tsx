import React from 'react';
import styled, { css } from 'styled-components';
import { motion } from 'framer-motion';
import { CircleSlash, Heart, ShieldCheck } from 'lucide-react';
import { CardInstance, PlayerPublic } from '../../../../packages/love-letter-core/src/types';
import { THEME } from '../../../shared/theme';
import { getHeraldicIcon } from '../presentation/heraldicIcons';
import { useTableAnchor } from '../presentation/TableAnchorRegistry';
import { PlayerHand } from './PlayerHand';

type PresentationAction = { event?: any } | null;

function projectedObjects(player: PlayerPublic, presentationAction: PresentationAction) {
  const event = presentationAction?.event;
  if (!event) return { handCount: player.cardCount, hideLatestDiscard: false };
  const eliminatedId = event.eliminatedId || event.presentation?.eliminatedPlayerId;
  if (event.type === 'CARD_PLAYED' && event.actorId === player.id) {
    return { handCount: player.cardCount + 1, hideLatestDiscard: true };
  }
  if (event.type === 'CARD_DRAWN' && event.playerId === player.id) {
    return { handCount: Math.max(0, player.cardCount - 1), hideLatestDiscard: false };
  }
  if (event.type === 'PRINCE_DISCARDED' && event.targetId === player.id) {
    return { handCount: player.cardCount, hideLatestDiscard: true };
  }
  if ((event.type === 'GUARD_SUCCESS' || event.type === 'GUARD_SUCCEEDED' || event.type === 'BARON_COMPARED') && eliminatedId === player.id) {
    return { handCount: 1, hideLatestDiscard: true };
  }
  return { handCount: player.cardCount, hideLatestDiscard: false };
}

interface IdentityProps {
  player: PlayerPublic; isSelf?: boolean; isCurrentTurn: boolean; isTargetable: boolean;
  isSelectedTarget: boolean; isSpeaking?: boolean; onSelect?: () => void;
}

export const PlayerIdentity: React.FC<IdentityProps> = ({ player, isSelf=false, isCurrentTurn, isTargetable, isSelectedTarget, isSpeaking=false, onSelect }) => {
  const anchor = useTableAnchor(player.id, 'identity');
  const imageAvatar = player.avatar && /^(https?:|\/)/.test(player.avatar);
  return <IdentityButton ref={anchor} as={motion.button} type="button" data-player-id={player.id} onClick={isTargetable ? onSelect : undefined}
    $turn={isCurrentTurn} $targetable={isTargetable} $selected={isSelectedTarget} $eliminated={player.isEliminated} $self={isSelf}
    aria-label={`${player.nickname}${isTargetable ? ' 선택 가능' : ''}`} aria-disabled={!isTargetable} whileTap={isTargetable ? {scale:.98} : undefined}>
    <Avatar $turn={isCurrentTurn} $speaking={isSpeaking}>{imageAvatar ? <img src={player.avatar} alt=""/> : player.nickname.slice(0,1)}{player.isProtected && <Status><ShieldCheck size={10}/></Status>}{player.isEliminated && <Status><CircleSlash size={10}/></Status>}</Avatar>
    <IdentityCopy><Name>{player.nickname}</Name><Meta><Heart size={9} fill="currentColor"/> {player.tokens}{isSelf && <small>나</small>}</Meta></IdentityCopy>
    {isCurrentTurn && <Turn>차례</Turn>}
  </IdentityButton>;
};

export const HeldCardBacks: React.FC<{playerId:string; count:number}> = ({ playerId, count }) => {
  const anchor = useTableAnchor(playerId, 'hand');
  return <HeldArea ref={anchor} aria-label={`손패 ${count}장`} $empty={count===0}>
    <HeldCards>{[0, 1].map(index => <HeldSlot key={index} playerId={playerId} index={index} visible={index < Math.min(2,count)}/>)}</HeldCards>
    {count > 1 && <Count>{count}</Count>}
    {count === 0 && <Empty>손패 없음</Empty>}
  </HeldArea>;
};

const HeldSlot: React.FC<{playerId:string;index:number;visible:boolean}> = ({playerId,index,visible}) => {
  const anchor = useTableAnchor(playerId, index === 0 ? 'hand-slot-0' : 'hand-slot-1');
  return <HeldBack ref={anchor} $hidden={!visible}/>;
};

export const PublicDiscardShelf: React.FC<{playerId:string; cards:CardInstance[]; local?:boolean; hideLatest?:boolean; onInspect?:()=>void}> = ({playerId,cards,local=false,hideLatest=false,onInspect}) => {
  const anchor = useTableAnchor(playerId, 'discard');
  const latestAnchor = useTableAnchor(playerId, 'discard-latest');
  const settledCards = hideLatest ? cards.slice(0, -1) : cards;
  const visible = settledCards.slice(-4);
  const hidden = Math.max(0,settledCards.length-visible.length);
  return <Shelf ref={anchor} type="button" onClick={onInspect} $local={local} aria-label={`공개 버린 패 ${cards.length}장`}>
    <ShelfLabel>{local ? '내 공개 버린 패' : '공개 패'}</ShelfLabel>
    <Pile $local={local}>{visible.map((card,index)=><DiscardCard ref={index===visible.length-1 ? latestAnchor : undefined} key={`${card.id}_${index}`} $index={index} $local={local}><b>{card.value}</b>{getHeraldicIcon(card.value,local?12:9)}</DiscardCard>)}{visible.length===0 && <NoCards ref={latestAnchor}>아직 없음</NoCards>}{hidden>0 && <More>+{hidden}</More>}</Pile>
  </Shelf>;
};

interface OpponentZoneProps extends IdentityProps { onInspect?:()=>void; presentationAction?:PresentationAction; }
export const OpponentZone: React.FC<OpponentZoneProps> = ({presentationAction,...props}) => {
  const projected = projectedObjects(props.player, presentationAction || null);
  return <OpponentZoneRoot>
    <PlayerIdentity {...props}/><HeldCardBacks playerId={props.player.id} count={projected.handCount}/><PublicDiscardShelf playerId={props.player.id} cards={props.player.discardPile || []} hideLatest={projected.hideLatestDiscard} onInspect={props.onInspect}/>
  </OpponentZoneRoot>;
};

interface LocalZoneProps extends IdentityProps {
  hand:CardInstance[]; selectedCardId:string|null; interactionState:string; isMyTurn:boolean;
  onSelectCard:(card:CardInstance)=>void; onCancelSelection?:()=>void; onInspect?:()=>void; presentationAction?:PresentationAction;
}
export const LocalPlayerZone: React.FC<LocalZoneProps> = ({hand,selectedCardId,interactionState,isMyTurn,onSelectCard,onCancelSelection,onInspect,presentationAction,...identity}) => {
  const projected = projectedObjects(identity.player, presentationAction || null);
  const event:any = presentationAction?.event;
  const visualHand = (() => {
    if (event?.type === 'CARD_PLAYED' && event.actorId === identity.player.id && event.card) return [...hand, event.card];
    if (event?.type === 'CARD_DRAWN' && event.playerId === identity.player.id) return hand.slice(0, -1);
    if (event?.type === 'PRINCE_DISCARDED' && event.targetId === identity.player.id && event.discardedCard) return [event.discardedCard];
    return hand;
  })().slice(0, 2);
  return <LocalZoneRoot>
    <LocalIdentity><PlayerIdentity {...identity} isSelf/></LocalIdentity>
    <PublicDiscardShelf playerId={identity.player.id} cards={identity.player.discardPile || []} local hideLatest={projected.hideLatestDiscard} onInspect={onInspect}/>
    <LocalHand><PlayerHand playerId={identity.player.id} hand={visualHand} isMyTurn={isMyTurn} selectedCardId={selectedCardId} interactionState={interactionState} onSelectCard={onSelectCard} onValidDrop={onSelectCard} onCancelSelection={onCancelSelection}/></LocalHand>
  </LocalZoneRoot>;
};

const OpponentZoneRoot=styled.section`width:calc((100% - 10px)/3); min-width:0; display:grid; grid-template-rows:auto 30px 27px; gap:2px; @media(max-height:650px){grid-template-rows:auto 24px 22px;}`;
const LocalZoneRoot=styled.section`width:100%; min-width:0; max-width:100%; display:grid; grid-template-rows:auto auto auto; gap:3px; align-items:end; padding:0 6px; box-sizing:border-box;`;
const LocalIdentity=styled.div`width:100%;min-width:0;`;
const LocalHand=styled.div`width:100%;min-width:0;`;
const IdentityButton=styled.button<{$turn:boolean;$targetable:boolean;$selected:boolean;$eliminated:boolean;$self:boolean}>`width:100%; min-width:0; height:${p=>p.$targetable?'44px':p.$self?'36px':'31px'}; display:flex; flex-direction:row; align-items:center; justify-content:initial; gap:4px; padding:3px 6px; box-sizing:border-box; border-radius:8px; border:1px solid ${THEME.border}; background:rgba(255,253,247,.96); color:${THEME.foreground}; font:inherit; cursor:${p=>p.$targetable?'pointer':'default'}; ${p=>p.$turn&&css`border-color:${THEME.gold}; background:#fffdf3;`} ${p=>p.$targetable&&css`border:2px solid ${THEME.burgundy};`} ${p=>p.$selected&&css`background:#fff1f2;`} ${p=>p.$eliminated&&css`opacity:.5;filter:grayscale(1);`} @media(max-height:650px){height:${p=>p.$targetable?'44px':p.$self?'34px':'27px'};padding:2px 4px;}`;
const Avatar=styled.div<{$turn:boolean;$speaking:boolean}>`position:relative; width:23px; height:23px; flex:0 0 23px; display:grid; place-items:center; overflow:visible; border-radius:50%; background:${THEME.primary}; color:${THEME.goldLight}; font:900 11px ${THEME.font.serif}; border:1px solid ${p=>p.$turn?THEME.gold:THEME.border}; ${p=>p.$speaking&&css`box-shadow:0 0 0 2px ${THEME.emerald};`} img{width:100%;height:100%;border-radius:inherit;object-fit:cover;} @media(max-height:650px){width:20px;height:20px;flex-basis:20px;}`;
const Status=styled.span`position:absolute;right:-3px;bottom:-3px;width:13px;height:13px;display:grid;place-items:center;border-radius:50%;background:#fff;color:${THEME.burgundy};border:1px solid ${THEME.border};`;
const IdentityCopy=styled.span`min-width:0;flex:1;display:flex;flex-direction:column;`;
const Name=styled.strong`font-size:9.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;@media(max-width:360px){font-size:8px;letter-spacing:-.35px;}`;
const Meta=styled.span`display:flex;align-items:center;gap:2px;color:${THEME.burgundy};font-size:8px;font-weight:800;small{font-size:6.5px;color:${THEME.mutedForeground};border:1px solid ${THEME.border};border-radius:3px;padding:0 2px;}`;
const Turn=styled.span`font-size:7px;font-weight:900;color:${THEME.burgundy};`;
const HeldArea=styled.div<{$empty:boolean}>`position:relative; width:52px; height:29px; justify-self:center; opacity:${p=>p.$empty ? .45 : 1}; @media(max-height:650px){transform:scale(.8);transform-origin:top center;height:24px;}`;
const HeldCards=styled.span`height:100%;display:flex;align-items:flex-start;justify-content:center;gap:5px;`;
const HeldBack=styled.span<{$hidden?:boolean}>`display:block;width:19px;height:27px;border-radius:3px;background:${THEME.burgundyDeep};border:1px solid ${THEME.goldAntique};box-shadow:1px 2px 3px rgba(9,13,22,.18);visibility:${p=>p.$hidden?'hidden':'visible'};`;
const Count=styled.span`position:absolute;right:-5px;bottom:-2px;min-width:12px;height:12px;display:grid;place-items:center;border-radius:7px;background:${THEME.primary};color:#fff;font-size:7px;font-weight:900;`;
const Empty=styled.span`font-size:6px;color:${THEME.mutedForeground};white-space:nowrap;position:absolute;left:50%;top:8px;transform:translateX(-50%);`;
const Shelf=styled.button<{$local:boolean}>`position:relative;width:${p=>p.$local?'min(360px,100%)':'100%'};height:${p=>p.$local?'34px':'27px'};min-width:0;margin:0 auto;padding:0;border:0;background:transparent;color:${THEME.foreground};font:inherit;cursor:pointer;text-align:left;`;
const ShelfLabel=styled.span`position:absolute;left:0;top:0;font-size:9px;color:${THEME.mutedForeground};font-weight:750;`;
const Pile=styled.span<{$local:boolean}>`position:absolute;left:${p=>p.$local?'50%':'0'};bottom:0;width:${p=>p.$local?'150px':'100%'};height:${p=>p.$local?'31px':'23px'};transform:${p=>p.$local?'translateX(-50%)':'none'};`;
const DiscardCard=styled.span<{$index:number;$local:boolean}>`position:absolute;left:${p=>p.$index*(p.$local?27:15)}px;bottom:0;width:${p=>p.$local?'31px':'20px'};height:${p=>p.$local?'29px':'22px'};display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:3px;background:#fffdf7;border:1px solid ${THEME.gold};color:${THEME.primary};box-shadow:0 1px 3px rgba(9,13,22,.14);font:900 ${p=>p.$local?'10px':'8px'} ${THEME.font.serif};`;
const NoCards=styled.span`position:absolute;left:50%;bottom:5px;transform:translateX(-50%);font-size:9px;color:${THEME.mutedForeground};white-space:nowrap;`;
const More=styled.span`position:absolute;right:0;bottom:5px;font-size:9px;color:${THEME.mutedForeground};font-weight:900;`;
