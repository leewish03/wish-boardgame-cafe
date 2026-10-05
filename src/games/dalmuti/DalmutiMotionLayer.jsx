import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { THEME } from '../../shared/theme';
import { anchorPoint, visibleSetRanks } from './presentationState.js';
import { DALMUTI_RANKS } from '../../../packages/dalmuti-core/src/index.js';

export function DalmutiMotionLayer({ active, anchors, surfaceRef, myId, finish, reduced }) {
  const [paths, setPaths] = useState(null);
  const completed = useRef(new Set());
  useLayoutEffect(() => {
    if (!active) { setPaths(null); return; }
    completed.current.clear();
    const surface = surfaceRef.current?.getBoundingClientRect();
    const point = (key) => {
      const rect = anchors.current.get(key)?.getBoundingClientRect();
      return anchorPoint(rect, surface, surfaceRef.current?.clientWidth, surfaceRef.current?.clientHeight);
    };
    const event = active.event;
    const player = (id, rank) => point(id === myId && rank ? `rank:${rank}` : `player:${id}`) || point(`player:${id}`);
    const paths = [];
    const add = (from, to, back = true, count = 1) => { if (from && to) paths.push({ from, to, back, count }); };
    if (event.type === 'SET_PLAYED') add(player(event.actorId, event.rank), point('pile'), false, event.count);
    if (event.type === 'TRICK_CLEARED') add(point('pile'), point('archive'));
    if (event.type === 'TAX_COMPLETED') for (const pair of event.pairs) {
      add(player(pair.peonId), player(pair.dalmutiId), true, pair.count);
      add(player(pair.dalmutiId), player(pair.peonId), true, pair.count);
    }
    if (event.type === 'MERCHANT_EXCHANGED') {
      add(player(event.actorId), player(event.targetId)); add(player(event.targetId), player(event.actorId));
    }
    if (event.type === 'ROUND_DEALT') {
      for (const [key] of anchors.current) if (key.startsWith('player:')) add(point('pile'), point(key));
    }
    setPaths({ eventId: active.eventId, paths });
  }, [active, anchors, surfaceRef, myId]);
  if (!active || paths?.eventId !== active.eventId) return null;
  const event = active.event;
  const done = () => finish(active.eventId, active.generation);
  const duration = reduced ? 0.12 : event.type === 'ROUND_DEALT' ? 0.65 : 0.42;
  const labels = {
    PASSED: '패스', REVOLUTION: '혁명 · 이번 판 세금 취소', GREAT_REVOLUTION: '대혁명 · 신분 반전',
    ROUND_DEALT: '새 신분으로 카드 배분', TAX_COMPLETED: '세금 교환', MERCHANT_EXCHANGED: '상인 교환',
    TRICK_CLEARED: '트릭 정리', OPENING_READY: '달무티 카드 소유자가 첫 선', PLAY_STARTED: '새로운 선',
    TAX_REQUESTED: '세금 반환 카드 선택', ROUND_ENDED: '라운드 결과', MATCH_ENDED: '최종 결과',
  };
  return <Layer aria-live="polite">
    {(reduced || !paths.paths.length) ? <Cue as={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration }} onAnimationComplete={done}>{labels[event.type] || '카드 제출'}</Cue>
      : paths.paths.map((path, index) => <Flight key={`${active.eventId}:${index}`} as={motion.div}
          initial={{ x: path.from.x, y: path.from.y, opacity: 1, scale: 0.8 }}
          animate={{ x: path.to.x, y: path.to.y, opacity: event.type === 'TRICK_CLEARED' ? 0.15 : 1, scale: 1 }}
          transition={{ duration, ease: [0.22, 0.61, 0.36, 1] }}
          onAnimationComplete={() => { completed.current.add(index); if (completed.current.size === paths.paths.length) done(); }}>
          <FlyingSet>{path.back ? <Back><b>W</b><span>{path.count}장</span></Back> : visibleSetRanks(event).map((rank, card) => <Face key={card} $jester={rank === 13}><b>{rank === 13 ? 'J' : rank}</b><span>{DALMUTI_RANKS[rank]}</span></Face>)}</FlyingSet>
        </Flight>)}
    {!!labels[event.type] && paths.paths.length > 0 && !reduced && <Caption>{labels[event.type]}</Caption>}
  </Layer>;
}

const Layer = styled.div`position:absolute;inset:0;z-index:35;pointer-events:none;overflow:hidden;`;
const Flight = styled.div`position:absolute;left:0;top:0;`;
const FlyingSet = styled.div`display:flex;transform:translate(-50%,-50%);`;
const Face = styled.div`width:52px;height:76px;flex:0 0 52px;margin-left:-24px;display:flex;flex-direction:column;justify-content:center;align-items:center;border:1px solid ${THEME.gold};border-radius:6px;background:${p => p.$jester ? THEME.burgundy : '#fffdf7'};color:${p => p.$jester ? '#fff' : THEME.foreground};box-shadow:0 4px 10px rgba(9,13,22,.16);&:first-child{margin-left:0;}b{font:900 23px ${THEME.font.serif};}span{font-size:8px;}`;
const Back = styled(Face)`background:${THEME.primary};color:${THEME.gold};margin:0;`;
const Cue = styled.div`position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);padding:8px 14px;border-radius:8px;background:${THEME.primary};color:#fff;font-size:12px;`;
const Caption = styled(Cue)`top:38%;font-size:10px;`;
