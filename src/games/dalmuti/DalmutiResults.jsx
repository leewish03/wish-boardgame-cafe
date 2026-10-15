import React from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { THEME } from '../../shared/theme';
import { useDialogFocus } from '../../shared/useDialogFocus';

export function DalmutiResults({ game, isHost, locked, submitting, error, onAdvance, onRematch, onLeave }) {
  const reduced = useReducedMotion();
  const open = game.matchState === 'ROUND_END' || game.matchState === 'GAME_OVER';
  const final = game.matchState === 'GAME_OVER';
  const dialogRef = useDialogFocus(open);
  const playerById = new Map(game.players.map((player) => [player.id, player]));
  return <AnimatePresence>{open && <Overlay as={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <Sheet ref={dialogRef} tabIndex={-1} as={motion.section} role="dialog" aria-modal="true" aria-label={final ? '최종 계급전 결과' : '라운드 결과'} initial={{ opacity: 0, y: reduced ? 0 : 24 }} animate={{ opacity: 1, y: 0 }}>
      <Trophy size={28}/><h2>{final ? '최종 계급전 결과' : `${game.roundNumber}라운드 결과`}</h2>
      <Ranking>{(final ? [...game.players].sort((a, b) => b.score - a.score).map((player) => player.id) : game.outcome.finishOrder).map((id, index) => <li key={id}><b>{final ? game.players.filter(player => player.score > playerById.get(id).score).length + 1 : index + 1}</b><span>{playerById.get(id)?.nickname}</span><strong>{playerById.get(id)?.score}점</strong></li>)}</Ranking>
      <p>{final ? `${game.outcome.winnerIds.map((id) => playerById.get(id)?.nickname).join(', ')}${game.outcome.winnerIds.length > 1 ? ' 공동 우승' : ' 최종 우승'}` : '잠시 후 새 신분으로 다음 라운드가 시작됩니다.'}</p>
      <Actions>{isHost && <Action disabled={locked} onClick={final ? onRematch : onAdvance}>{submitting ? '서버에 요청 중…' : final ? '같은 멤버로 새 매치' : '바로 다음 라운드'}</Action>}
        <Action $secondary onClick={onLeave}>살롱 로비로</Action></Actions>
      {final && !isHost && <p>방장이 새 매치를 시작할 수 있습니다.</p>}
      {error && <ErrorText role="alert">{error}</ErrorText>}
    </Sheet>
  </Overlay>}</AnimatePresence>;
}

const Overlay = styled.div`position:absolute;inset:0;z-index:40;background:rgba(9,13,22,.58);display:grid;place-items:center;padding:${THEME.interaction.padding};box-sizing:border-box;`;
const Sheet = styled.section`width:min(430px,100%);max-height:100%;overflow:auto;padding:20px;box-sizing:border-box;border:1px solid ${THEME.gold};border-radius:${THEME.radius.xl};background:${THEME.surfaceCard};background-image:${THEME.gradients.marbleSlab};text-align:center;box-shadow:${THEME.shadows.marbleSlab};h2{margin:8px 0 12px;font:900 21px ${THEME.font.serif};}p{font-size:${THEME.interaction.body};line-height:1.5;color:${THEME.mutedForeground};}`;
const Ranking = styled.ol`list-style:none;padding:0;display:flex;flex-direction:column;gap:${THEME.interaction.gap};li{min-height:36px;display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center;text-align:left;}span{overflow-wrap:anywhere;font-size:${THEME.interaction.body};}b{color:${THEME.goldAntique};}strong{font-size:${THEME.interaction.body};color:${THEME.burgundy};}`;
const Actions = styled.div`display:flex;flex-direction:column;gap:${THEME.interaction.gap};`;
const Action = styled.button`min-height:${THEME.interaction.touchTarget};padding:8px 12px;border:1px solid ${THEME.border};border-radius:${THEME.radius.md};background:${p => p.$secondary ? THEME.surfaceCard : THEME.primary};color:${p => p.$secondary ? THEME.foreground : THEME.primaryForeground};font:700 ${THEME.interaction.body} ${THEME.font.sans};cursor:pointer;&:disabled{opacity:.5;cursor:wait;}&:focus-visible{outline:2px solid ${THEME.burgundy};outline-offset:2px;}`;
const ErrorText = styled.p`color:${THEME.destructive}!important;`;
