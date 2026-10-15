import React, { useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { THEME } from '../../shared/theme';
import { anchorPoint, visibleSetRanks } from './presentationState.js';
import { DALMUTI_RANKS } from '../../../packages/dalmuti-core/src/index.js';
import { dalmutiPresentationMs } from '../../../packages/protocol/src/dalmutiPresentation.js';

export function DalmutiMotionLayer({ active, anchors, surfaceRef, myId, finish, reduced, pileSets }) {
  const [paths, setPaths] = useState(null);
  useLayoutEffect(() => {
    if (!active) { setPaths(null); return; }
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
    if (event.type === 'TRICK_CLEARED') {
      add(point('pile'), point('archive'), false);
      if (paths.length) paths[paths.length - 1].ranks = visibleSetRanks(pileSets.at(-1) || {rank:1,count:0});
    }
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
  }, [active, anchors, surfaceRef, myId, pileSets]);
  if (!active || paths?.eventId !== active.eventId) return null;
  const event = active.event;
  const done = () => finish(active.eventId, active.generation);
  const duration = reduced ? 0.12 : event.type === 'ROUND_DEALT' ? 0.65 : 0.42;
  return <Layer aria-live="polite">
    {!reduced && paths.paths.map((path, index) => <Flight key={`${active.eventId}:${index}`} as={motion.div}
          initial={{ x: path.from.x, y: path.from.y, opacity: 1, scale: 0.8 }}
          animate={{ x: path.to.x, y: path.to.y, opacity: event.type === 'TRICK_CLEARED' ? 0 : 1, scale: event.type === 'TRICK_CLEARED' ? .3 : 1 }}
          transition={{ duration, ease: [0.22, 0.61, 0.36, 1] }}>
          <FlyingSet>{path.back ? <Back><b>W</b><span>{path.count}장</span></Back> : (path.ranks || visibleSetRanks(event)).map((rank, card) => <Face key={card} $jester={rank === 13}><b>{rank === 13 ? 'J' : rank}</b><span>{DALMUTI_RANKS[rank]}</span></Face>)}</FlyingSet>
        </Flight>)}
    <ReadingBeat key={active.eventId} as={motion.div} aria-hidden="true" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: dalmutiPresentationMs(event.type) / 1000, ease: 'linear' }} onAnimationComplete={done}/>
  </Layer>;
}

const Layer = styled.div`position:absolute;inset:0;z-index:35;pointer-events:none;overflow:hidden;`;
const Flight = styled.div`position:absolute;left:0;top:0;`;
const FlyingSet = styled.div`display:flex;transform:translate(-50%,-50%);`;
export const DalmutiTableCard = styled.div`position:relative;width:60px;height:88px;flex:0 0 60px;display:flex;flex-direction:column;justify-content:center;align-items:center;border:1px solid ${THEME.gold};border-radius:7px;background:${p => p.$jester ? THEME.burgundy : '#fffdf7'};color:${p => p.$jester ? '#fff' : THEME.foreground};box-shadow:0 4px 10px rgba(9,13,22,.16);b{position:absolute;top:5px;left:6px;font:900 23px ${THEME.font.serif};}span{font-size:8px;margin-top:20px;}`;
const Face = styled(DalmutiTableCard)`margin-left:-34px;&:first-child{margin-left:0;}`;
const Back = styled(Face)`background:${THEME.primary};color:${THEME.gold};margin:0;`;
const ReadingBeat = styled.div`position:absolute;left:calc(50% - 32px);top:0;width:64px;height:2px;background:${THEME.gold};transform-origin:left;`;
