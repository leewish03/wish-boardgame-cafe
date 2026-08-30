| Task | Description | Status | Evidence |
| :--- | :--- | :--- | :--- |
| Task 1 | 서버 세션 토큰 및 3분 일시정지/재접속 엔진 구현 (`server/shared/roomManager.js`) | completed | 세션 토큰 발급, room:reconnect, disconnect 3분 유예, room:forfeit 구현 완료 |
| Task 2 | 러브레터 룰 엔진 일시정지/재개 타이머 연동 (`server/games/love-letter.js`) | completed | pauseGameTimer, resumeGameTimer, handleForfeitedPlayer 구현 완료 |
| Task 3 | 클라이언트 세션 가드 훅 (`src/shared/useSessionGuard.js`: WakeLock, beforeunload, visibility, localStorage) 구현 | completed | Screen Wake Lock, beforeunload, visibilitychange, pageshow, focus, online, localStorage 유틸 구현 완료 |
| Task 4 | UI 일시정지 오버레이 및 나가기 확인 모달 구현 (`components.jsx`, `LoveLetterBoard.jsx`) | completed | PauseOverlay 3분 카운트다운(MM:SS) 및 ForfeitModal 다이얼로그 구현 완료 |
| Task 5 | 프론트엔드 앱 셸 자동 재접속 연동 (`src/App.jsx`) | completed | 앱 시작 시 loadSession 자동 복구, useSessionGuard 연동 완료 |
| Task 6 | 재접속 단위 테스트 작성 및 Vite 빌드, Git 커밋/푸시 검증 | completed | tests/love_letter_rules.test.js 5/5 PASS, tests/reconnection.test.js 5/5 PASS, npm run build 성공, Git 푸시 완료 |
