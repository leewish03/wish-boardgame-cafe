import React from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, LogOut, RotateCcw } from 'lucide-react';
import { PlayerPublic } from '../../../..//packages/love-letter-core/src/types';
import { THEME } from '../../../shared/theme';

interface MatchResultModalProps { isOpen:boolean; championName:string; targetTokens?:number; onPlayAgain?:()=>void; onReturnToLobby:()=>void; players?:PlayerPublic[]; isHost?:boolean; requestError?:string|null; isRequesting?:boolean; }
export const MatchResultModal: React.FC<MatchResultModalProps> = ({ isOpen, championName, targetTokens=4, onPlayAgain, onReturnToLobby, players=[], isHost=false, requestError, isRequesting=false }) => <AnimatePresence>{isOpen && <Overlay as={motion.div} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Sheet as={motion.section} initial={{scale:.96,y:20}} animate={{scale:1,y:0}} exit={{scale:.96,y:20}}>
  <Eyebrow>매치 종료</Eyebrow><Title><Crown size={20}/>{championName} 최종 우승</Title><Description>목표 호감도 {targetTokens}점을 가장 먼저 달성했습니다.</Description>
  <Ranking>{[...players].sort((a,b)=>b.tokens-a.tokens).map((p,index)=><RankRow key={p.id}><span>{index+1}. {p.nickname}</span><strong>{p.tokens}점</strong></RankRow>)}</Ranking>
  <Buttons>{isHost && onPlayAgain && <Primary type="button" disabled={isRequesting} onClick={onPlayAgain}><RotateCcw size={15}/>{isRequesting ? '서버에 요청 중…' : '같은 멤버로 새 매치'}</Primary>}<Secondary type="button" onClick={onReturnToLobby}><LogOut size={15}/> 살롱 로비로</Secondary></Buttons>{!isHost && <Waiting>방장만 새 매치를 시작할 수 있습니다.</Waiting>}{requestError && <ErrorText>{requestError}</ErrorText>}
</Sheet></Overlay>}</AnimatePresence>;
const Overlay=styled.div`position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;background:rgba(9,13,22,.76);backdrop-filter:blur(7px);`;
const Sheet=styled.div`width:min(440px,100%);max-height:90dvh;overflow:auto;padding:22px;box-sizing:border-box;text-align:center;border:1.5px solid ${THEME.gold};border-radius:16px;background:#fff;background-image:${THEME.gradients.marbleSlab};`;
const Eyebrow=styled.div`font-size:10px;font-weight:900;letter-spacing:.1em;color:${THEME.goldAntique};`;
const Title=styled.h2`margin:7px 0 4px;display:flex;justify-content:center;align-items:center;gap:6px;font:900 20px ${THEME.font.serif};color:${THEME.burgundy};`;
const Description=styled.p`margin:0 0 14px;font-size:12px;color:${THEME.mutedForeground};`;
const Ranking=styled.div`display:flex;flex-direction:column;gap:4px;margin-bottom:15px;`;
const RankRow=styled.div`display:flex;justify-content:space-between;padding:8px 10px;border:1px solid ${THEME.border};border-radius:7px;background:rgba(255,255,255,.7);font-size:11px;`;
const Buttons=styled.div`display:flex;flex-direction:column;gap:7px;`;
const Primary=styled.button`height:41px;display:flex;gap:6px;align-items:center;justify-content:center;border:1px solid ${THEME.goldAntique};border-radius:8px;background:${THEME.gradients.goldShimmer};font:900 13px ${THEME.font.serif};cursor:pointer;&:disabled{opacity:.6;cursor:wait;}`;
const Secondary=styled.button`height:38px;display:flex;gap:6px;align-items:center;justify-content:center;border:1px solid ${THEME.border};border-radius:8px;background:#fff;color:${THEME.foreground};font:800 12px ${THEME.font.sans};cursor:pointer;`;
const Waiting=styled.p`margin:10px 0 0;font-size:11px;color:${THEME.mutedForeground};`;
const ErrorText=styled.p`margin:8px 0 0;font-size:11px;color:${THEME.destructive};font-weight:700;`;
