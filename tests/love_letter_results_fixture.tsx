import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RoundResultModal } from '../src/games/love-letter/ui/RoundResultModal';
import { MatchResultModal } from '../src/games/love-letter/ui/MatchResultModal';
import { LoveLetterGame } from '../src/games/love-letter/ui/LoveLetterGame';
import { CARD_DEFINITIONS } from '../packages/love-letter-core/src/cards';
import type { PlayerPublic, GameState } from '../packages/love-letter-core/src/types';
const params = new URLSearchParams(location.search);
const host = !params.has('guest');
const players: PlayerPublic[] = Array.from({length:params.has('six')?6:4},(_,i)=>({id:`p${i}`,nickname:params.has('long') ? `아주긴플레이어이름함께하는보드게임살롱${i}` : `플레이어 ${i+1}`,tokens:[4,2,2,0,0,0][i],isHost:i===0,cardCount:1,isEliminated:false,isProtected:false,discardPile:[]}));
function Fixture(){
 const [open,setOpen]=useState(true);
 const [pending,setPending]=useState(false);
 const [status,setStatus]=useState('READY');
 const next=()=>{setPending(true);setStatus('ADVANCE_REQUESTED');};
 const leave=()=>{setOpen(false);setStatus('LEFT');};
 const state: GameState={matchState:params.has('match')?'GAME_OVER':'ROUND_END',playPhase:'ROUND_END',roundNumber:2,config:{targetTokens:4,turnTimeoutSeconds:0,maxPlayers:4,minPlayers:2},players,secrets:{},deck:[],setAsideCard:null,currentTurnPlayerId:null,turnStartedAt:0,turnExpiresAt:0,lastAction:null,stateVersion:10,matchWinnerId:'p0',roundWinnerIds:['p0'],outcome:{kind:'ROUND',reason:'DECK_EXHAUSTED',winnerIds:['p0'],scores:{p0:4,p1:2,p2:2,p3:0}}};
 return <><header><h1>격리 QA · 결과 표시 전용</h1><output>{status}</output></header>{params.has('integrated') ? <LoveLetterGame gameState={state} myUserId={host?'p0':'p1'} myHand={[]} isPaused={params.has('paused')} pausedPlayerName="연결이 끊긴 참가자" onLeave={leave}/> : params.has('match') ? <MatchResultModal isOpen={open} championName={players[0].nickname} localUserId={host?'p0':'p1'} players={players} isHost={host} onPlayAgain={next} onReturnToLobby={leave} isRequesting={pending} requestError={params.has('error')?'요청을 처리하지 못했습니다. 다시 시도해 주세요.':null} reason={params.has('insufficient')?'INSUFFICIENT_HUMANS':null}/> : <RoundResultModal isOpen={open} roundNumber={2} winnerName={players[0].nickname} localUserId={host?'p0':'p1'} players={players} winnerIds={params.has('six')?players.map(player=>player.id):['p0','p1']} isHost={host} onNextRound={next} onLeave={leave} isRequesting={pending} winnerReason="DECK_EXHAUSTED" previousScores={{p0:3,p1:1,p2:2,p3:0}} winnerCards={{p0:{...CARD_DEFINITIONS[8],id:'public-princess',value:8},p1:{...CARD_DEFINITIONS[8],id:'public-princess-2',value:8}}} canAdvanceAt={params.has('deadline')?Date.now()+2500:undefined}/> }</>;
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Fixture/>);
