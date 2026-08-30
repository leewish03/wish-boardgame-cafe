# [Task Tracker] Wish Boardgame Cafe - Love Letter 전면 재구축 및 런타임 통합

| Priority | Task Description | Status | Owner | Evidence |
|---|---|---|---|---|
| P0-1 | xstate 패키지 설치 및 Socket.IO connectionStateRecovery 활성화 | ✅ Completed | Dev / CTO | `package.json` (xstate v5), `server.js` (connectionStateRecovery: 2min) |
| P0-2 | `server.js`에 `LoveLetterService` 및 공유 프로토콜 실시간 소켓 통합 | ✅ Completed | Server Dev | `server.js` `createLoveLetterService(io)` 마운트 |
| P0-3 | `src/index.jsx`를 `AppRouter.tsx`로 완전 전환 및 소켓 이벤트 규격 일치화 | ✅ Completed | Frontend Dev | `src/index.jsx` -> `src/app/AppRouter.tsx` (Vite bundle 393 kB) |
| P0-4 | WebRTC P2P 음성 통화 & Web Speech API 한국어 STT 신규 UI 이식 | ✅ Completed | Fullstack Dev | `AppRouter.tsx`, `GameHud.tsx` (마이크/스피커/STT 토글), `PlayerSeat.tsx` (VAD 링/말풍선) |
| P1-1 | Framer Motion 모바일 카드 드래그 & `ActionStage` 실제 드롭 판정 물리학 구현 | ✅ Completed | Motion Dev | `GameCard.tsx` (`drag="y"`), `ActionStage.tsx` (Dropzone Highlight) |
| P1-2 | 8종 카드별 고유 공간 비주얼 시퀀스 (투사체 빔, 투시, 결투 충돌, 교환, 샤터) | ✅ Completed | Motion Dev | `SpatialMotionStage.tsx` (경비병 레이저 빔, 남작 결투 오버레이, 샤터 이펙트) |
| P1-3 | `useActionTimeline` 실시간 액션 큐 마운트 (1.1s 시간축 분리 보장) | ✅ Completed | Architecture | `useActionTimeline.ts` -> `LoveLetterGame.tsx` 마운트 |
| P2-1 | 10-Match 멀티플레이 AI 실전 E2E 시뮬레이션 및 AST/빌드 전수 검증 | ✅ Completed | QA Lead | `tests/full_game_ts_simulation.test.js` (10 Matches / 0 Deadlocks, 0 Errors) |
| P2-2 | 레거시 모놀리스 파일 정리 및 최종 프로덕션 검증 | ✅ Completed | Orchestrator | Vite 빌드 (`dist/assets/index-BEgf-aN3.js` 393.09 kB 번들링 성공) |
