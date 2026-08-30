# Wish Boardgame Cafe: shadcn/ui 전면 재디자인 설계 문서

> **확정 일자:** 2026-08-30
> **범위:** 프론트엔드 UI 전면 재작성 + 서버 모듈 분리 리팩토링

---

## 1. 확정된 의사결정 요약

| 항목 | 결정 |
|:---|:---|
| 플랫폼 구조 | 단일 페이지 앱 셸 + 게임별 독립 Board 컴포넌트 교체 |
| 로그인 | **없음**. 닉네임 입력 → DiceBear 랜덤 아바타 자동 배정 → 즉시 로비 진입 |
| AI 봇 | **없음** |
| 전적/통계 | **없음** |
| 데이터 저장 | in-memory (서버 재시작 시 초기화) |
| 파일 형식 | `.jsx` (React + Vite) |
| 애니메이션 | `framer-motion` 디펜던시 추가 |
| 음성/STT | WebRTC P2P Full-Mesh + VAD 파동 링 + Web Speech API 한국어 STT |
| 반응형 | 모바일 우선 (360px~) |
| 방 입장 | 방 코드로 입장만 지원 |
| 구현 범위 | 전체 새로 작성 (server + client 모두) |
| 게임 우선순위 | 러브레터 완성 / 달무티·라이어게임은 Coming Soon 플레이스홀더 |

---

## 2. 디자인 시스템: shadcn/ui Dark Zinc + 보드게임 카페 액센트

### 2.1 테마 토큰 (styled-components)

```js
const THEME = {
  // === shadcn/ui Dark Zinc 공식 토큰 ===
  background: '#09090b',        // hsl(240, 10%, 3.9%)
  foreground: '#fafafa',        // hsl(0, 0%, 98%)
  card: '#09090b',              // 카드 배경 (배경과 동일, border로 구분)
  cardForeground: '#fafafa',
  primary: '#fafafa',           // 다크모드 CTA 버튼 (White)
  primaryForeground: '#18181b', // 다크모드 CTA 텍스트 (Black)
  secondary: '#27272a',         // hsl(240, 3.7%, 15.9%)
  secondaryForeground: '#fafafa',
  muted: '#27272a',
  mutedForeground: '#a1a1aa',   // hsl(240, 5%, 64.9%)
  accent: '#27272a',
  accentForeground: '#fafafa',
  destructive: '#7f1d1d',
  destructiveForeground: '#fafafa',
  border: '#27272a',            // 1px 미세 보더
  input: '#27272a',
  ring: '#d4d4d8',

  // === 보드게임 카페 커스텀 액센트 ===
  gold: '#f59e0b',              // 샴페인 골드 (카드 테두리, 승리 강조)
  goldLight: '#fbbf24',
  emerald: '#10b981',           // 에메랄드 (준비 완료, VAD 활성)
  feltGreen: '#064e3b',         // 펠트 테이블 배경
  feltGreenDeep: '#022c22',
  rose: '#f43f5e',              // 탈락/위험
  indigo: '#6366f1',            // 정보/경비병

  // === 반경 ===
  radiusSm: '4px',
  radiusMd: '6px',
  radiusLg: '8px',
  radiusXl: '12px',

  // === 폰트 ===
  fontSans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};
```

### 2.2 공통 컴포넌트 스타일 규칙

- **카드**: `border: 1px solid #27272a`, `border-radius: 12px`, `background: #09090b`
- **버튼 (default)**: `background: #fafafa`, `color: #18181b`, `height: 36px`, `border-radius: 6px`
- **버튼 (outline)**: `border: 1px solid #27272a`, `background: transparent`
- **버튼 (ghost)**: `background: transparent`, hover시 `background: #27272a`
- **다이얼로그**: 오버레이 `rgba(0,0,0,0.8)` + `backdrop-filter: blur(4px)`, 콘텐츠 `max-width: 512px`
- **탭**: `background: #27272a`, 활성 탭 `background: #09090b`, `border-radius: 4px`
- **입력**: `border: 1px solid #27272a`, `background: transparent`, focus시 `ring: #d4d4d8`
- **배지**: `background: #27272a`, `border-radius: 9999px`, `font-size: 12px`

---

## 3. 파일 구조

