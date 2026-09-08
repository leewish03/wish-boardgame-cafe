import React from 'react';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { CardValue } from '../../../../packages/love-letter-core/src/types';
import { getHeraldicIcon } from '../presentation/heraldicIcons';

export const CARD_WIDTH = 154;
export const CARD_HEIGHT = 220;

// Fixed printing coordinates: the whole card scales, never its text layout.
// No foreignObject, raster loading, responsive font sizes or truncated copy.
export const CardArtwork = React.memo(function CardArtwork({value, name, back = false}: {
  value?: CardValue; name?: string; back?: boolean;
}) {
  const meta = value ? CARD_DEFINITIONS[value] : undefined;
  const lines = meta?.description.match(/.{1,11}/gu) || [];
  const label = back || !meta ? '카드 뒷면' : `${value} ${name || meta.name}. ${meta.description}`;
  return <svg viewBox="0 0 154 220" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
    role="img" aria-label={label} data-card-art={back || !meta ? 'back' : value}
    style={{display:'block', overflow:'visible', pointerEvents:'none'}}>
    <rect x=".75" y=".75" width="152.5" height="218.5" rx="9" fill={back || !meta ? '#480e20' : '#fdfbf7'} stroke="#b8a16b" strokeWidth="1.5"/>
    <rect x="5" y="5" width="144" height="210" rx="6" fill="none" stroke="#d4c695"/>
    {back || !meta ? <g stroke="#b8a16b" fill="none"><path d="M77 81 99 110 77 139 55 110Z"/><path d="M77 93 89 110 77 127 65 110Z"/></g> : <g fontFamily="Arial, 'Noto Sans KR', sans-serif">
      <circle cx="27" cy="29" r="16" fill="#18181b" stroke="#b8a16b"/>
      <text x="27" y="35" textAnchor="middle" fontSize="19" fontWeight="700" fill="#c1a451">{value}</text>
      <text x="49" y="27" fontSize="14" fontWeight="700" fill="#18181b">{name || meta.name}</text>
      <text x="49" y="41" fontSize="8" fill="#71717a">{meta.nameEn.toUpperCase()}</text>
      <g transform="translate(53 65)">{getHeraldicIcon(value!,48)}</g>
      <rect x="11" y="126" width="132" height="82" rx="5" fill="#f1eee6"/>
      <text x="18" y="141" fontSize="10.5" fill="#3f3f46">
        {lines.map((line,i)=><tspan key={i} x="18" dy={i ? 13 : 0}>{line}</tspan>)}
      </text>
    </g>}
  </svg>;
});
