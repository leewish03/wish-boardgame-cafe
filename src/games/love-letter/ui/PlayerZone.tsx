import React, { useContext } from 'react';
import styled, { css } from 'styled-components';
import { motion } from 'framer-motion';
import { CircleSlash, Heart, ShieldCheck } from 'lucide-react';
import { CardInstance, PlayerPublic } from '../../../../packages/love-letter-core/src/types';
import { THEME } from '../../../shared/theme';
import { CardArtwork } from './CardArtwork';
import { useTableAnchor } from '../presentation/TableAnchorRegistry';
import { PlayerHand } from './PlayerHand';
import { RoomChat } from '../../../shared/RoomChat';
import { useHiddenHand, PhysicalTableContext } from '../presentation/PhysicalTableContext';

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
  const step = useContext(PhysicalTableContext);
  const targeted = !!step && step.kind !== 'PLAY' && step.kind !== 'CLEANUP' && step.targetId === player.id;
  const anchor = useTableAnchor(player.id, 'identity');
  const imageAvatar = player.avatar && /^(https?:|\/)/.test(player.avatar);
  return <IdentityButton ref={anchor} as={motion.button} type="button" data-player-id={player.id} onClick={isTargetable ? onSelect : undefined}
    $turn={isCurrentTurn} $targetable={isTargetable} $selected={isSelectedTarget || targeted} $eliminated={player.isEliminated} $self={isSelf}
    aria-label={`${player.nickname}${isTargetable ? ' 선택 가능' : ''}`} aria-disabled={!isTargetable} whileTap={isTargetable ? {scale:.98} : undefined}>
    <Avatar $turn={isCurrentTurn} $speaking={isSpeaking}>{imageAvatar ? <img src={player.avatar} alt=""/> : player.nickname.slice(0,1)}{player.isProtected && <Status><ShieldCheck size={10}/></Status>}{player.isEliminated && <Status><CircleSlash size={10}/></Status>}</Avatar>
    <IdentityCopy><Name>{player.nickname}</Name><Meta><Heart size={9} fill="currentColor"/> {player.tokens}{isSelf && <small>나</small>}</Meta></IdentityCopy>
    {isCurrentTurn && <Turn>차례</Turn>}
  </IdentityButton>;
};

export const HeldCardBacks: React.FC<{playerId:string; count:number}> = ({ playerId, count }) => {
  const anchor = useTableAnchor(playerId, 'hand');
  const hidden = useHiddenHand(playerId);
  return <HeldArea ref={anchor} aria-label={`손패 ${count}장`} $empty={count===0}>
    <HeldCards>{[0, 1].map(index => <HeldSlot key={index} playerId={playerId} index={index} visible={index < Math.min(2,count) && !hidden.all && !(hidden.playing && index === count - 1)}/>)}</HeldCards>
    {count === 0 && <Empty>손패 없음</Empty>}
  </HeldArea>;
};

const HeldSlot: React.FC<{playerId:string;index:number;visible:boolean}> = ({playerId,index,visible}) => {
  const anchor = useTableAnchor(playerId, index === 0 ? 'hand-slot-0' : 'hand-slot-1');
  return <HeldBack ref={anchor} $hidden={!visible}><CardArtwork back/></HeldBack>;
};

export const PublicDiscardShelf: React.FC<{playerId:string; cards:CardInstance[]; local?:boolean; hideLatest?:boolean; onInspect?:()=>void}> = ({playerId,cards,local=false,hideLatest=false,onInspect}) => {
  const anchor = useTableAnchor(playerId, 'discard');
  const latestAnchor = useTableAnchor(playerId, 'discard-latest');
  const pileAnchor = React.useCallback((element: HTMLSpanElement | null) => {
    anchor(element);
    latestAnchor(element);
  }, [anchor, latestAnchor]);
  const settledCards = hideLatest ? cards.slice(0, -1) : cards;
  return <Shelf type="button" onClick={onInspect} $local={local} aria-label={`공개 버린 패 ${cards.length}장`}>
    <ShelfLabel>{local ? '내 공개 버린 패' : '공개 패'}</ShelfLabel>
    <Pile $local={local}>
      {settledCards.map((card,index)=><DiscardCard ref={index===settledCards.length-1 ? pileAnchor : undefined} key={card.id} $local={local}>{local ? <CardArtwork value={card.value} name={card.name}/> : <DiscardMiniFace><b>{card.value}</b><span>{card.name}</span></DiscardMiniFace>}</DiscardCard>)}
      {settledCards.length===0 && <><DiscardLanding ref={pileAnchor} $local={local}/><NoCards>아직 없음</NoCards></>}
    </Pile>
  </Shelf>;
};