```
busy-darwin/
├── server.js                          # 앱 셸: Express 부트스트랩, 라우팅, 정적 서빙
├── server/
│   ├── shared/
│   │   ├── roomManager.js             # 방 생성/입장/퇴장/파괴 관리
│   │   ├── webrtcSignaling.js         # WebRTC offer/answer/ice 시그널링
│   │   └── sttBroadcast.js            # STT 텍스트 브로드캐스팅
│   └── games/
│       └── love-letter.js             # 러브레터 룰 엔진 + 소켓 이벤트 핸들러
├── src/
│   ├── index.jsx                      # ReactDOM.render 진입점
│   ├── App.jsx                        # 앱 셸: 닉네임 입력 → 로비 → 게임 상태 라우팅
│   ├── shared/
│   │   ├── theme.js                   # shadcn/ui 테마 토큰 객체
│   │   ├── components.jsx             # 공통 UI (Button, Card, Dialog, Tabs, Drawer, Badge, Input)
│   │   ├── useSocket.js               # Socket.io 연결 커스텀 훅
│   │   ├── useWebRTC.js               # WebRTC P2P 음성통화 + VAD 훅
│   │   ├── useSTT.js                  # Web Speech API 한국어 STT 훅
│   │   └── sfx.js                     # Web Audio API 사운드 신시사이저 유틸
│   └── games/
│       └── love-letter/
│           └── LoveLetterBoard.jsx    # 러브레터 게임 보드 전체 UI
├── tests/
│   └── love_letter_rules.test.js      # 룰 엔진 단위 테스트
├── index.html
├── package.json
└── vite.config.js
```

---

## 4. 화면별 상세 설계

### 4.1 닉네임 입력 화면 (Entry)

앱 진입 시 최초 화면. 로그인 없음.

- **레이아웃**: 전체 화면 중앙 정렬, shadcn Card 컨테이너
- **요소**:
  - 브랜드 로고/타이틀: `🎲 Wish Boardgame Cafe` (골드 액센트)
  - DiceBear 아바타 프리뷰 (64×64, 원형, `border: 2px solid gold`)
  - 아바타 새로고침 버튼 (🎲 아이콘, ghost 버튼)
  - 닉네임 입력 Input (`placeholder: "닉네임을 입력하세요"`)
  - "입장하기" 버튼 (primary, full-width)
- **동작**: 닉네임 입력 → DiceBear seed로 아바타 자동 생성 → "입장하기" 클릭 → 로비 진입
- **모바일**: 패딩 16px, 카드 width 100% max-width 400px

### 4.2 로비 화면 (Lobby)

닉네임 입력 후 진입하는 메인 화면.

- **상단 헤더**:
  - 좌: 브랜드 로고 `☕ Wish Boardgame Cafe`
  - 우: 유저 아바타(24px) + 닉네임 + SFX 토글 아이콘(🔊/🔇)
- **필터 탭** (shadcn TabsList):
  - `[전체 게임]` | `[방 입장]`
  - 탭 배경 `#27272a`, 활성 탭 `#09090b` 흰 텍스트
- **[전체 게임] 탭 - 게임 카드 그리드**:
  - 반응형 그리드: 모바일 1열, 태블릿 2열, 데스크톱 3열
  - 각 게임 카드 (shadcn Card):
    - 게임 아이콘/이모지 (64px, 중앙)
    - 게임명 (CardTitle): "러브레터", "달무티", "라이어 게임"
    - 부가 정보 (CardDescription): `2~6인 · 20분 · 전략/블러핑`
    - 상태 배지: `Live 🟢` 또는 `Coming Soon`
    - Coming Soon 카드: `opacity: 0.5`, 클릭 시 "준비 중입니다!" 토스트
  - 러브레터 카드 클릭 → 게임 전용 로비 다이얼로그 열림
- **[방 입장] 탭**:
  - 6자리 방 코드 입력 Input
  - "입장하기" 버튼

### 4.3 게임 전용 로비 다이얼로그 (Game Lobby Dialog)

로비에서 게임 카드 클릭 시 열리는 shadcn Dialog.

- **다이얼로그 콘텐츠** (max-width 480px):
  - 헤더: 게임 아이콘 + 게임명 + 간단 설명
  - **[방 만들기]** 섹션:
    - 목표 토큰 수 설정 (2~7, 기본 4) - 숫자 버튼 그룹
    - 최대 인원 설정 (2~6, 기본 4)
    - 턴 제한시간 (30초/60초/90초/무제한, 기본 60초)
    - "방 만들기" 버튼 (primary)
  - **[방 코드로 입장]** 섹션:
    - 6자리 코드 입력 + "입장" 버튼
  - **[게임 규칙 보기]** 링크 → 규칙 Drawer 열림

### 4.4 대기실 (Waiting Room)

방 생성/입장 후 게임 시작 전까지의 화면.

