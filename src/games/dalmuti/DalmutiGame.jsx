import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled, { css } from 'styled-components';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Crown, LogOut, Menu, Mic, Timer, Trophy, Users, Volume2 } from 'lucide-react';
import { THEME } from '../../shared/theme';
import { RoomChat } from '../../shared/RoomChat';
import { RoomVoiceControls } from '../love-letter/ui/GameMenuDrawer';
import { DALMUTI_RANKS } from '../../../packages/dalmuti-core/src/index.js';

const rankName = (rank) => DALMUTI_RANKS[rank] || `계급 ${rank}`;
const groupCards = (cards = []) => {
  const groups = new Map();
  cards.forEach((card) => groups.set(card.rank, { rank: card.rank, count: (groups.get(card.rank)?.count || 0) + 1 }));
  return [...groups.values()].sort((a, b) => a.rank - b.rank);
};

export default function DalmutiGame({ roomState, currentUser, socket, webrtc, stt, chatMessages = [], onSendChat, onLeave }) {
  const game = roomState?.dalmuti;
  const myId = currentUser?.id;
  const reduceMotion = useReducedMotion();
  const [selection, setSelection] = useState(null);
  const [taxSelection, setTaxSelection] = useState({});
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [eventBeat, setEventBeat] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!socket) return undefined;
    const timers = new Set();
    const onEvent = (envelope) => {
      setEventBeat(envelope?.event || null);
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setEventBeat((current) => current?.id === envelope?.event?.id ? null : current);
        socket.emit('dalmuti:presentation-ack', { roomCode: roomState?.code, eventId: envelope?.eventId });
      }, reduceMotion ? 180 : 520);
      timers.add(timer);
    };
    socket.on('dalmuti:event', onEvent);
    socket.emit('dalmuti:view-ready', { roomCode: roomState?.code });
    return () => { socket.off('dalmuti:event', onEvent); timers.forEach((timer) => window.clearTimeout(timer)); };
  }, [socket, roomState?.code, reduceMotion]);

  useEffect(() => {
    const update = () => setSecondsLeft(game?.turnExpiresAt ? Math.max(0, Math.ceil((game.turnExpiresAt - Date.now()) / 1000)) : null);
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [game?.turnExpiresAt]);

  useEffect(() => { setSelection(null); setTaxSelection({}); setError(''); }, [game?.stateVersion]);

  const playersById = useMemo(() => new Map((game?.players || []).map((player) => [player.id, player])), [game?.players]);
  const me = playersById.get(myId);
  const opponents = (game?.hierarchy || []).filter((id) => id !== myId).map((id) => playersById.get(id)).filter(Boolean);
  const handGroups = groupCards(roomState?.mySecret?.hand || []);
  const legalPlays = roomState?.mySecret?.legalPlays || [];
  const isMyTurn = game?.currentTurnPlayerId === myId && !roomState?.isPaused && !roomState?.presentationPending;
  const canPass = isMyTurn && game?.playPhase === 'TURN_INPUT' && game?.trick?.requiredCount != null;
  const currentPlayer = playersById.get(game?.currentTurnPlayerId);
  const currentTaxPair = game?.tax?.pairs?.find((pair) => pair.dalmutiId === myId);
  const taxNeeded = currentTaxPair?.count || 0;
  const selectedTaxCount = Object.values(taxSelection).reduce((sum, value) => sum + value, 0);

  const send = useCallback((command) => {
    if (!socket) return;
    setError('');
    socket.emit('dalmuti:command', { roomCode: roomState.code, command: { ...command, expectedStateVersion: game.stateVersion } }, (result) => {
      if (!result?.success) setError(result?.error || '행동을 처리하지 못했습니다.');
    });
  }, [socket, roomState?.code, game?.stateVersion]);

  const chooseRank = (rank) => {
    if (!isMyTurn || game.playPhase !== 'TURN_INPUT') return;
    const candidates = legalPlays.filter((play) => play.rank === rank);
    if (!candidates.length) return;
    const required = game.trick.requiredCount;
    const chosen = [...candidates].sort((a, b) => {
      if (required == null && a.count !== b.count) return a.count - b.count;
      return a.jesterCount - b.jesterCount;
    })[0];
    setSelection(chosen);
  };

  const countOptions = selection ? [...new Set(legalPlays.filter((play) => play.rank === selection.rank).map((play) => play.count))] : [];
  const compositionOptions = selection ? legalPlays.filter((play) => play.rank === selection.rank && play.count === selection.count) : [];

  const toggleTaxRank = (rank, available) => {
    if (!currentTaxPair || game.currentTurnPlayerId !== myId) return;
    setTaxSelection((previous) => {
      const next = { ...previous };
      const current = next[rank] || 0;
      if (selectedTaxCount >= taxNeeded && current === 0) return previous;
      next[rank] = current >= available ? 0 : current + 1;
      return next;
    });
  };

  if (!game || !me) return null;

  const phaseMessage = (() => {
    if (roomState.isPaused) return '플레이어 재접속을 기다리는 중';
    if (game.playPhase === 'REVOLUTION_DECISION') return `${currentPlayer?.nickname || '플레이어'}의 혁명 결정`;
    if (game.playPhase === 'TAX_RETURN') return `${currentPlayer?.nickname || '달무티'}가 세금 반환 카드를 고르는 중`;
    if (game.playPhase === 'MERCHANT_EXCHANGE') return `${currentPlayer?.nickname || '상인'}의 상인 교환`;
    if (game.matchState === 'ROUND_END') return `${game.roundNumber}라운드 신분 재편`;
    if (game.matchState === 'GAME_OVER') return '최종 계급전 종료';
    if (isMyTurn) return game.trick.requiredCount == null ? '내가 새로운 트릭을 이끕니다' : `${game.trick.requiredCount}장 · ${game.trick.topRank}보다 강한 계급`;
    return `${currentPlayer?.nickname || '상대'}의 차례`;
  })();

  return <Surface>
    <Hud>
      <Brand><Crown size={16}/> THE GREAT DALMUTI <small>{game.roundNumber}/{game.config.roundCount}</small></Brand>
      <Phase aria-live="polite">{phaseMessage}</Phase>
      <HudActions>{secondsLeft != null && <Clock $urgent={secondsLeft <= 5}><Timer size={13}/>{secondsLeft}</Clock>}<IconButton onClick={() => setMenuOpen(true)} aria-label="게임 메뉴"><Menu size={17}/></IconButton></HudActions>
    </Hud>

    <Table>
      <OpponentBoard data-count={opponents.length}>
        {opponents.map((player) => <PlayerTile key={player.id} as={motion.article} layout $turn={player.id === game.currentTurnPlayerId} $finished={!!player.finishedPosition}>
          <RankMedal>{player.roleIndex + 1}</RankMedal>
          <Avatar src={player.avatarUrl} alt=""/>
          <Identity><strong>{player.nickname}</strong><span>{player.role}</span></Identity>
          <Stats><b>{player.handCount}</b><small>패</small><i>{player.score}점</i></Stats>
          {player.id === game.currentTurnPlayerId && <TurnFlag>차례</TurnFlag>}
          {player.passed && <PassFlag>PASS</PassFlag>}
          {player.finishedPosition && <FinishFlag>{player.finishedPosition}위 확정</FinishFlag>}
        </PlayerTile>)}
      </OpponentBoard>

      <CenterStage>
        <TrickMeta>
          <span>공용 트릭</span>
          <b>{game.trick.requiredCount ? `${game.trick.requiredCount}장 · ${game.trick.topRank} ${rankName(game.trick.topRank)}` : '새로운 선'}</b>
          <small>연속 패스 {game.trick.passPlayerIds.length} · 완료 트릭 {game.trick.completedCount}</small>
        </TrickMeta>
        <Pile aria-label="현재 중앙 카드 더미">
          {game.trick.sets.slice(-4).map((set, index, visible) => <SetLayer key={set.id} as={motion.div} initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: set.actorId === myId ? 90 : -75, scale: .86 }} animate={{ opacity: 1, y: 0, scale: 1, rotate: (index - visible.length + 1) * 1.4 }} transition={{ duration: reduceMotion ? .12 : .36 }} $offset={index}>
            {Array.from({ length: Math.min(set.count, 6) }, (_, cardIndex) => <MiniCard key={cardIndex} $jester={cardIndex >= set.count - set.jesterCount} style={{ marginLeft: cardIndex ? '-34px' : 0 }}><b>{cardIndex >= set.count - set.jesterCount ? 'J' : set.rank}</b><span>{cardIndex >= set.count - set.jesterCount ? '어릿광대' : rankName(set.rank)}</span></MiniCard>)}
          </SetLayer>)}
          {!game.trick.sets.length && <EmptyPile><Crown size={22}/><span>선 플레이를 기다립니다</span></EmptyPile>}
          <AnimatePresence>{eventBeat?.type === 'PASSED' && <Beat key={eventBeat.id} as={motion.div} initial={{ opacity: 0, scale: .85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>PASS</Beat>}</AnimatePresence>
        </Pile>
        <ActionError>{error}</ActionError>
      </CenterStage>

      <LocalArea>
        <SelfBar $turn={isMyTurn}><Avatar src={me.avatarUrl} alt=""/><Identity><strong>{me.nickname} <small>나</small></strong><span>{me.roleIndex + 1}위 · {me.role} · {me.score}점</span></Identity><Stats><b>{me.handCount}</b><small>패</small></Stats><RoomChat messages={chatMessages} onSend={onSendChat} mode="sheet" currentUserId={myId} launcherPlacement="inline"/></SelfBar>

        {game.playPhase === 'REVOLUTION_DECISION' && game.revolutionCandidateId === myId ? <DecisionTray><strong>어릿광대 둘이 모였습니다</strong><span>{me.role === '대농노' ? '대혁명은 계급을 완전히 뒤집습니다.' : '혁명을 선언하면 이번 라운드의 세금이 사라집니다.'}</span><ButtonRow><Secondary onClick={() => send({ type:'DECLINE_REVOLUTION' })}>그대로 진행</Secondary><Primary onClick={() => send({ type:'DECLARE_REVOLUTION' })}>혁명 선언</Primary></ButtonRow></DecisionTray>
        : game.playPhase === 'TAX_RETURN' && currentTaxPair && game.currentTurnPlayerId === myId ? <DecisionTray><strong>{taxNeeded}장을 농노에게 돌려주세요</strong><span>받을 세금은 최종 교환과 함께 손패에 들어옵니다.</span><TaxGroups>{handGroups.map((group) => <TaxChip key={group.rank} onClick={() => toggleTaxRank(group.rank, group.count)} $selected={taxSelection[group.rank] > 0}><b>{group.rank}</b><span>{rankName(group.rank)}</span><i>{taxSelection[group.rank] || 0}/{group.count}</i></TaxChip>)}</TaxGroups><Primary disabled={selectedTaxCount !== taxNeeded} onClick={() => send({ type:'SELECT_TAX_RETURN', selection:Object.entries(taxSelection).filter(([,count]) => count).map(([rank,count]) => ({ rank:Number(rank), count })) })}>{selectedTaxCount}/{taxNeeded}장 반환</Primary></DecisionTray>
        : game.playPhase === 'MERCHANT_EXCHANGE' && game.merchantExchange?.actorId === myId ? <DecisionTray><strong>무작위로 교환할 상인을 고르세요</strong><TargetRow>{game.merchantExchange.eligibleTargetIds.map((id) => <Secondary key={id} onClick={() => send({ type:'SELECT_MERCHANT_EXCHANGE_TARGET', targetId:id })}>{playersById.get(id)?.nickname}</Secondary>)}</TargetRow></DecisionTray>
        : <>
          <HandRail aria-label="내 손패">
            {handGroups.map((group) => {
              const legal = legalPlays.some((play) => play.rank === group.rank);
              const selected = selection?.rank === group.rank;
              return <RankStack key={group.rank} as={motion.button} type="button" onClick={() => chooseRank(group.rank)} disabled={!legal || !isMyTurn} $legal={legal && isMyTurn} $selected={selected} whileTap={legal ? { y:-2 } : undefined}>
                <CardNumber>{group.rank === 13 ? 'J' : group.rank}</CardNumber><CardName>{rankName(group.rank)}</CardName><CountBadge>× {group.count}</CountBadge>
              </RankStack>;
            })}
          </HandRail>
          <PlayTray>
            <SelectionText>{selection ? <><b>{selection.count}× {selection.rank === 13 ? 'J' : selection.rank}</b><span>{selection.jesterCount ? `어릿광대 ${selection.jesterCount}장 포함` : '일반 카드 구성'}</span></> : <span>{isMyTurn ? '낼 계급 묶음을 선택하세요' : '상대의 행동을 기다리는 중'}</span>}</SelectionText>
            {selection && countOptions.length > 1 && <OptionRow>{countOptions.map((count) => <Option key={count} $active={selection.count === count} onClick={() => setSelection(legalPlays.find((play) => play.rank === selection.rank && play.count === count))}>{count}장</Option>)}</OptionRow>}
            {selection && compositionOptions.length > 1 && <OptionRow>{compositionOptions.map((play) => <Option key={play.jesterCount} $active={selection.jesterCount === play.jesterCount} onClick={() => setSelection(play)}>{play.jesterCount ? `J ${play.jesterCount}` : 'J 없음'}</Option>)}</OptionRow>}
            <ButtonRow><Secondary disabled={!canPass} onClick={() => send({ type:'PASS' })}>패스</Secondary><Primary disabled={!selection || !isMyTurn} onClick={() => send({ type:'PLAY_SET', ...selection })}>중앙에 내기</Primary></ButtonRow>
          </PlayTray>
        </>}
      </LocalArea>
    </Table>

    <AnimatePresence>{(game.matchState === 'ROUND_END' || game.matchState === 'GAME_OVER') && <Overlay as={motion.div} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><ResultCard as={motion.section} initial={reduceMotion ? {opacity:0}:{opacity:0,y:24}} animate={{opacity:1,y:0}}><Trophy size={28}/><h2>{game.matchState === 'GAME_OVER' ? '최종 계급전 결과' : `${game.roundNumber}라운드 결과`}</h2><ResultList>{game.outcome.finishOrder.map((id,index) => { const player=playersById.get(id); return <div key={id}><b>{index+1}</b><span>{player?.nickname}</span><em>{player?.score}점</em></div>; })}</ResultList>{game.matchState === 'ROUND_END' ? <><p>8초 후 새 신분으로 자리를 바꿉니다.</p>{roomState.hostId === myId && <Primary onClick={() => send({type:'ADVANCE_ROUND'})}>바로 다음 라운드</Primary>}</> : <p>{game.outcome.winnerIds.map((id)=>playersById.get(id)?.nickname).join(', ')}{game.outcome.winnerIds.length > 1 ? ' 공동 우승' : ' 최종 우승'}</p>}</ResultCard></Overlay>}</AnimatePresence>
    <AnimatePresence>{menuOpen && <DrawerShade as={motion.div} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setMenuOpen(false)}><Drawer as={motion.aside} initial={{x:320}} animate={{x:0}} exit={{x:320}} onClick={(event)=>event.stopPropagation()}><h3>달무티 살롱</h3><RoomVoiceControls voice={webrtc} compact/><InfoLine><Users size={14}/>{game.players.length}명 · {game.config.roundCount}라운드</InfoLine><InfoLine><Mic size={14}/>{stt?.isSTTActive ? '자막 사용 중' : '음성 채팅'}</InfoLine><InfoLine><Volume2 size={14}/>턴 제한 {game.config.turnTimeoutSeconds || '없음'}</InfoLine><Danger onClick={() => onLeave?.()}><LogOut size={15}/>게임 나가기</Danger></Drawer></DrawerShade>}</AnimatePresence>
    {roomState.isPaused && <PauseLayer><strong>게임 일시정지</strong><span>연결이 돌아오지 않으면 AI가 자리를 이어받습니다.</span></PauseLayer>}
  </Surface>;
}