interface OpponentZoneProps extends IdentityProps { onInspect?:()=>void; presentationAction?:PresentationAction; }
const PlayPlace: React.FC<{playerId:string; local?:boolean}> = ({playerId, local=false}) => {
  const anchor = useTableAnchor(playerId, 'play');
  const review = useTableAnchor(playerId, 'review');
  return <PlayDock $local={local} aria-label="행동 카드 공간"><PlaySpace ref={anchor} aria-label="사용 카드 위치"/><ReviewSpace ref={review} aria-label="확인 카드 위치"/></PlayDock>;
};
export const OpponentZone: React.FC<OpponentZoneProps> = ({presentationAction,...props}) => {
  const projected = projectedObjects(props.player, presentationAction || null);
  return <OpponentZoneRoot>
    <PlayerIdentity {...props}/><ObjectsRow><HeldCardBacks playerId={props.player.id} count={projected.handCount}/><PlayPlace playerId={props.player.id}/></ObjectsRow><PublicDiscardShelf playerId={props.player.id} cards={props.player.discardPile || []} hideLatest={projected.hideLatestDiscard} onInspect={props.onInspect}/>
  </OpponentZoneRoot>;
};

interface LocalZoneProps extends IdentityProps {
  hand:CardInstance[]; selectedCardId:string|null; interactionState:string; isMyTurn:boolean; canSelectCards:boolean;
  onSelectCard:(card:CardInstance)=>void; onCancelSelection?:()=>void; onInspect?:()=>void; presentationAction?:PresentationAction;
  chatMessages?:any[]; onSendChat?:(text:string)=>void; onChatOpenChange?:(open:boolean)=>void;
}
export const LocalPlayerZone: React.FC<LocalZoneProps> = ({hand,selectedCardId,interactionState,isMyTurn,canSelectCards,onSelectCard,onCancelSelection,onInspect,presentationAction,chatMessages,onSendChat,onChatOpenChange,...identity}) => {
  const projected = projectedObjects(identity.player, presentationAction || null);
  const event:any = presentationAction?.event;
  const visualHand = (() => {
    if (event?.type === 'CARD_PLAYED' && event.actorId === identity.player.id && event.card) return [...hand, event.card];
    if (event?.type === 'CARD_DRAWN' && event.playerId === identity.player.id) return hand.slice(0, -1);
    if (event?.type === 'PRINCE_DISCARDED' && event.targetId === identity.player.id && event.discardedCard) return [event.discardedCard];
    return hand;
  })().slice(0, 2);
  // A blank play dock is useful only while the local player can make a
  // decision. Leaving it visible during another player's turn turns a
  // one-card hand into an unexplained, off-centre layout.
  const showActionSlot = isMyTurn || interactionState !== 'IDLE' || identity.isTargetable;
  return <LocalZoneRoot>
    <LocalDiscard><PublicDiscardShelf playerId={identity.player.id} cards={identity.player.discardPile || []} local hideLatest={projected.hideLatestDiscard} onInspect={onInspect}/><ChatDock><RoomChat messages={chatMessages as never[]} onSend={onSendChat} mode="sheet" currentUserId={identity.player.id} onOpenChange={onChatOpenChange} launcherPlacement="inline"/></ChatDock></LocalDiscard>
    <LocalHand><PlayerHand playerId={identity.player.id} hand={visualHand} isMyTurn={isMyTurn} canSelectCards={canSelectCards} selectedCardId={selectedCardId} interactionState={interactionState} onSelectCard={onSelectCard} onValidDrop={onSelectCard} onCancelSelection={onCancelSelection} isEliminated={identity.player.isEliminated} actionSlot={showActionSlot ? (
      <SelfTarget
        as={motion.button}
        type="button"
        $targetable={identity.isTargetable}
        $selected={identity.isSelectedTarget}
        $eliminated={identity.player.isEliminated}
        onClick={identity.isTargetable ? identity.onSelect : undefined}
        aria-label={identity.isTargetable ? '나를 대상으로 선택' : '내 카드 행동 자리'}
        aria-disabled={!identity.isTargetable}
        tabIndex={identity.isTargetable ? 0 : -1}
        whileTap={identity.isTargetable ? {scale:.98} : undefined}
      >
        {identity.isTargetable && <SelfTargetLabel>{identity.isSelectedTarget ? '나 선택됨' : '나를 대상으로 선택'}</SelfTargetLabel>}
        {identity.player.isProtected && <SelfState><ShieldCheck size={11}/> 보호 중</SelfState>}
        <PlayPlace playerId={identity.player.id} local/>
      </SelfTarget>
    ) : undefined}/></LocalHand>
  </LocalZoneRoot>;
};

