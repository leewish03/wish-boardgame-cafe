import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { THEME } from '../../shared/theme';
import { bullheads } from '../../../packages/six-nimmt-core/src/cards.js';

const penaltyColors = { 1:THEME.mutedForeground, 2:THEME.emerald, 3:THEME.goldAntique, 5:THEME.indigo, 7:THEME.burgundy };
const Face = styled(motion.div)`
  width:var(--card-w);height:var(--card-h);flex:none;box-sizing:border-box;position:relative;
  border-radius:${THEME.radius.md};background:${p=>p.$back?THEME.burgundy:THEME.surfaceCard};
  color:${p=>p.$back?THEME.goldLight:THEME.foreground};box-shadow:${THEME.shadows.marbleSlab};
  border:1px solid ${THEME.border};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  strong{font:700 clamp(22px,calc(var(--card-w) * .5),34px)/1 ${THEME.font.mono};font-variant-numeric:tabular-nums;}
  small{font:700 clamp(10px,calc(var(--card-w) * .21),12px)/1 ${THEME.font.sans};color:${THEME.foreground};}
  svg{display:block;width:100%;height:clamp(14px,calc(var(--card-w) * .32),22px);fill:currentColor;}
  >svg{width:60%;height:60%;}
  @media(min-width:700px) and (max-height:500px) and (orientation:landscape){strong{font-size:22px;}svg{height:14px;}small{font-size:10px;}}
`;
const Bulls = styled.span`display:block;width:calc(100% - 8px);color:var(--penalty-color);`;
const bullPath = 'M7 9C3 9 2 4 3 2c2 4 4 4 6 4h6c2 0 4 0 6-4 1 2 0 7-4 7l-1 9-4 4-4-4Z';

export default function NimmtCard({ card, back=false, reduce=false, onComplete }) {
  const penalty=back?null:bullheads(card);
  return <Face layoutId={back?undefined:`card-${card}`} layout $back={back}
    style={back?undefined:{'--penalty-color':penaltyColors[penalty]}}
    transition={{layout:{duration:reduce?0.01:0.38,ease:'easeInOut'}}}
    onLayoutAnimationComplete={onComplete} aria-label={back?'선택 완료 · 뒷면':`${card}, 소머리 ${penalty}개`}>
    {back?<svg viewBox="0 0 24 24" aria-hidden="true"><path d={bullPath}/></svg>:<>
      <strong style={card>=100?{fontSize:'clamp(18px,calc(var(--card-w) * .35),24px)'}:undefined}>{card}</strong>
      <Bulls aria-hidden="true"><svg viewBox={penalty>3?'0 0 96 48':'0 0 72 24'}>{Array.from({length:penalty},(_,i)=><path key={i} d={bullPath} transform={penalty>3?`translate(${i%4*24} ${Math.floor(i/4)*24})`:`translate(${i*24+(3-penalty)*12} 0)`}/>)}</svg></Bulls>
      <small aria-hidden="true">{penalty} 벌점</small>
    </>}
  </Face>;
}
