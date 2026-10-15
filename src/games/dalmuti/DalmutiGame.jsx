import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Crown, LogOut, Mic, Trophy, Users, Volume2, X } from 'lucide-react';
import { THEME } from '../../shared/theme';
import { RoomChat } from '../../shared/RoomChat';
import { useDialogFocus } from '../../shared/useDialogFocus';
import { RoomVoiceControls } from '../love-letter/ui/GameMenuDrawer';
import { GameHud } from '../love-letter/ui/GameHud';
import { DALMUTI_RANKS } from '../../../packages/dalmuti-core/src/index.js';
import { useDalmutiPresentation } from './useDalmutiPresentation.js';
import { DalmutiMotionLayer, DalmutiTableCard } from './DalmutiMotionLayer.jsx';
import { DalmutiResults } from './DalmutiResults.jsx';
import { toggleTaxSelection, visibleSetRanks, selectRankPlay } from './presentationState.js';
import { dalmutiActionNarrative } from './actionNarrative.js';

const rankName = (rank) => DALMUTI_RANKS[rank] || `계급 ${rank}`;
const groupCards = (cards = []) => {
  const groups = new Map();
  cards.forEach((card) => groups.set(card.rank, { rank: card.rank, count: (groups.get(card.rank)?.count || 0) + 1 }));
  return [...groups.values()].sort((a, b) => a.rank - b.rank);
};