const ObjectsRow=styled.div`display:flex;align-items:center;justify-content:center;gap:8px;min-height:0;gap:4px;`;
const PlayDock=styled.div<{$local?:boolean}>`
  position:relative;width:${p=>p.$local?'100%':'44px'};height:${p=>p.$local?'100%':'63px'};justify-self:center;
  padding:0;box-sizing:border-box;border:1px dashed rgba(184,161,107,.42);border-radius:${p=>p.$local?'10px':'7px'};
  background:rgba(255,255,255,.14);
`;
const ReviewSpace=styled.div`position:absolute;inset:0;box-sizing:border-box;`;
const PlaySpace=styled.div`position:absolute;inset:0;box-sizing:border-box;`;
const OpponentZoneRoot=styled.section`width:100%; min-width:0; display:grid; grid-template-rows:44px 67px auto; gap:3px; @media(max-height:650px){grid-template-rows:44px 58px auto;}`;
const LocalZoneRoot=styled.section`width:100%;min-width:0;max-width:100%;display:grid;grid-template-rows:auto auto;gap:3px;align-items:end;padding:0 8px;box-sizing:border-box;`;
const LocalDiscard=styled.div`position:relative;width:100%;min-width:0;`;
const ChatDock=styled.div`position:absolute;right:0;top:-4px;z-index:2;`;
const SelfTarget=styled.button<{$targetable:boolean;$selected:boolean;$eliminated:boolean}>`
  position:relative;width:100%;height:100%;min-width:0;margin:0;padding:0;border:1px solid transparent;border-radius:10px;background:transparent;color:${THEME.foreground};font:inherit;
  cursor:${p=>p.$targetable?'pointer':'default'};
  ${p=>p.$targetable&&css`border-color:${THEME.burgundy};background:rgba(255,241,242,.72);`}
  ${p=>p.$selected&&css`border-width:2px;background:#fff1f2;`}
  ${p=>p.$eliminated&&css`opacity:.48;filter:grayscale(1);`}