- **상단**: 방 코드 (골드 배지, 1-click 복사 📋), 게임 설정 요약 (`4토큰 · 60초 턴`)
- **플레이어 목록** (세로 리스트):
  - 각 플레이어: 아바타(40px) + 닉네임 + 레디 상태 배지(🟢Ready / ⚪대기)
  - 방장 표시: 👑 아이콘
  - 본인: "준비" 토글 버튼 (outline → primary로 변경)
  - 방장: "게임 시작" 버튼 (전원 레디 시 활성화, primary + gold 글로우)
- **하단**: 실시간 텍스트 채팅 영역
  - 입력 Input + Send 버튼
  - 채팅 메시지 목록 (스크롤)
- **게임 규칙 보기**: 접이식 패널/Drawer
- **모바일**: 채팅 영역 height 제한 (40vh), 플레이어 목록 수평 스크롤 가능

### 4.5 러브레터 게임 보드 (LoveLetterBoard)

게임 진행 중 메인 화면. **깨끗한 보드 + 투명 사이드 드로어** 원칙.

#### 메인 보드 영역

- **상단 바**:
  - 좌: 게임명 + 라운드 번호 (`Round 2`)
  - 중앙: 현재 턴 표시 (`🎴 지민의 턴`)
  - 우: 사이드 드로어 토글(📜) + SFX 토글(🔊) + 마이크(🎙️) + 나가기(🚪)
- **상대방 좌석 영역** (상단~중단):
  - 원형 테이블 배치 (2~5명 상대방)
  - 각 좌석: 아바타(48px) + 닉네임 + 토큰 수(⭐×N) + 손패 장수(🃏×N)
  - 하녀 보호 시: 에메랄드 쉴드 아이콘 배지
  - 탈락 시: 흑백 처리 + ☠️ 배지
  - 현재 턴 플레이어: 골드 테두리 글로우 링
  - VAD 발화 감지 시: 에메랄드 파동 링 애니메이션
  - STT 말풍선: 아바타 위 플로팅 버블 (3초 후 페이드아웃)
- **중앙 테이블**:
  - 카드 덱 (뒷면, 남은 장수 숫자 배지)
  - 최근 플레이된 카드 1장 (앞면, framer-motion으로 날아오는 애니메이션)
  - 턴 타이머: 원형 프로그레스 (골드 → 레드 전환)
- **하단 본인 손패 영역**:
  - 3D 부채꼴(Fan-out) 카드 배치 (framer-motion)
    - 1장: 중앙 정렬
    - 2장: -7°, +7° 각도 아크
  - 카드 호버: `translateY(-24px) scale(1.08)` + 골드 글로우 섀도우
  - 카드 클릭: 카드 선택 → 타깃 선택 모달 또는 즉시 제출
  - 각 카드: 번호 + 이름 + 고유 이모지 엠블럼 + 골드 테두리
  - 카드 터치 길게 누르기(모바일): 효과 설명 툴팁 표시

#### 투명 사이드 드로어 (우측 슬라이드인)

📜 토글 아이콘 클릭 시 열리는 반투명 패널. 닫으면 깨끗한 보드만 보임.

- **게임 로그**: 시간순 액션 기록
  - `[14:32] 지민이 경비병(1)을 플레이 → 수현 지목, 사제(2) 추측 → 실패!`
- **버린 카드 목록**: 플레이어별 버린 카드 리스트
- **턴 타이머**: 남은 시간 숫자 표시
- **카드 레퍼런스**: 1~8번 카드 효과 요약 (접이식)

#### 액션 모달들 (shadcn Dialog)

- **경비병(1) 모달**: 타깃 선택 (아바타 그리드) + 카드 번호 추측 (2~8 버튼 그리드)
- **사제(2) 결과**: 글래스모피즘 팝업 - 상대 카드 공개 (4초 자동 닫힘)
- **남작(3) 결과**: 비교 결과 표시 (승/패/무)
- **왕자(5) 모달**: 타깃 선택 (자신 포함)
- **국왕(6) 모달**: 타깃 선택
- **라운드 종료**: 승리자 + 남은 카드 공개 + 토큰 수여 애니메이션
- **최종 우승**: 골드 세레모니 모달 + 팡파레 SFX

---

## 5. Web Audio API 사운드 시스템 (SFX Engine)

외부 파일 없이 `AudioContext` 오실레이터로 합성. 지연시간 < 10ms.

| 이벤트 | 합성 방법 | 길이 |
|:---|:---|:---|
| 카드 드로우 | 화이트 노이즈 → BandpassFilter (2000Hz) → 감쇄 엔벨로프 | 150ms |
| 카드 제출 (탁!) | 사인파 80Hz → 급격한 감쇄 + 화이트 노이즈 스냅 | 100ms |
| 내 턴 알림 | 사인파 880Hz → 1760Hz 2단계 차임 | 300ms |
| 저격 성공 | 사인파 440→880→1320Hz 상승 글리산도 | 400ms |
| 승리 팡파레 | C-E-G-C' 아르페지오 (각 100ms) + 리버브 | 600ms |