export default function DalmutiGame({ roomState, currentUser, socket, webrtc, stt, chatMessages = [], onSendChat, onLeave, onRoomUnavailable }) {
  const { visualRoom, active, busy, finish, requestSync } = useDalmutiPresentation(socket, roomState);
  const game = visualRoom?.dalmuti;
  const myId = currentUser?.id;
  const reduceMotion = useReducedMotion();
  const [selection, setSelection] = useState(null);
  const [taxSelection, setTaxSelection] = useState({});
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useDialogFocus(menuOpen, () => setMenuOpen(false));
  const [submitting, setSubmitting] = useState(false);
  const [merchantTarget, setMerchantTarget] = useState(null);
  const pending = useRef(null);
  const surfaceRef = useRef(null);
  const anchors = useRef(new Map());
  const anchor = (key) => (element) => { if (element) anchors.current.set(key, element); else anchors.current.delete(key); };
  const unlock = useCallback(() => { clearTimeout(pending.current?.timer); pending.current = null; setSubmitting(false); }, []);
  useEffect(() => {
    setSelection(null); setTaxSelection({}); setError(''); setMerchantTarget(null);
    if (pending.current && roomState?.stateVersion > pending.current.version) unlock();
  }, [roomState?.stateVersion, unlock]);
  useEffect(() => {
    socket?.on('disconnect', unlock);
    return () => { socket?.off('disconnect', unlock); clearTimeout(pending.current?.timer); };
  }, [socket, unlock]);

  const playersById = useMemo(() => new Map((game?.players || []).map((player) => [player.id, player])), [game?.players]);
  const me = playersById.get(myId);
  const opponents = (game?.hierarchy || []).filter((id) => id !== myId).map((id) => playersById.get(id)).filter(Boolean);
  const handGroups = groupCards(visualRoom?.mySecret?.hand || []);
  const legalPlays = roomState?.mySecret?.legalPlays || [];
  const isMyTurn = roomState?.dalmuti?.currentTurnPlayerId === myId && !roomState?.isPaused && !busy && !submitting && socket?.connected !== false;
  const canPass = isMyTurn && game?.playPhase === 'TURN_INPUT' && game?.trick?.requiredCount != null;
  const currentPlayer = playersById.get(game?.currentTurnPlayerId);
  const currentTaxPair = game?.tax?.pairs?.find((pair) => pair.dalmutiId === myId);
  const taxNeeded = currentTaxPair?.count || 0;
  const selectedTaxCount = Object.values(taxSelection).reduce((sum, value) => sum + value, 0);

  const send = useCallback((command) => {
    if (!socket?.connected || pending.current || busy || roomState?.isPaused) return;
    setError('');
    const version = roomState.stateVersion;
    const request = { version };
    request.timer = setTimeout(() => { if (pending.current !== request) return; unlock(); requestSync(); setError('응답을 확인하는 중입니다. 다시 동기화합니다.'); }, 5000);
    pending.current = request;
    setSubmitting(true);
    socket.emit(command.type === 'START_MATCH' ? 'dalmuti:start' : 'dalmuti:command', { roomCode: roomState.code, command: { ...command, expectedStateVersion: version } }, (result) => {
      if (pending.current !== request) return;
      if (!result?.success) {
        unlock();
        const message = result?.error || '행동을 처리하지 못했습니다.';
        if (/방\s*(?:을|이)?\s*(?:찾을 수 없|존재하지)|진행 중인 .*게임을 찾을 수 없/.test(message)) {
            onRoomUnavailable?.({ ...result, roomCode: roomState.code, userId: myId });
          return;
        }
        setError(message);
      }
    });
  }, [socket, roomState, busy, myId, onRoomUnavailable, unlock, requestSync]);

  const chooseRank = (rank) => {
    if (!isMyTurn || game.playPhase !== 'TURN_INPUT') return;
    const chosen = selectRankPlay(legalPlays, rank, game.trick.requiredCount);
    if (chosen) setSelection(selection?.rank === rank ? null : chosen);
  };

  const countOptions = selection ? [...new Set(legalPlays.filter((play) => play.rank === selection.rank).map((play) => play.count))] : [];
  const compositionOptions = selection ? legalPlays.filter((play) => play.rank === selection.rank && play.count === selection.count) : [];

  const toggleTaxRank = (rank, available) => {
    if (!currentTaxPair || game.currentTurnPlayerId !== myId) return;
    setTaxSelection((previous) => {
      return toggleTaxSelection(previous, rank, available, taxNeeded);
    });
  };

  if (!game || !me) return null;

  const displayedSets = game.trick.sets;
  const narrative = dalmutiActionNarrative(active?.event, game.players, myId);
  const inputLocked = busy || submitting || roomState.isPaused || socket?.connected === false;

  const phaseMessage = (() => {
    if (roomState.isPaused) return '플레이어 재접속을 기다리는 중';
    if (busy) return narrative?.title || '테이블을 정리하는 중';
    if (game.playPhase === 'REVOLUTION_DECISION') return `${currentPlayer?.nickname || '플레이어'}의 혁명 결정`;
    if (game.playPhase === 'TAX_RETURN') return `${currentPlayer?.nickname || '달무티'}가 세금 반환 카드를 고르는 중`;
    if (game.playPhase === 'MERCHANT_EXCHANGE') return `${currentPlayer?.nickname || '상인'}의 상인 교환`;
    if (game.matchState === 'ROUND_END') return `${game.roundNumber}라운드 신분 재편`;
    if (game.matchState === 'GAME_OVER') return '최종 계급전 종료';
    if (isMyTurn) {
      if (game.trick.requiredCount == null) return '내 차례 · 같은 숫자를 모아 원하는 장수로 시작';
      if (game.trick.topRank === 1) return `달무티(1) ${game.trick.requiredCount}장 · 이 트릭은 패스만 가능합니다`;
      if (!legalPlays.length) return `${game.trick.requiredCount}장 · 낼 수 있는 카드가 없어 패스합니다`;
      return `내 차례 · ${game.trick.topRank}보다 낮은 숫자 ${game.trick.requiredCount}장 또는 패스`;
    }
    return `${currentPlayer?.nickname || '상대'}의 차례`;
  })();

  return <Surface ref={surfaceRef}>
    <SocialHeader><GameHud
      roundNumber={game.roundNumber}
      turnPlayerNickname={currentPlayer?.nickname || '플레이어'}
      isMyTurn={isMyTurn}
      isConnected={socket?.connected !== false}
      statusLabel={phaseMessage}
      leftLabel={<>라운드 {game.roundNumber}/{game.config.roundCount} <span>· 내 {me.score}점</span></>}
      turnExpiresAt={game.turnExpiresAt}
      turnTimeoutSeconds={game.config.turnTimeoutSeconds}
      clockMode={roomState.isPaused ? 'PAUSED' : busy ? 'PRESENTING' : 'RUNNING'}
      onOpenSettings={() => setMenuOpen(true)}
    /><RoomChat messages={chatMessages} onSend={onSendChat} mode="sheet" currentUserId={myId} launcherPlacement="inline"/></SocialHeader>

    <Table>
      <OpponentBoard data-count={opponents.length}>
        {opponents.map((player) => <PlayerTile ref={anchor(`player:${player.id}`)} key={player.id} as={motion.article} layout transition={{ duration: reduceMotion ? .12 : .42 }} $turn={player.id === game.currentTurnPlayerId} $finished={!!player.finishedPosition}>
          <RankMedal>{player.roleIndex + 1}</RankMedal>
          <Avatar src={player.avatarUrl} alt=""/>
          <Identity title={player.nickname}><strong>{player.nickname}</strong><span>{player.role}</span></Identity>
          <Stats><b>{player.handCount}</b><small>패</small><i>{player.score}점</i></Stats>
          {(active?.event.actorId === player.id || (!busy && player.id === game.currentTurnPlayerId)) && <TurnFlag>{busy ? '행동 중' : '차례'}</TurnFlag>}
          {(player.passed || (active?.event.type === 'PASSED' && active.event.actorId === player.id)) && <PassFlag>패스</PassFlag>}
          {player.finishedPosition && <FinishFlag>{player.finishedPosition}위 확정</FinishFlag>}
        </PlayerTile>)}
      </OpponentBoard>

      <CenterStage>
        <TrickMeta>
          <span>{game.trick.lastPlayerId ? `${playersById.get(game.trick.lastPlayerId)?.nickname || '플레이어'}의 카드` : '중앙 더미'}</span>
          <b>{game.trick.requiredCount ? `${game.trick.requiredCount}장 · ${game.trick.topRank} ${rankName(game.trick.topRank)}` : '새로운 선'}</b>
          <small>연속 패스 {game.trick.passPlayerIds.length} · 완료 트릭 {game.trick.completedCount}</small>
        </TrickMeta>
        <Pile ref={anchor('pile')} aria-label="현재 중앙 카드 더미" style={{ opacity: active?.event.type === 'TRICK_CLEARED' ? 0 : 1 }}>
          {displayedSets.slice(-4).map((set, index, visible) => <SetLayer key={set.id} as={motion.div} initial={false} animate={{ rotate: (index - visible.length + 1) * 1.4 }} transition={{ duration: reduceMotion ? .12 : .2 }} $offset={index}>
            {visibleSetRanks(set).map((rank, cardIndex) => <DalmutiTableCard key={cardIndex} $jester={rank === 13} style={{ marginLeft: cardIndex ? '-34px' : 0 }}><b>{rank === 13 ? 'J' : rank}</b><span>{rankName(rank)}</span></DalmutiTableCard>)}
            <SetCount>{set.count}장{set.jesterCount > 0 && ` · J ${set.jesterCount}장`}</SetCount>
          </SetLayer>)}
          {!displayedSets.length && <EmptyPile><Crown size={22}/><span>선 플레이를 기다립니다</span></EmptyPile>}
        </Pile>
        <Archive ref={anchor('archive')} aria-label="완료 트릭 보관부">완료 트릭 {game.trick.completedCount}</Archive>
        <ActionError role="alert">{error}</ActionError>
      </CenterStage>

      <LocalArea>
        <SelfBar ref={anchor(`player:${myId}`)} $turn={isMyTurn}><Avatar src={me.avatarUrl} alt=""/><Identity><strong>{me.nickname} <small>나</small>{me.passed && ' · 패스'}</strong><span>{me.roleIndex + 1}위 · {me.role} · {me.score}점</span></Identity><Stats><b>{me.handCount}</b><small>패</small></Stats></SelfBar>

        {game.playPhase === 'REVOLUTION_DECISION' && game.revolutionCandidateId === myId ? <DecisionTray><strong>어릿광대 둘이 모였습니다</strong><span>{me.role === '농노' ? '대혁명은 계급을 완전히 뒤집습니다.' : '혁명을 선언하면 이번 라운드의 세금이 사라집니다.'}</span><ButtonRow><Secondary disabled={inputLocked} onClick={() => send({ type:'DECLINE_REVOLUTION' })}>그대로 진행</Secondary><Primary disabled={inputLocked} onClick={() => send({ type:'DECLARE_REVOLUTION' })}>혁명 선언</Primary></ButtonRow></DecisionTray>
        : game.playPhase === 'TAX_RETURN' && currentTaxPair && game.currentTurnPlayerId === myId ? <DecisionTray><strong>{taxNeeded}장을 농노에게 돌려주세요</strong><span>받을 세금은 최종 교환과 함께 손패에 들어옵니다.</span><TaxGroups>{handGroups.map((group) => <TaxChip disabled={inputLocked} key={group.rank} onClick={() => toggleTaxRank(group.rank, group.count)} $selected={taxSelection[group.rank] > 0}><b>{group.rank}</b><span>{rankName(group.rank)}</span><i>{taxSelection[group.rank] || 0}/{group.count}</i></TaxChip>)}</TaxGroups><Primary disabled={inputLocked || selectedTaxCount !== taxNeeded} onClick={() => send({ type:'SELECT_TAX_RETURN', selection:Object.entries(taxSelection).filter(([,count]) => count).map(([rank,count]) => ({ rank:Number(rank), count })) })}>{selectedTaxCount}/{taxNeeded}장 반환</Primary></DecisionTray>
        : game.playPhase === 'MERCHANT_EXCHANGE' && game.merchantExchange?.actorId === myId ? <DecisionTray><strong>카드를 교환할 상대를 고르세요</strong><TargetRow>{game.merchantExchange.eligibleTargetIds.map((id) => <Secondary disabled={inputLocked} key={id} aria-pressed={merchantTarget===id} onClick={() => setMerchantTarget(merchantTarget===id?null:id)}>{merchantTarget===id?'✓ ':''}{playersById.get(id)?.nickname}</Secondary>)}</TargetRow><span>{merchantTarget?`${playersById.get(merchantTarget)?.nickname}님과 무작위 카드 1장을 교환합니다.`:'상대를 선택한 뒤 확정하세요.'}</span><ButtonRow><Secondary disabled={inputLocked||!merchantTarget} onClick={()=>setMerchantTarget(null)}>취소</Secondary><Primary disabled={inputLocked||!game.merchantExchange.eligibleTargetIds.includes(merchantTarget)} onClick={()=>send({type:'SELECT_MERCHANT_EXCHANGE_TARGET',targetId:merchantTarget})}>교환 확정</Primary></ButtonRow></DecisionTray>
        : me.handCount === 0 ? <FinishedHand><Trophy size={20}/><div><strong>{me.finishedPosition}위로 패를 모두 냈습니다</strong><span>이번 판은 관전 중입니다 · 현재 {me.score}점</span></div></FinishedHand>
        : <>
          <HandRail aria-label="내 손패">
            {handGroups.map((group) => {
              const mixedJester = group.rank === 13 && legalPlays.some((play) => play.rank !== 13 && play.jesterCount > 0);
              const legal = legalPlays.some((play) => play.rank === group.rank);
              const selected = selection?.rank === group.rank;
              const highlighted = group.rank === 13 && selection?.jesterCount > 0;
              return <RankStack ref={anchor(`rank:${group.rank}`)} key={group.rank} as={motion.button} type="button" onClick={() => chooseRank(group.rank)} disabled={!legal || !isMyTurn} $legal={legal && isMyTurn} $selected={selected || highlighted} aria-pressed={selected} title={group.rank === 13 ? legal ? '단독으로 낼 어릿광대 선택' : mixedJester ? '숫자 묶음을 선택한 뒤 조합을 고르세요' : undefined : undefined} whileTap={legal && !reduceMotion ? { y:-2 } : undefined}>
                <CardNumber>{group.rank === 13 ? 'J' : group.rank}</CardNumber><CardName>{rankName(group.rank)}</CardName><CountBadge>× {group.count}</CountBadge>
                {group.rank === 13 && <JesterHint>{legal ? '단독 선택' : mixedJester ? '숫자와 조합' : '사용 불가'}</JesterHint>}
              </RankStack>;
            })}
          </HandRail>
          <PlayTray>
            <SelectionText>{selection ? <><b>{selection.count}× {selection.rank === 13 ? 'J' : selection.rank}</b><span>{selection.rank === 13 ? '어릿광대 단독' : selection.jesterCount ? `어릿광대 ${selection.jesterCount}장 포함` : '일반 카드 구성'}</span></> : <span>{isMyTurn ? game.trick.topRank === 1 ? '달무티(1)는 이길 수 없습니다 · 패스하세요' : !legalPlays.length ? '같은 장수의 더 낮은 숫자가 없어 패스만 가능합니다' : '낼 계급 묶음을 선택하세요' : submitting ? '제출 확인 중' : '상대의 행동을 기다리는 중'}</span>}</SelectionText>
            <PlayOptions aria-label="카드 구성 옵션">
            {selection && countOptions.length > 0 && <OptionRow aria-label="낼 카드 장수 선택">{countOptions.map((count) => <Option disabled={!isMyTurn} key={count} $active={selection.count === count} aria-pressed={selection.count === count} onClick={() => setSelection(legalPlays.find((play) => play.rank === selection.rank && play.count === count && play.jesterCount === selection.jesterCount) || legalPlays.find((play) => play.rank === selection.rank && play.count === count))}>{count}장</Option>)}</OptionRow>}
            {selection && selection.rank !== 13 && handGroups.some((group) => group.rank === 13) && <OptionRow aria-label="어릿광대 조합 선택">{[0,1,2].map((jesterCount) => {
              const play = compositionOptions.find((candidate) => candidate.jesterCount === jesterCount);
              return <Option disabled={!isMyTurn || !play} key={jesterCount} $active={selection.jesterCount === jesterCount} aria-pressed={selection.jesterCount === jesterCount} onClick={() => play && setSelection(play)}>J {jesterCount}</Option>;
            })}</OptionRow>}
            </PlayOptions>
            <ButtonRow><Secondary disabled={!canPass} onClick={() => send({ type:'PASS' })}>패스</Secondary><Primary disabled={!selection || !isMyTurn} onClick={() => send({ type:'PLAY_SET', ...selection })}>중앙에 내기</Primary></ButtonRow>
          </PlayTray>
        </>}
      </LocalArea>
    </Table>

    <DalmutiMotionLayer active={active} anchors={anchors} surfaceRef={surfaceRef} myId={myId} finish={finish} reduced={reduceMotion} pileSets={displayedSets}/>
    <DalmutiResults game={game} presenting={busy} isHost={roomState.hostId === myId} locked={inputLocked} submitting={submitting} error={error} connectionNotice={roomState.isPaused ? '게임 일시정지 · 플레이어 재접속을 기다립니다. 연결이 돌아오지 않으면 AI가 자리를 이어받습니다.' : socket?.connected === false ? '연결이 끊어졌습니다. 재접속 후 계속할 수 있습니다.' : undefined} onAdvance={() => send({ type: 'ADVANCE_ROUND' })} onRematch={() => send({ type: 'START_MATCH' })} onLeave={onLeave}/>
    <AnimatePresence>{menuOpen && <DrawerShade as={motion.div} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setMenuOpen(false)}><Drawer ref={menuRef} tabIndex={-1} as={motion.aside} role="dialog" aria-modal="true" aria-label="달무티 살롱 메뉴" initial={{x:reduceMotion ? 0 : 320}} animate={{x:0}} exit={{x:reduceMotion ? 0 : 320}} onClick={(event)=>event.stopPropagation()}><DrawerHeader><h3>달무티 살롱</h3><CloseMenu type="button" aria-label="게임 메뉴 닫기" onClick={() => setMenuOpen(false)}><X size={20}/></CloseMenu></DrawerHeader><RoomVoiceControls voice={webrtc} compact/><InfoLine><Users size={14}/>{game.players.length}명 · {game.config.roundCount}라운드</InfoLine><InfoLine><Mic size={14}/>{stt?.isSTTActive ? '자막 사용 중' : '음성 채팅'}</InfoLine><InfoLine><Volume2 size={14}/>턴 제한 {game.config.turnTimeoutSeconds || '없음'}</InfoLine><Danger onClick={() => onLeave?.()}><LogOut size={15}/>게임 나가기</Danger></Drawer></DrawerShade>}</AnimatePresence>
    {roomState.isPaused && <PauseLayer><strong>게임 일시정지</strong><span>연결이 돌아오지 않으면 AI가 자리를 이어받습니다.</span></PauseLayer>}
  </Surface>;
}

