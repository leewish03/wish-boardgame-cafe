import React from 'react';
import styled from 'styled-components';
import { Menu, Wifi, WifiOff } from 'lucide-react';
import { THEME } from '../../../shared/theme';

interface GameHudProps { roundNumber:number; myTokens:number; targetTokens:number; turnPlayerNickname:string; isMyTurn:boolean; isConnected?:boolean; onOpenSettings:()=>void; onToggleMic?:()=>void; onToggleSpeaker?:()=>void; onToggleSTT?:()=>void; isMicOn?:boolean; isSpeakerOn?:boolean; isSTTActive?:boolean; }
export const GameHud: React.FC<GameHudProps> = ({ roundNumber, targetTokens, isConnected=true, onOpenSettings }) => <HudContainer>
  <RoundInfo>라운드 {roundNumber} <span>· 목표 {targetTokens}</span></RoundInfo>
  <RightGroup title={isConnected ? '실시간 연결됨' : '연결 끊김'}>{isConnected ? <Wifi size={14}/> : <WifiOff size={14}/>}<MenuButton type="button" onClick={onOpenSettings} aria-label="게임 메뉴"><Menu size={17}/></MenuButton></RightGroup>
</HudContainer>;
const HudContainer = styled.header`height:36px; min-height:36px; display:flex; align-items:center; justify-content:space-between; padding:0 9px; box-sizing:border-box; background:rgba(255,255,255,.96); background-image:${THEME.gradients.marbleSlab}; border-bottom:1px solid ${THEME.border}; color:${THEME.foreground}; flex-shrink:0;`;
const RoundInfo = styled.div`font-family:${THEME.font.serif}; font-size:11px; font-weight:900; letter-spacing:.03em; span{color:${THEME.mutedForeground}; font-family:${THEME.font.sans}; font-weight:700;}`;
const RightGroup = styled.div`display:flex; align-items:center; gap:8px; color:${THEME.mutedForeground};`;
const MenuButton = styled.button`display:grid; place-items:center; width:27px; height:27px; padding:0; border:1px solid ${THEME.border}; border-radius:7px; color:${THEME.primary}; background:#fff; cursor:pointer;`;
