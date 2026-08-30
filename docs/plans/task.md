| Task | Description | Status | Evidence |
| :--- | :--- | :--- | :--- |
| Task 1 | 3분 일시정지 중 재접속(reconnect) 0초 즉각 복구 & 1초 하트비트 동기화 (`server/shared/roomManager.js`, `server/games/love-letter.js`, `src/shared/useSessionGuard.js`) | completed | `npm test` Unit Test 3 & 4 통과, `room:resumed` 즉시 브로드캐스트 |
| Task 2 | 2인전 3장 오픈 제거 룰 삭제 & 백엔드/프론트엔드 동기화 (`server/games/love-letter.js`, `LoveLetterBoard.jsx`) | completed | `npm test` Test 6 통과 및 덱 UI 간소화 |
| Task 3 | 색상 미니멀리즘(카라라 대리석+골드 단일화), 손패 텍스트 말줄임 전문 노출, 중앙 메시지 겹침 해소 (`LoveLetterBoard.jsx`) | completed | 무지개 보더 제거, `StickyTurnRibbon` 상단 분리, 말줄임 해소 |
| Task 4 | 사이드 드로어(설정/가이드) 전면 리디자인 (구식 이모지 삭제, 럭셔리 토글 스위치 도입) (`LoveLetterBoard.jsx`, `components.jsx`) | completed | Lucide 아이콘 및 대리석 카드 도감 박스 적용 |
| Task 5 | 1~8번 액션 결과 브로드캐스트 & 풀 모션 애니메이션 시스템 구축 (`ActionVisualizer.jsx`, `LoveLetterBoard.jsx`) | completed | `ActionVisualizer` 생성 및 실시간 액션 연출 연동 |
| Task 6 | 4-Layer 자동화 테스트(`npm test`) 및 Vite 프로덕션 빌드 검증 후 Git 배포 | completed | `npm test` 100% 통과, `npm run build` 성공, GitHub master push |