const Surface=styled.div`width:100%;height:100dvh;overflow:hidden;background:${THEME.gradients.marbleTextureUrl},radial-gradient(circle at 50% 42%,#fff 0%,#eef1f4 74%,#dfe4e8 100%);background-size:cover;color:${THEME.foreground};display:flex;flex-direction:column;position:relative;`;
const Hud=styled.header`width:100%;min-width:0;box-sizing:border-box;height:42px;flex:0 0 42px;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;padding:0 10px;border-bottom:1px solid ${THEME.border};background:rgba(255,255,255,.92);box-shadow:0 2px 10px rgba(9,13,22,.06);z-index:30;`;
const Brand=styled.div`min-width:0;display:flex;align-items:center;gap:6px;font:900 11px ${THEME.font.serif};letter-spacing:.09em;color:${THEME.burgundy};small{font:800 9px ${THEME.font.sans};color:${THEME.mutedForeground};}@media(max-width:560px){font-size:9px;letter-spacing:.04em;line-height:1.05;small{white-space:nowrap;}}`;
const Phase=styled.div`font-size:11px;font-weight:850;text-align:center;white-space:nowrap;@media(max-width:560px){display:none;}`;
const HudActions=styled.div`display:flex;justify-content:flex-end;align-items:center;gap:6px;`;
const Clock=styled.span`display:flex;align-items:center;gap:3px;font-size:10px;font-weight:900;color:${p=>p.$urgent?THEME.rose:THEME.mutedForeground};`;
const IconButton=styled.button`width:30px;height:30px;display:grid;place-items:center;border:1px solid ${THEME.border};border-radius:7px;background:#fff;color:${THEME.foreground};cursor:pointer;`;
const Table=styled.main`width:100%;min-width:0;flex:1;min-height:0;display:grid;grid-template-rows:minmax(92px,28%) minmax(150px,1fr) minmax(190px,36%);overflow:hidden;`;
const OpponentBoard=styled.section`width:min(900px,100%);margin:0 auto;padding:6px 8px 2px;box-sizing:border-box;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;align-content:start;&[data-count="1"]{grid-template-columns:minmax(0,260px);justify-content:center;}&[data-count="2"],&[data-count="4"]{grid-template-columns:repeat(2,minmax(0,1fr));}&[data-count="3"],&[data-count="5"],&[data-count="6"]{grid-template-columns:repeat(3,minmax(0,1fr));}@media(max-width:560px){grid-template-columns:repeat(3,minmax(0,1fr))!important;padding-inline:4px;gap:3px;}`;
const PlayerTile=styled.article`min-width:0;height:54px;display:flex;align-items:center;gap:5px;padding:5px 7px;box-sizing:border-box;position:relative;border:1px solid ${p=>p.$turn?THEME.gold:THEME.border};border-radius:8px;background:${p=>p.$turn?'#fffdf2':'rgba(255,255,255,.92)'};box-shadow:${p=>p.$turn?'0 5px 16px rgba(197,160,89,.24)':'0 2px 7px rgba(9,13,22,.06)'};opacity:${p=>p.$finished?.62:1};@media(max-width:560px){height:50px;padding:4px;gap:3px;}`;
const RankMedal=styled.b`width:18px;height:18px;display:grid;place-items:center;border-radius:50%;background:${THEME.primary};color:${THEME.goldLight};font:900 9px ${THEME.font.serif};flex:0 0 18px;`;
const Avatar=styled.img`width:27px;height:27px;border-radius:50%;object-fit:cover;border:1px solid ${THEME.gold};flex:0 0 27px;@media(max-width:420px){display:none;}`;
const Identity=styled.div`min-width:0;display:flex;flex-direction:column;flex:1;strong{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}strong small{font-size:7px;color:${THEME.goldAntique};}span{font-size:8px;color:${THEME.burgundy};font-weight:800;}`;
const Stats=styled.div`display:grid;grid-template-columns:auto auto;align-items:end;b{font:900 15px ${THEME.font.serif};line-height:1;}small{font-size:7px;color:${THEME.mutedForeground};}i{grid-column:1/-1;font-size:7px;font-style:normal;color:${THEME.goldAntique};font-weight:900;}`;
const badge=css`position:absolute;top:-5px;border-radius:8px;padding:1px 5px;font-size:7px;font-weight:950;letter-spacing:.04em;`;
const TurnFlag=styled.span`${badge};right:5px;background:${THEME.gold};color:#111;`;
const PassFlag=styled.span`${badge};left:26px;background:${THEME.primary};color:#fff;`;
const FinishFlag=styled.span`${badge};left:50%;transform:translateX(-50%);background:${THEME.emerald};color:#fff;`;
const CenterStage=styled.section`width:100%;min-width:0;min-height:0;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:4px 8px;`;
const TrickMeta=styled.div`display:flex;align-items:center;gap:9px;font-size:9px;color:${THEME.mutedForeground};b{font:900 11px ${THEME.font.serif};color:${THEME.foreground};}small{font-size:8px;}@media(max-width:420px){small{display:none;}}`;
const Pile=styled.div`width:min(420px,calc(100% - 12px));max-width:100%;height:112px;box-sizing:border-box;position:relative;border:1px dashed rgba(197,160,89,.55);border-radius:14px;background:rgba(255,255,255,.28);display:grid;place-items:center;`;
const SetLayer=styled.div`position:absolute;inset:9px;display:flex;align-items:center;justify-content:center;transform-origin:center;`;
const MiniCard=styled.div`width:60px;height:88px;flex:0 0 60px;border:1px solid ${p=>p.$jester?THEME.burgundy:THEME.gold};border-radius:7px;background:${p=>p.$jester?THEME.gradients.burgundySeal:'#fffdf7'};color:${p=>p.$jester?'#fff':THEME.foreground};box-shadow:0 5px 13px rgba(9,13,22,.18);display:flex;flex-direction:column;align-items:center;justify-content:center;b{font:900 25px ${THEME.font.serif};}span{font-size:7px;font-weight:800;}`;
const EmptyPile=styled.div`display:flex;flex-direction:column;align-items:center;gap:4px;color:${THEME.goldAntique};font-size:9px;`;
const Beat=styled.div`position:absolute;padding:5px 13px;border-radius:12px;background:${THEME.primary};color:#fff;font:900 11px ${THEME.font.serif};z-index:10;`;
const ActionError=styled.div`height:13px;color:${THEME.rose};font-size:9px;font-weight:800;`;
const LocalArea=styled.section`width:100%;min-width:0;min-height:0;overflow:hidden;box-sizing:border-box;border-top:1px solid rgba(197,160,89,.42);background:rgba(255,255,255,.76);display:flex;flex-direction:column;padding:4px 8px 8px;gap:5px;box-shadow:0 -6px 20px rgba(9,13,22,.05);`;
const SelfBar=styled.div`height:36px;display:flex;align-items:center;gap:6px;width:min(760px,100%);margin:0 auto;padding:2px 7px;box-sizing:border-box;border-bottom:2px solid ${p=>p.$turn?THEME.gold:'transparent'};${Avatar}{width:25px;height:25px;display:block;flex-basis:25px;}`;
const HandRail=styled.div`height:92px;min-width:0;min-height:0;display:flex;align-items:flex-end;gap:5px;overflow-x:auto;overflow-y:hidden;width:min(900px,100%);max-width:100%;margin:0 auto;padding:3px 2px;box-sizing:border-box;scrollbar-width:thin;`;
const RankStack=styled.button`width:66px;height:87px;flex:0 0 66px;border:1px solid ${p=>p.$selected?THEME.burgundy:p.$legal?THEME.gold:THEME.border};border-width:${p=>p.$selected?2:1}px;border-radius:8px;background:${p=>p.$selected?'#fff5f5':'#fffdf9'};box-shadow:${p=>p.$selected?'0 8px 18px rgba(99,19,38,.18)':'0 3px 9px rgba(9,13,22,.09)'};color:${THEME.foreground};display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:${p=>p.$legal?'pointer':'not-allowed'};opacity:${p=>p.disabled?.45:1};transform:${p=>p.$selected?'translateY(-3px)':'none'};`;
const CardNumber=styled.b`font:900 25px ${THEME.font.serif};line-height:1;`;
const CardName=styled.span`font-size:8px;font-weight:850;color:${THEME.burgundy};margin-top:3px;`;
const CountBadge=styled.i`font-size:9px;font-style:normal;font-weight:900;color:${THEME.goldAntique};margin-top:5px;`;
const PlayTray=styled.div`width:min(760px,100%);max-width:100%;min-width:0;box-sizing:border-box;margin:0 auto;display:grid;grid-template-columns:minmax(120px,1fr) auto auto;align-items:center;gap:6px;min-height:43px;@media(max-width:560px){grid-template-columns:minmax(0,1fr) auto;.options{display:none;}}`;
const SelectionText=styled.div`min-width:0;display:flex;flex-direction:column;b{font:900 12px ${THEME.font.serif};}span{font-size:9px;color:${THEME.mutedForeground};}`;
const OptionRow=styled.div.attrs({className:'options'})`display:flex;gap:3px;`;
const Option=styled.button`height:26px;border:1px solid ${p=>p.$active?THEME.burgundy:THEME.border};border-radius:6px;background:${p=>p.$active?'#fff1f2':'#fff'};color:${THEME.foreground};font-size:8px;font-weight:850;cursor:pointer;`;
const ButtonRow=styled.div`display:flex;gap:5px;`;
const Secondary=styled.button`height:36px;padding:0 12px;border:1px solid ${THEME.border};border-radius:8px;background:#fff;color:${THEME.foreground};font-size:10px;font-weight:850;cursor:pointer;&:disabled{opacity:.4;cursor:not-allowed;}`;
const Primary=styled.button`height:36px;padding:0 16px;border:1px solid ${THEME.goldAntique};border-radius:8px;background:${THEME.gradients.obsidianButton};color:#fff;font:900 10px ${THEME.font.serif};cursor:pointer;&:disabled{opacity:.4;cursor:not-allowed;}`;
const DecisionTray=styled.div`width:min(680px,100%);margin:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;text-align:center;strong{font:900 15px ${THEME.font.serif};}span{font-size:9px;color:${THEME.mutedForeground};}`;
const TaxGroups=styled.div`display:flex;gap:4px;max-width:100%;overflow-x:auto;`;
const TaxChip=styled.button`width:56px;height:58px;flex:0 0 56px;border:1px solid ${p=>p.$selected?THEME.burgundy:THEME.border};border-radius:7px;background:${p=>p.$selected?'#fff1f2':'#fff'};display:flex;flex-direction:column;align-items:center;justify-content:center;b{font:900 17px ${THEME.font.serif};}span{font-size:7px;}i{font-size:8px;font-style:normal;font-weight:900;color:${THEME.burgundy};}`;
const TargetRow=styled.div`display:flex;gap:5px;flex-wrap:wrap;justify-content:center;`;
const Overlay=styled.div`position:absolute;inset:42px 0 0;z-index:40;background:rgba(9,13,22,.58);display:grid;place-items:center;padding:15px;`;
const ResultCard=styled.section`width:min(430px,100%);max-height:90%;overflow:auto;padding:20px;box-sizing:border-box;border:1px solid ${THEME.gold};border-radius:14px;background:${THEME.gradients.marbleTextureUrl},#fff;background-size:cover;text-align:center;box-shadow:0 24px 60px rgba(9,13,22,.28);h2{margin:6px 0 12px;font:900 21px ${THEME.font.serif};}p{font-size:10px;color:${THEME.mutedForeground};}`;
const ResultList=styled.div`display:flex;flex-direction:column;gap:4px;margin-bottom:10px;div{height:30px;display:grid;grid-template-columns:28px 1fr auto;align-items:center;padding:0 9px;border:1px solid ${THEME.border};border-radius:7px;background:rgba(255,255,255,.88);text-align:left;}b{font-family:${THEME.font.serif};color:${THEME.goldAntique};}span{font-size:10px;font-weight:850;}em{font-style:normal;font-size:9px;font-weight:900;color:${THEME.burgundy};}`;
const DrawerShade=styled.div`position:absolute;inset:0;z-index:60;background:rgba(9,13,22,.35);display:flex;justify-content:flex-end;`;
const Drawer=styled.aside`width:min(310px,88vw);height:100%;padding:20px;box-sizing:border-box;background:#fff;border-left:1px solid ${THEME.gold};box-shadow:-16px 0 35px rgba(9,13,22,.16);h3{font:900 18px ${THEME.font.serif};margin:0 0 18px;}`;
const InfoLine=styled.div`height:38px;display:flex;align-items:center;gap:8px;border-bottom:1px solid ${THEME.border};font-size:10px;color:${THEME.mutedForeground};`;
const Danger=styled.button`width:100%;height:40px;margin-top:20px;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid ${THEME.rose};border-radius:8px;background:#fff1f2;color:${THEME.rose};font-weight:900;cursor:pointer;`;
const PauseLayer=styled.div`position:absolute;inset:42px 0 0;z-index:55;background:rgba(255,255,255,.86);backdrop-filter:blur(5px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;strong{font:900 22px ${THEME.font.serif};}span{font-size:11px;color:${THEME.mutedForeground};}`;