`;
const SelfTargetLabel=styled.span`position:absolute;left:50%;top:-14px;transform:translateX(-50%);white-space:nowrap;color:${THEME.burgundy};font-size:9px;font-weight:900;`;
const SelfState=styled.span`position:absolute;left:50%;bottom:4px;transform:translateX(-50%);display:flex;align-items:center;gap:3px;white-space:nowrap;color:${THEME.burgundy};font-size:9px;font-weight:900;z-index:1;`;
const LocalHand=styled.div`width:100%;min-width:0;`;
const IdentityButton=styled.button<{$turn:boolean;$targetable:boolean;$selected:boolean;$eliminated:boolean;$self:boolean}>`width:100%; min-width:0; height:44px; display:flex; flex-direction:row; align-items:center; justify-content:initial; gap:4px; padding:3px 6px; box-sizing:border-box; border-radius:8px; border:1px solid ${THEME.border}; background:rgba(255,253,247,.96); color:${THEME.foreground}; font:inherit; cursor:${p=>p.$targetable?'pointer':'default'}; ${p=>p.$turn&&css`border-color:${THEME.gold}; background:#fffdf3;`} ${p=>p.$targetable&&css`border:2px solid ${THEME.burgundy};`} ${p=>p.$selected&&css`background:#fff1f2;`} ${p=>p.$eliminated&&css`opacity:.5;filter:grayscale(1);`} @media(max-height:650px){height:44px;padding:2px 4px;}`;
const Avatar=styled.div<{$turn:boolean;$speaking:boolean}>`position:relative; width:23px; height:23px; flex:0 0 23px; display:grid; place-items:center; overflow:visible; border-radius:50%; background:${THEME.primary}; color:${THEME.goldLight}; font:900 11px ${THEME.font.serif}; border:1px solid ${p=>p.$turn?THEME.gold:THEME.border}; ${p=>p.$speaking&&css`box-shadow:0 0 0 2px ${THEME.emerald};`} img{width:100%;height:100%;border-radius:inherit;object-fit:cover;} @media(max-height:650px){width:20px;height:20px;flex-basis:20px;}`;
const Status=styled.span`position:absolute;right:-3px;bottom:-3px;width:13px;height:13px;display:grid;place-items:center;border-radius:50%;background:#fff;color:${THEME.burgundy};border:1px solid ${THEME.border};`;
const IdentityCopy=styled.span`min-width:0;flex:1;display:flex;flex-direction:column;`;
const Name=styled.strong`font-size:9.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;@media(max-width:360px){font-size:8px;letter-spacing:-.35px;}`;
const Meta=styled.span`display:flex;align-items:center;gap:2px;color:${THEME.burgundy};font-size:8px;font-weight:800;small{font-size:6.5px;color:${THEME.mutedForeground};border:1px solid ${THEME.border};border-radius:3px;padding:0 2px;}`;
const Turn=styled.span`font-size:7px;font-weight:900;color:${THEME.burgundy};`;
const HeldArea=styled.div<{$empty:boolean}>`position:relative; width:64px; height:45px; justify-self:center; opacity:${p=>p.$empty ? .45 : 1}; @media(max-height:650px){transform:scale(.82);transform-origin:top center;height:37px;}`;
const HeldCards=styled.span`height:100%;display:flex;align-items:flex-start;justify-content:center;gap:2px;`;
const HeldBack=styled.span<{$hidden?:boolean}>`display:block;width:29px;height:41px;flex-shrink:0;box-shadow:1px 2px 3px rgba(9,13,22,.18);visibility:${p=>p.$hidden?'hidden':'visible'};`;
const Count=styled.span`position:absolute;right:-5px;bottom:-2px;min-width:12px;height:12px;display:grid;place-items:center;border-radius:7px;background:${THEME.primary};color:#fff;font-size:7px;font-weight:900;`;
const Empty=styled.span`font-size:6px;color:${THEME.mutedForeground};white-space:nowrap;position:absolute;left:50%;top:8px;transform:translateX(-50%);`;
const Shelf=styled.button<{$local:boolean}>`
  position:relative;width:100%;min-height:${p=>p.$local?'103px':'72px'};min-width:0;margin:0 auto;padding:15px 0 0;border:0;
  background:transparent;color:${THEME.foreground};font:inherit;cursor:pointer;text-align:left;box-sizing:border-box;overflow:visible;
`;
const ShelfLabel=styled.span`position:absolute;left:0;top:0;font-size:9px;color:${THEME.mutedForeground};font-weight:750;`;
const Pile=styled.span<{$local:boolean}>`
  position:relative;width:100%;min-height:${p=>p.$local?'77px':'52px'};display:grid;
  grid-template-columns:repeat(${p=>p.$local?3:3},${p=>p.$local?'54px':'36px'});grid-auto-rows:${p=>p.$local?'77px':'52px'};
  align-content:end;align-items:end;gap:${p=>p.$local?'4px':'2px'};overflow:visible;
  @media(max-width:420px){grid-template-columns:repeat(3,${p=>p.$local?'50px':'36px'});grid-auto-rows:${p=>p.$local?'71px':'52px'};min-height:${p=>p.$local?'71px':'52px'};}
`;
const DiscardCard=styled.span<{$local:boolean}>`
  width:${p=>p.$local?'54px':'36px'};height:${p=>p.$local?'77px':'52px'};display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:4px;color:${THEME.primary};box-shadow:0 1px 3px rgba(9,13,22,.14);background:${p=>p.$local?'transparent':'#fffdf6'};border:${p=>p.$local?'0':'1px solid rgba(184,161,107,.58)'};
  @media(max-width:420px){width:${p=>p.$local?'50px':'36px'};height:${p=>p.$local?'71px':'52px'};}
`;
const DiscardMiniFace=styled.span`width:100%;height:100%;padding:3px 2px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:${THEME.primary};line-height:1;text-align:center;b{align-self:flex-start;font:900 10px ${THEME.font.serif};}span{font-size:7px;font-weight:900;word-break:keep-all;}`;
const DiscardLanding=styled.span<{$local:boolean}>`
  width:${p=>p.$local?'54px':'36px'};height:${p=>p.$local?'77px':'52px'};pointer-events:none;visibility:hidden;
  @media(max-width:420px){width:${p=>p.$local?'50px':'36px'};height:${p=>p.$local?'71px':'52px'};}
`;
const NoCards=styled.span`position:absolute;left:50%;bottom:5px;transform:translateX(-50%);font-size:9px;color:${THEME.mutedForeground};white-space:nowrap;`;
