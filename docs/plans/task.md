# [Task Tracker] Wish Boardgame Cafe - Love Letter 전면 재구축 마스터 로드맵 (/goal)

| No | Phase & Task | Status | Owner | Evidence |
|---|---|---|---|---|
| T1 | XState `gameInteractionMachine` & `presentationMachine` 실시간 바인딩 | ✅ Completed | Dev / Architecture | `src/games/love-letter/machines/*` |
| T2 | Framer Motion 드래그 앤 드롭 실제 히트박스 판정 (`ActionStage` 충돌 감지) | ✅ Completed | Motion Dev | `GameCard.tsx`, `ActionStage.tsx` (Dropzone Highlight & Snap) |
| T3 | 8종 카드 전용 공간 비주얼 시퀀스 (사제 투시 미러, 남작 대결 충돌, 왕자 버림 와류, 국왕 교환) | ✅ Completed | Motion Dev | `SpatialMotionStage.tsx` (레이저 빔, 남작 결투, 샤터) |
| T4 | 버린 카드 상세 히스토리 뷰어 모달 (`DiscardHistoryModal`) 구현 | ✅ Completed | Frontend Dev | `DiscardHistoryModal.tsx` (실시간 낸 카드 및 설명 뷰어) |
| T5 | Web Audio API 신시사이저 SFX 사운드 전수 연동 (드로우, 제출, 저격, 충돌, 승리) | ✅ Completed | Fullstack Dev | `sfx.js` -> `LoveLetterGame.tsx` (5종 신시사이저 SFX) |
| T6 | 라운드 종료 왁스실 토큰 스탬프 & 매치 우승 샴페인 팡파레 모달 | ✅ Completed | Frontend Dev | `RoundResultModal.tsx`, `MatchResultModal.tsx` |
| T7 | 세션 이탈 3분 유예 `PauseOverlay` 및 0ms 자동 재접속 복구 결합 | ✅ Completed | Server/Client | `useSessionGuard.js`, `PauseOverlay.tsx`, Socket.IO `connectionStateRecovery` |
| T8 | 전체 테스트 파이프라인 전수 실행 (AST, 룰, AI 휴리스틱, 10-Match 시뮬레이션, Vite 빌드) | ✅ Completed | QA Lead | AST 21개 통과, 룰 7/7, AI 5/5, 10-Match 359턴 0에러, Vite 403 kB 번들 |
| T9 | Git 커밋/푸시 및 최종 완료 검증 보고서 (`walkthrough.md`) | ✅ Completed | Orchestrator | GitHub `master` 브랜치 |
