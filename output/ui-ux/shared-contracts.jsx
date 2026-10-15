import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import styled, { createGlobalStyle } from 'styled-components';
import { GameAction, GameShell, ResultDialog } from '../../src/shared/GameSurface';
import GameScreenControls from '../../src/shared/GameScreenControls';
import { useDialogFocus } from '../../src/shared/useDialogFocus';
import { THEME } from '../../src/shared/theme';

const Global = createGlobalStyle`body{margin:0;background:${THEME.background};color:${THEME.foreground};font:14px ${THEME.font.sans};}*{box-sizing:border-box;}button{font:inherit;}dialog{color:${THEME.foreground};}h1{font-size:20px;}label{display:inline-flex;gap:8px;align-items:center;min-height:44px;}input{width:20px;height:20px;}`;
const FixtureHeader=styled.div`padding:12px;border-bottom:1px solid ${THEME.border};display:flex;align-items:center;flex-wrap:wrap;gap:8px;h1{margin:0;}`;
const Choices=styled.div`display:flex;flex-wrap:wrap;gap:8px;padding:12px;`;
const Ranking=styled.ol`list-style:none;padding:0;margin:0;li{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:8px;align-items:center;padding:12px 0;border-bottom:1px solid ${THEME.border};}strong{font-variant-numeric:tabular-nums;}span{overflow-wrap:anywhere;}`;
const Legacy=styled.section`position:fixed;inset:40px;background:white;padding:12px;z-index:10;border:1px solid ${THEME.border};`;

function Fixture(){
  const [open,setOpen]=useState(false),[host,setHost]=useState(true),[empty,setEmpty]=useState(false);
  const [error,setError]=useState(''),[mandatory,setMandatory]=useState(false),[legacy,setLegacy]=useState(false);
  const [count,setCount]=useState(0);
  const leave=useRef(null),legacyRef=useDialogFocus(legacy,()=>setLegacy(false));
  return <><Global/><GameShell style={{height:'100dvh'}} aria-label="공유 컴포넌트 시험"
    header={<FixtureHeader><h1>살롱 결과 컴포넌트</h1><GameAction onClick={()=>setOpen(true)}>결과 열기</GameAction><GameAction onClick={()=>setLegacy(true)}>기존 패널 열기</GameAction></FixtureHeader>}
    actions={<FixtureHeader><span>배경 작업 {count}회</span><GameAction onClick={()=>setCount(n=>n+1)}>배경 버튼</GameAction></FixtureHeader>}>
    <Choices><label><input type="checkbox" checked={host} onChange={e=>setHost(e.target.checked)}/>방장</label>
      <label><input type="checkbox" checked={empty} onChange={e=>setEmpty(e.target.checked)}/>빈 결과</label>
      <label><input type="checkbox" checked={mandatory} onChange={e=>setMandatory(e.target.checked)}/>닫기 제한</label>
      <GameAction onClick={()=>setError('요청을 완료하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.')}>오류 표시</GameAction>
      <GameAction onClick={()=>setError('')}>오류 지우기</GameAction></Choices>
    <p style={{padding:12}}>10명, 공동 순위, 긴 한글 이름을 표시하는 로컬 시험 화면입니다.</p>
  </GameShell>
  <ResultDialog open={open} title="공동 우승 · 마지막 라운드 결과" eyebrow="매치 종료"
    description="공개 점수에 따라 공동 순위를 표시합니다." error={error} onClose={mandatory?undefined:()=>setOpen(false)}
    actions={<>{host?<GameAction onClick={()=>setError('요청을 완료하지 못했습니다. 다시 시도해 주세요.')}>같은 멤버로 새 매치</GameAction>:<p>방장이 새 매치를 시작할 때까지 기다립니다.</p>}
      <GameAction $variant="outline" onClick={()=>leave.current.showModal()}>살롱 로비로</GameAction><GameScreenControls/></>}>
    {empty?<p>표시할 공개 순위가 없습니다.</p>:<Ranking>{Array.from({length:10},(_,i)=><li key={i}><b>{i<2?1:i+1}</b><span>{i+1}번 아주긴한글닉네임을사용하는보드게임참가자</span><strong>{i<2?20:20-i}점</strong></li>)}</Ranking>}
  </ResultDialog>
  {legacy&&<Legacy ref={legacyRef} role="dialog" aria-modal="true" tabIndex={-1} aria-label="기존 패널"><h2>기존 패널</h2><GameScreenControls/><GameAction onClick={()=>setLegacy(false)}>기존 패널 닫기</GameAction></Legacy>}
  <dialog ref={leave} aria-label="나가기 확인"><p>결과 화면을 나가시겠습니까?</p><GameAction onClick={()=>leave.current.close()}>계속 보기</GameAction><GameAction onClick={()=>{leave.current.close();setOpen(false);}}>나가기</GameAction></dialog></>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture/></React.StrictMode>);