모든 사운드에 마스터 볼륨 토글 (On/Off) 적용.

---

## 6. WebRTC + VAD + STT 설계

### 6.1 WebRTC P2P Full-Mesh
- 방 입장 시 각 피어와 `RTCPeerConnection` 수립
- 오디오 전용 (`audio: true, video: false`)
- 서버는 시그널링(offer/answer/ice)만 중계

### 6.2 VAD (Voice Activity Detection)
- `AnalyserNode.getByteFrequencyData()` 기반 볼륨 임계값 감지
- 발화 감지 시 해당 플레이어 아바타에 에메랄드 파동 링 CSS 애니메이션

### 6.3 한국어 STT
- `webkitSpeechRecognition` (`lang: 'ko-KR'`, `continuous: true`)
- `onresult` → Socket.io로 텍스트 브로드캐스트
- 수신 측: 해당 플레이어 아바타 위 플로팅 말풍선 (3초 페이드아웃) + 채팅 로그 자동 기록

---

## 7. 서버 모듈 설계

### 7.1 server.js (앱 셸)
- Express 부트스트랩, CORS, JSON 파싱
- 정적 파일 서빙 (`dist/`)
- Socket.io 서버 생성
- 게임 모듈 등록: `registerLoveLetter(io)`
- 공유 모듈 초기화: `initRoomManager(io)`, `initWebRTCSignaling(io)`, `initSTTBroadcast(io)`
- `/api/health` 엔드포인트

### 7.2 server/shared/roomManager.js
- `rooms` Map 관리 (생성/입장/퇴장/파괴)
- 소켓 이벤트: `room:create`, `room:join`, `room:leave`, `room:ready`, `room:start`
- 방 코드 6자리 영문 대문자 랜덤 생성

### 7.3 server/shared/webrtcSignaling.js
- 소켓 이벤트: `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`
- 같은 방 내 피어 간 시그널링 메시지 릴레이

### 7.4 server/shared/sttBroadcast.js
- 소켓 이벤트: `stt:transcript`
- 같은 방 내 다른 플레이어에게 브로드캐스트

### 7.5 server/games/love-letter.js
- 카드 정의 (1~8번, 장수)
- 덱 생성 + Fisher-Yates 셔플
- 라운드 시작: 1장 제외(set-aside) + 각 플레이어 1장 배분
- 턴 진행: 드로우 → 플레이 → 효과 적용
- 카드 효과 엔진: 경비병 추측, 사제 투시, 남작 비교, 하녀 보호, 왕자 강제 버리기, 국왕 교환, 백작부인 제약, 공주 탈락
- 라운드 종료 판정: 생존자 1명 or 덱 소진 → 최고 카드 비교
- 토큰 수여 + 최종 우승 판정
- 턴 타이머: 제한시간 초과 시 랜덤 카드 자동 제출

### 7.6 엣지 케이스

| 상황 | 처리 |
|:---|:---|
| 경비병 사용 시 모든 상대가 하녀 보호 | 효과 없이 카드만 소비 |
| 왕자로 공주 보유자 지목 | 공주 버려짐 → 해당 플레이어 즉시 탈락 |
| 왕자 사용 시 덱 소진 | set-aside 카드 드로우 |
| 백작부인 + 왕자/국왕 동시 보유 | 백작부인 강제 제출 (선택 불가) |
| 공주 직접 플레이 | 즉시 탈락 |
| 남작 비교 동점 | 무승부 (양쪽 생존) |
| 2인 게임 | 3장 공개 제외 + 1장 비공개 제외 |
| 연결 끊김 | 30초 재접속 대기 → 미복귀 시 탈락 처리 |

---

## 8. 테스트 계획

### 8.1 단위 테스트 (`tests/love_letter_rules.test.js`)
- 덱 생성 카드 수 검증 (2~4인: 16장, 5~6인: 확장)
- 경비병 추측 성공/실패
- 남작 비교 (승/패/무)
- 백작부인 강제 제출 제약
- 공주 탈락 트리거
- 하녀 보호 면역
- 왕자 덱 소진 시 set-aside 드로우
- 라운드 종료 판정 (생존자 1명 / 최고 카드 비교)

### 8.2 빌드 검증
- `npm run build` → Vite 프로덕션 빌드 성공
- `npm start` → 서버 정상 기동
- `npm test` → 모든 단위 테스트 Pass