const SocialHeader=styled.div`isolation:isolate;display:flex;align-items:center;flex-shrink:0;background:${THEME.surfaceCard};>header{flex:1;min-width:0;}>button{flex-shrink:0;margin-inline-end:${THEME.interaction.gap};}`;
const Surface=styled.div`width:100%;height:100%;min-height:0;overflow:hidden;background:${THEME.gradients.marbleTextureUrl},radial-gradient(circle at 50% 42%,#fff 0%,#eef1f4 74%,#dfe4e8 100%);background-size:cover;color:${THEME.foreground};display:flex;flex-direction:column;position:relative;`;
const Table=styled.main`width:100%;min-width:0;flex:1;min-height:0;display:grid;grid-template-rows:auto minmax(120px,1fr) auto;overflow:auto;@media(min-width:700px) and (max-height:500px) and (orientation:landscape){grid-template-columns:minmax(0,1fr) minmax(320px,44%);grid-template-rows:auto minmax(0,1fr);>section:first-child{grid-column:1;grid-row:1;} >section:nth-child(2){grid-column:1;grid-row:2;overflow:auto;}>section:last-child{grid-column:2;grid-row:1/3;overflow:auto;}}`;
const OpponentBoard=styled.section`width:min(900px,100%);margin:0 auto;padding:6px 8px 2px;box-sizing:border-box;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;align-content:start;&[data-count="1"]{grid-template-columns:minmax(0,260px);justify-content:center;}&[data-count="2"],&[data-count="4"]{grid-template-columns:repeat(2,minmax(0,1fr));}&[data-count="3"],&[data-count="5"],&[data-count="6"]{grid-template-columns:repeat(3,minmax(0,1fr));}@media(max-width:560px){grid-template-columns:repeat(3,minmax(0,1fr))!important;padding-inline:4px;gap:3px;}@media(min-width:700px) and (max-height:500px) and (orientation:landscape){grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:3px;padding-inline:4px;>article{height:50px;padding:4px;gap:3px;}>article>img{display:none;}}`;
const PlayerTile=styled.article`min-width:0;height:54px;display:flex;align-items:center;gap:5px;padding:5px 7px;box-sizing:border-box;position:relative;border:1px solid ${p=>p.$turn?THEME.gold:THEME.border};border-radius:8px;background:${p=>p.$turn?'#fffdf2':'rgba(255,255,255,.92)'};box-shadow:${p=>p.$turn?'0 5px 16px rgba(197,160,89,.24)':'0 2px 7px rgba(9,13,22,.06)'};opacity:${p=>p.$finished?.62:1};@media(max-width:560px){height:50px;padding:4px;gap:3px;}`;
const RankMedal=styled.b`width:18px;height:18px;display:grid;place-items:center;border-radius:50%;background:${THEME.primary};color:${THEME.goldLight};font:900 9px ${THEME.font.serif};flex:0 0 18px;`;
const Avatar=styled.img`width:27px;height:27px;border-radius:50%;object-fit:cover;border:1px solid ${THEME.gold};flex:0 0 27px;@media(max-width:420px){display:none;}`;
const Identity=styled.div`min-width:0;display:flex;flex-direction:column;flex:1;strong{font-size:${THEME.interaction.caption};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}strong small{font-size:10px;color:${THEME.goldAntique};}span{font-size:11px;color:${THEME.burgundy};font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}`;
const Stats=styled.div`display:grid;grid-template-columns:auto auto;align-items:end;b{font:900 18px ${THEME.font.serif};line-height:1;}small{font-size:10px;color:${THEME.mutedForeground};}i{grid-column:1/-1;font-size:10px;font-style:normal;color:${THEME.goldAntique};font-weight:700;}`;
const badge=css`position:absolute;top:-5px;border-radius:8px;padding:1px 5px;font-size:7px;font-weight:950;letter-spacing:.04em;`;
const TurnFlag=styled.span`${badge};right:5px;background:${THEME.gold};color:#111;`;
const PassFlag=styled.span`${badge};left:26px;background:${THEME.primary};color:#fff;`;
const FinishFlag=styled.span`${badge};left:50%;transform:translateX(-50%);background:${THEME.emerald};color:#fff;`;
const CenterStage=styled.section`width:100%;min-width:0;min-height:0;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:4px 8px;`;
const TrickMeta=styled.div`display:flex;align-items:center;gap:9px;font-size:9px;color:${THEME.mutedForeground};b{font:900 11px ${THEME.font.serif};color:${THEME.foreground};}small{font-size:8px;}@media(max-width:420px){small{display:none;}}`;
const Pile=styled.div`width:min(420px,calc(100% - 12px));max-width:100%;height:112px;box-sizing:border-box;position:relative;border:1px dashed rgba(197,160,89,.55);border-radius:14px;background:rgba(255,255,255,.28);display:grid;place-items:center;`;
const SetLayer=styled.div`position:absolute;inset:9px;display:flex;align-items:center;justify-content:center;transform-origin:center;`;
const SetCount=styled.span`position:absolute;bottom:-7px;right:0;padding:2px 5px;border-radius:5px;background:#fffdf7;font-size:9px;color:${THEME.foreground};`;
const Archive=styled.div`align-self:flex-end;padding:5px 8px;border:1px solid ${THEME.border};border-radius:6px;font-size:9px;color:${THEME.goldAntique};`;
const JesterHint=styled.span`font-size:8px;color:${THEME.goldAntique};`;
const EmptyPile=styled.div`display:flex;flex-direction:column;align-items:center;gap:4px;color:${THEME.goldAntique};font-size:9px;`;
const ActionError=styled.div`min-height:16px;color:${THEME.rose};font-size:${THEME.interaction.caption};font-weight:700;text-align:center;`;
const LocalArea=styled.section`width:100%;min-width:0;box-sizing:border-box;border-top:1px solid ${THEME.borderGold};background:${THEME.surfaceCardGlass};display:flex;flex-direction:column;padding:8px 8px max(12px,env(safe-area-inset-bottom));gap:8px;box-shadow:0 -6px 20px rgba(9,13,22,.05);`;
const SelfBar=styled.div`height:31px;display:flex;align-items:center;gap:6px;width:min(760px,100%);margin:0 auto;padding:1px 5px;box-sizing:border-box;border-bottom:2px solid ${p=>p.$turn?THEME.gold:'transparent'};${Avatar}{width:23px;height:23px;display:block;flex-basis:23px;}`;
const HandRail=styled.div`min-height:112px;min-width:0;display:flex;align-items:center;gap:8px;overflow-x:auto;overflow-y:hidden;width:min(900px,100%);max-width:100%;margin:0 auto;padding:6px 2px;box-sizing:border-box;scrollbar-width:thin;overscroll-behavior-x:contain;@media(max-height:650px){min-height:96px;}`;
const RankStack=styled.button`width:72px;height:100px;flex:0 0 72px;border:1px solid ${p=>p.$selected?THEME.burgundy:p.$legal?THEME.gold:THEME.border};border-width:${p=>p.$selected?2:1}px;border-radius:${THEME.radius.lg};background:${p=>p.$selected?'#fff5f5':'#fffdf9'};box-shadow:0 2px 6px rgba(9,13,22,.08);color:${THEME.foreground};display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:${p=>p.$legal?'pointer':'default'};transform:${p=>p.$selected?'translateY(-3px)':'none'};&:focus-visible{outline:2px solid ${THEME.burgundy};outline-offset:2px;}&:disabled{background:${THEME.muted};}@media(max-height:650px){width:64px;height:84px;flex-basis:64px;}@media(prefers-reduced-motion:reduce){transform:none;}`;
const CardNumber=styled.b`font:900 21px ${THEME.font.serif};line-height:1;`;
const CardName=styled.span`font-size:11px;font-weight:750;color:${THEME.burgundy};margin-top:6px;`;
const CountBadge=styled.i`font-size:${THEME.interaction.caption};font-style:normal;font-weight:800;color:${THEME.foreground};margin-top:6px;`;
const PlayTray=styled.div`width:min(760px,100%);max-width:100%;min-width:0;box-sizing:border-box;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:44px minmax(44px,auto);align-items:center;gap:${THEME.interaction.gap};>div:last-child{grid-column:2;grid-row:2;}`;
const PlayOptions=styled.div`grid-column:1/-1;grid-row:1;min-width:0;height:44px;display:flex;align-items:center;gap:12px;overflow-x:auto;overflow-y:hidden;`;
const SelectionText=styled.div`grid-column:1;grid-row:2;min-width:0;display:flex;flex-direction:column;gap:4px;b{font:900 16px ${THEME.font.serif};}span{font-size:${THEME.interaction.caption};line-height:1.4;color:${THEME.mutedForeground};}`;
const OptionRow=styled.div`display:flex;gap:3px;flex:0 0 auto;`;
const Option=styled.button`min-width:44px;height:44px;flex:0 0 auto;padding:0 9px;border:1px solid ${p=>p.$active?THEME.burgundy:THEME.border};border-radius:6px;background:${p=>p.$active?'#fff1f2':'#fff'};color:${THEME.foreground};font-size:11px;font-weight:850;cursor:pointer;&:disabled{opacity:.4;cursor:not-allowed;}`;
const ButtonRow=styled.div`display:flex;gap:5px;`;
const FinishedHand=styled.div`width:min(760px,100%);min-height:82px;margin:0 auto;display:flex;align-items:center;justify-content:center;gap:9px;color:${THEME.goldAntique};strong{display:block;font:900 13px ${THEME.font.serif};color:${THEME.foreground};}span{display:block;margin-top:3px;font-size:9px;font-weight:750;color:${THEME.mutedForeground};}`;
const Secondary=styled.button`min-height:${THEME.interaction.touchTarget};padding:0 12px;border:1px solid ${THEME.border};border-radius:${THEME.radius.md};background:${THEME.surfaceCard};color:${THEME.foreground};font-size:${THEME.interaction.body};font-weight:750;cursor:pointer;&:disabled{opacity:.4;cursor:not-allowed;}&:focus-visible{outline:2px solid ${THEME.burgundy};outline-offset:2px;}`;
const Primary=styled.button`min-height:${THEME.interaction.touchTarget};padding:0 16px;border:1px solid ${THEME.goldAntique};border-radius:${THEME.radius.md};background:${THEME.gradients.obsidianButton};color:${THEME.primaryForeground};font:800 ${THEME.interaction.body} ${THEME.font.sans};cursor:pointer;&:disabled{opacity:.4;cursor:not-allowed;}&:focus-visible{outline:2px solid ${THEME.burgundy};outline-offset:2px;}`;
const DecisionTray=styled.div`width:min(680px,100%);margin:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;text-align:center;strong{font:900 15px ${THEME.font.serif};}span{font-size:9px;color:${THEME.mutedForeground};}`;
const TaxGroups=styled.div`display:flex;gap:4px;max-width:100%;overflow-x:auto;`;
const TaxChip=styled.button`width:56px;height:58px;flex:0 0 56px;border:1px solid ${p=>p.$selected?THEME.burgundy:THEME.border};border-radius:7px;background:${p=>p.$selected?'#fff1f2':'#fff'};display:flex;flex-direction:column;align-items:center;justify-content:center;b{font:900 17px ${THEME.font.serif};}span{font-size:7px;}i{font-size:8px;font-style:normal;font-weight:900;color:${THEME.burgundy};}`;
const TargetRow=styled.div`display:flex;gap:5px;flex-wrap:wrap;justify-content:center;`;
const DrawerShade=styled.div`position:absolute;inset:0;z-index:60;background:rgba(9,13,22,.35);display:flex;justify-content:flex-end;`;
const Drawer=styled.aside`width:min(340px,100%);height:100%;overflow-y:auto;padding:16px 16px max(16px,env(safe-area-inset-bottom));box-sizing:border-box;background:${THEME.surfaceCard};border-left:1px solid ${THEME.gold};box-shadow:-16px 0 35px rgba(9,13,22,.16);h3{font:900 18px ${THEME.font.serif};margin:0;}`;
const DrawerHeader=styled.div`display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:16px;`;
const CloseMenu=styled.button`width:${THEME.interaction.touchTarget};height:${THEME.interaction.touchTarget};display:grid;place-items:center;border:1px solid ${THEME.border};border-radius:${THEME.radius.md};background:${THEME.surfaceCard};color:${THEME.foreground};cursor:pointer;`;
const InfoLine=styled.div`height:38px;display:flex;align-items:center;gap:8px;border-bottom:1px solid ${THEME.border};font-size:10px;color:${THEME.mutedForeground};`;
const Danger=styled.button`width:100%;height:40px;margin-top:20px;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid ${THEME.rose};border-radius:8px;background:#fff1f2;color:${THEME.rose};font-weight:900;cursor:pointer;`;
const PauseLayer=styled.div`position:absolute;inset:42px 0 0;z-index:55;background:rgba(255,255,255,.86);backdrop-filter:blur(5px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;strong{font:900 22px ${THEME.font.serif};}span{font-size:11px;color:${THEME.mutedForeground};}`;
