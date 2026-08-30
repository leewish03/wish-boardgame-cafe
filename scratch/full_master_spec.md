<USER_REQUEST>
Wish Boardgame Cafe

Love Letter 전면 재구축 통합 구현 기획서

---

0. 프로젝트 목표

이번 개편의 목표는 기존 사이트를 새 디자인으로 갈아엎는 것이 아니다.

현재 Wish Boardgame Cafe가 가진 시각적 정체성은 유지한다.

현재 디자인 방향:

- Carrara Marble
- White polished surface
- Deep Obsidian
- Champagne Brass
- Burgundy accent
- Jade / Emerald accent
- 클래식 serif typography
- Private VIP Salon
- 밝고 고급스러운 보드게임 살롱

이 디자인 스타일은 유지한다.

개편 대상은 다음이다.

1. 러브레터 게임이 규칙대로 안정적으로 작동하도록 한다.
2. 갑작스러운 연결 끊김과 재접속 실패를 최소화한다.
3. 카드 행동이 너무 빨리 지나가지 않도록 게임 진행과 시각 표현을 분리한다.
4. 내가 무엇을 했는지, 상대가 무엇을 했는지, 그 결과 무엇이 발생했는지를 항상 이해할 수 있게 한다.
5. 현재 난잡한 게임판의 정보 배치를 다시 설계한다.
6. 카드와 액션을 실제 게임 오브젝트처럼 움직이게 한다.
7. 모바일 환경을 최우선으로 설계한다.
8. 기존 거대한 JSX / JS 구조를 TypeScript 기반으로 재구축한다.
9. 러브레터를 먼저 완성한 뒤 다른 게임으로 확장한다.

---

1. 제품 방향

1.1 핵심 제품 성격

Wish Boardgame Cafe는 일반적인 웹 서비스가 아니다.

목표는:

«브라우저에서 친구들과 바로 접속해서 음성 대화를 하며 실제 보드게임처럼 플레이할 수 있는 온라인 보드게임 카페»

이다.

러브레터는 첫 번째 기준 게임이다.

달무티, 라이어게임 등은 러브레터가 충분히 완성되기 전에는 구현하지 않는다.

---

2. 우선순위

개발 우선순위는 반드시 다음 순서를 따른다.

1순위

게임 규칙과 서버 상태 정확성

2순위

연결 안정성과 재접속

3순위

행동의 원인 → 과정 → 결과 전달

4순위

모바일 조작

5순위

게임판 정보 구조

6순위

카드 및 액션 애니메이션

7순위

시각적 polish

즉 예쁜 UI보다 게임이 정상적으로 플레이되는 것이 먼저다.

---

3. 현재 문제 정의

현재 프로젝트에서 확인된 주요 구조적 문제는 다음과 같다.

3.1 서버가 행동 직후 다음 턴까지 너무 빨리 진행한다

현재 카드 효과가 계산되면:

카드 효과 계산
↓
action event 전송
↓
room state broadcast
↓
즉시 다음 플레이어 선택
↓
카드 draw
↓
다시 room state broadcast

가 거의 연속으로 발생한다.

사용자는 행동 결과를 확인하기 전에 다음 턴 상태를 받는다.

그래서:

- 내가 무슨 카드를 냈는지
- 상대가 누구를 지목했는지
- 성공했는지 실패했는지
- 누가 탈락했는지

를 제대로 볼 시간이 없다.

---

3.2 액션 이벤트가 중복된다

현재 서버는 동일한 행동을:

game:action-result
game:action-showcase

두 이벤트로 보낸다.

클라이언트는 두 이벤트를 동일 handler로 처리하고 있다.

따라서 같은 행동이 두 번 처리될 가능성이 있다.

이를 하나의 이벤트로 통합한다.

---

3.3 서버와 클라이언트 상태 이름이 불일치한다

서버 상태는:

PLAYING

인데 일부 클라이언트 애니메이션 조건에서는:

IN_PROGRESS

를 검사한다.

이러한 문자열 오류를 TypeScript 공유 타입으로 제거한다.

---

4. 기술 구조 개편

기존 JSX 파일을 나누는 정도로 끝내지 않는다.

다음과 같이 구조를 새로 만든다.

wish-boardgame-cafe/

apps/

  web/
    src/

      app/

      lobby/

      waiting-room/

      games/
        love-letter/

          ui/

          motion/

          machines/

          hooks/

  server/
    src/

      connection/

      rooms/

      games/
        love-letter/

packages/

  love-letter-core/

  protocol/

  room-store/

  testkit/

---

5. 기술 스택

언어

TypeScript

기존 JavaScript는 단계적으로 제거한다.

---

UI

React + TSX

React는 유지한다.

화면 표현에는 적합하다.

---

Build

Vite 유지

---

스타일

CSS Modules + CSS Variables를 기본으로 권장한다.

현재 styled-components의 디자인 자산은 그대로 보존할 수 있다.

스타일을 전부 한 번에 바꾸지 않는다.

점진적으로 CSS Module로 이동한다.

---

Animation

Framer Motion 유지

---

UI 상태 머신

XState 사용 권장

---

Networking

Socket.IO 유지

---

Game Engine

Pure TypeScript

React, Socket.IO, DOM과 완전히 분리한다.

---

6. Game Core

새로운 핵심:

packages/love-letter-core

구성:

cards.ts
types.ts
state.ts
commands.ts
events.ts
rules.ts
engine.ts
reducer.ts
selectors.ts

---

7. Core 원칙

게임 엔진에는 다음이 존재하면 안 된다.

React
Socket.IO
DOM
Framer Motion
CSS
setTimeout
WebRTC

게임 엔진은 오직:

현재 GameState
+
GameCommand
=
새 GameState
+
GameEvent[]

를 계산한다.

---

8. Command 구조

사용자가 서버에 보내는 것은 Command다.

예:

type GameCommand =
  | {
      type: 'PLAY_CARD';
      playerId: string;
      cardId: string;
    }
  | {
      type: 'SELECT_TARGET';
      playerId: string;
      targetId: string;
    }
  | {
      type: 'GUESS_CARD';
      playerId: string;
      value: number;
    };

---

9. Event 구조

게임 엔진이 발생시키는 결과는 Event다.

예:

type GameEvent =
  | CardPlayedEvent
  | PlayerTargetedEvent
  | CardGuessedEvent
  | CardRevealedEvent
  | PlayerEliminatedEvent
  | CardDiscardedEvent
  | CardDrawnEvent
  | TurnStartedEvent
  | RoundEndedEvent;

---

10. 예시

경비병 성공:

PLAY_CARD
↓
CARD_PLAYED

SELECT_TARGET
↓
PLAYER_TARGETED

GUESS_CARD
↓
CARD_GUESSED
↓
GUARD_SUCCEEDED
↓
CARD_REVEALED
↓
PLAYER_ELIMINATED

UI는 이 이벤트들을 순서대로 표현한다.

---

11. Server Authoritative

게임 규칙의 최종 판단은 서버가 한다.

클라이언트에서 판단할 수 있는 것은 UX용 사전 안내뿐이다.

예:

이 플레이어는 보호 상태라 선택 불가능

를 클라이언트에서도 표시할 수 있다.

그러나 서버에서도 반드시 다시 검증한다.

---

12. 게임 상태

큰 상태:

type MatchState =
  | 'LOBBY'
  | 'PLAYING'
  | 'ROUND_END'
  | 'GAME_OVER';

PLAYING 내부 phase:

type PlayPhase =
  | 'ROUND_START'
  | 'TURN_START'
  | 'TURN_INPUT'
  | 'ACTION_RESOLVING'
  | 'TURN_TRANSITION';

---

13. 서버와 UI 시간축 분리

가장 중요한 구조다.

게임 서버:

논리적 결과 계산

UI:

그 결과를 사람이 이해할 수 있는 속도로 표현

두 시간축을 분리한다.

---

14. Presentation Machine

클라이언트에 별도의 상태 머신을 둔다.

IDLE
↓
CARD_PLAYING
↓
TARGET_REVEAL
↓
EFFECT
↓
RESULT
↓
DISCARDING
↓
SETTLING
↓
IDLE

게임 상태와 애니메이션 상태를 동일하게 취급하지 않는다.

---

15. Action Queue

여러 게임 이벤트가 동시에 와도 순서대로 보여준다.

actionQueue = [
  CardPlayed,
  PlayerTargeted,
  GuardFailed,
  CardDiscarded
]

현재 연출이 진행 중이면 다음 이벤트는 기다린다.

---

16. Event ID

모든 이벤트에 고유 ID를 둔다.

{
  eventId: "evt_123",
  actionId: "action_42",
  stateVersion: 183
}

클라이언트는 이미 처리한 eventId를 다시 처리하지 않는다.

---

17. State Version

모든 서버 상태에:

stateVersion

을 둔다.

예:

현재 client = 183

새 snapshot = 184
→ 적용

새 snapshot = 182
→ 무시

재접속 시 오래된 상태가 새로운 상태를 덮지 못하게 한다.

---

18. Socket Protocol 재설계

현재처럼 수많은 비정형 이벤트를 사용하지 않는다.

큰 구조:

Client → Server

game:command
room:command

Server → Client

game:event
game:snapshot
room:event

---

19. game:event

예:

interface GameEventEnvelope {
  eventId: string;
  actionId: string;
  stateVersion: number;
  timestamp: number;
  event: GameEvent;
}

---

20. game:snapshot

재접속이나 초기 입장 시 사용한다.

interface GameSnapshot {
  roomId: string;
  stateVersion: number;
  serverTime: number;
  game: PublicGameState;
}

---

21. Action 처리 속도

각 카드 행동은 최소 다음 단계로 보여준다.

1. 카드 사용
2. 대상
3. 효과
4. 결과
5. 정리
6. 다음 턴

다음 턴이 즉시 시작되어서는 안 된다.

---

22. 게임판 기본 레이아웃

사용자가 선택한 디지털 카드게임형 구조를 사용한다.

현재 VIP Salon 스타일은 그대로 유지한다.

┌─────────────────────────┐
│ ROUND 2      ♥ 2/4   ☰  │
├─────────────────────────┤
│                         │
│  상대 A   상대 B   상대 C │
│                         │
│─────────────────────────│
│                         │
│      ACTION STAGE       │
│                         │
│         CARD            │
│                         │
│      DECK   DISCARD     │
│                         │
│─────────────────────────│
│                         │
│       현재 행동 안내      │
│                         │
│   [CARD]     [CARD]     │
│                         │
└─────────────────────────┘

---

23. 게임판 디자인 스타일

현재 테마를 유지한다.

Background

Carrara marble

다만 모든 영역을 흰색 panel로 나누지는 않는다.

한 화면에서 marble surface가 자연스럽게 연결되게 한다.

---

Primary Accent

Obsidian

---

Secondary Accent

Champagne Brass

---

Semantic Accent

Burgundy

Emerald

Rose

---

24. UI 단순화

현재 게임판이 난잡한 가장 큰 이유는 너무 많은 작은 UI 요소가 동시에 보인다는 점이다.

기본 화면에 계속 표시할 것은:

- 상대
- 내 패
- 덱
- 현재 행동
- 현재 턴
- 토큰
- 연결 상태

정도다.

---

25. 숨길 정보

다음은 drawer 또는 sheet로 이동한다.

- 전체 게임 로그
- 전체 discard history
- 마이크 상세 설정
- STT 설정
- 게임 규칙
- 카드 가이드
- 사운드 설정
- 방 정보

---

26. Opponent UI

각 상대는 하나의 일관된 Seat 컴포넌트로 만든다.

표시:

Avatar

Nickname

♥ 2

🃏 1

보호 / 탈락 / 연결 끊김

discard pile 전체는 항상 보여주지 않는다.

---

27. Current Turn

현재 턴 플레이어는:

- avatar ring
- 약한 brass highlight
- 이름 강조

정도만 사용한다.

무한 glow/pulse는 제거한다.

---

28. 내 턴

내 턴에는 하단 Hand가 활성화된다.

작은 안내:

카드를 위로 끌어 사용한다

카드 자체가 미세하게 들리는 정도의 visual feedback을 준다.

---

29. 카드 조작

모바일 우선이므로 Drag가 기본이다.

---

Drag 시작

카드가 손에서 들어 올려진다.

scale 1.03
y -8
shadow 증가

---

Drag 진행

Action Stage에 drop 영역 표시.

---

올바른 Drop

카드가 중앙으로 이동한다.

---

잘못된 Drop

카드가 spring으로 원래 자리로 돌아간다.

---

30. Card Interaction Machine

IDLE

DRAGGING

VALID_DROP

SUBMITTING

TARGETING

RESOLVING

SETTLING

DISABLED

---

31. 서버 응답 대기

카드를 중앙에 내려놓은 뒤 바로 손패에서 제거하지 않는다.

SUBMITTING 상태로 유지한다.

---

실패

중앙 카드
↓
손으로 되돌아감
↓
오류 표시

---

성공

중앙 카드
↓
RESOLVING

---

32. 타깃 선택

모달은 최대한 제거한다.

대상이 필요한 카드:

1 경비병
2 사제
3 남작
5 왕자
6 국왕

카드를 중앙에 놓으면 타깃 가능한 상대가 활성화된다.

---

33. 타깃 UI

가능한 상대:

밝은 outline

불가능:

opacity 감소
interaction disabled

선택된 상대:

Champagne brass selection ring

---

34. 경비병

Flow:

경비병 drag
↓
중앙
↓
타깃 선택
↓
카드 숫자 선택
↓
추측 표현
↓
성공/실패
↓
discard

---

Guess Selector

모바일 하단 sheet:

어떤 카드를 가지고 있다고 생각하는가?

2 사제
3 남작
4 하녀
5 왕자
6 국왕
7 백작부인
8 공주

---

성공

추측 카드
↓
실제 카드 공개
↓
MATCH
↓
탈락

---

실패

추측 카드
↓
MISS

상대 실제 카드 공개 없음.

---

35. 사제

카드
↓
상대 선택
↓
짧은 연결 애니메이션

행동자에게만:

상대 카드 공개

다른 사람:

이소원이 민수의 카드를 확인했다

---

36. 남작

Action Stage:

PLAYER A

CARD ?

VS

CARD ?

PLAYER B

결과 이후 탈락한 사람의 카드만 공개한다.

---

37. 하녀

카드 사용:

카드
↓
자기 avatar
↓
shield effect

이후 작은 보호 아이콘만 유지한다.

지속적인 애니메이션은 없다.

---

38. 왕자

왕자
↓
대상 선택
↓
대상 손패
↓
중앙 공개
↓
discard
↓
새 카드 draw

자기 자신도 선택 가능하다.

---

39. 국왕

A CARD BACK
       ↘
         X
       ↗
B CARD BACK

카드가 서로 교환된다.

카드 앞면은 다른 플레이어에게 노출되지 않는다.

---

40. 백작부인

대상 없음.

왕자 또는 국왕을 같이 가지고 있다면 백작부인만 사용 가능하다.

제한된 카드는 직접 disabled 처리한다.

---

41. 공주

공주 중앙 공개
↓
자기 플레이어
↓
탈락

과도한 폭발 효과 대신 명확한 상태 변화가 중요하다.

---

42. 카드 디자인 전면 개선

현재 시각 스타일은 유지하지만 카드 자체는 다시 디자인한다.

카드의 정보 우선순위:

1. 숫자
2. 이름
3. emblem
4. 효과

---

43. 카드 미술 스타일

Emoji 중심 카드에서 벗어난다.

사용:

- Lucide
- Custom SVG
- heraldic emblem

등을 활용한다.

---

44. Card Base

카드 공통:

- Ivory / white marble paper surface
- champagne brass foil frame
- obsidian typography
- subtle burgundy detail
- restrained shadow
- premium serif typography

---

45. 카드마다 완전히 다른 색상을 사용하지 않는다

전체 카드는 같은 세트로 보여야 한다.

차이는:

small accent
emblem
number

정도로 제한한다.

---

46. Animation System

Framer Motion 사용.

공통 motion token:

motionTokens.ts

---

Micro

100–180ms

---

UI transition

160–280ms

---

Card movement

250–500ms

---

Major Action Sequence

600–1600ms

필요에 따라 여러 phase로 나눈다.

---

47. Animation 원칙

사용 목적:

공간 이동
상태 변화
대상 연결
결과 표현
턴 전달

사용하지 않을 목적:

화면을 화려하게 보이게 하기 위해서만

---

48. 턴 타이머

서버가 제공:

turnStartedAt
turnEndsAt
serverTime

클라이언트가 남은 시간을 계산한다.

---

49. 다음 턴 시작

Presentation이 끝나기 전에 다음 플레이어 입력 타이머가 흘러서는 안 된다.

권장 구조:

서버
ACTION_RESOLVED

↓

클라이언트
presentation

↓

서버
TURN_INPUT_OPEN

또는 서버가 presentation minimum interval을 알고 phase를 전환한다.

게임 규칙과 애니메이션 코드는 직접 결합하지 않는다.

---

50. Round End

현재처럼 갑자기 상태가 바뀌지 않는다.

Round 3

민수 승리

마지막 생존자

♥ ♥ ♥ ○

3 / 4

---

51. Round Transition

결과 확인 이후 다음 라운드가 시작된다.

자동 진행 가능.

단 플레이어가 내용을 읽을 수 있는 시간이 확보되어야 한다.

---

52. Match End

별도 결과 화면.

LOVE LETTER

WINNER

민수

♥ ♥ ♥ ♥

[다시 플레이]
[카페로]

---

53. Connection Manager

현재 여러 reconnect 로직을 한 곳으로 통합한다.

useGameConnection()

---

54. Connection State

CONNECTED

TEMPORARILY_DISCONNECTED

RECONNECTING

RESYNCING

FAILED

---

55. Socket.IO 재접속

Socket.IO 자체 reconnect 기능을 기본으로 사용한다.

동시에 여러 "room:reconnect" 호출을 발생시키지 않는다.

---

56. Connection State Recovery

Socket.IO Connection State Recovery를 활성화한다.

복구 성공:

socket state 복원
놓친 packet 복구

---

57. Recovery 실패

Snapshot resync를 한다.

client
↓
SYNC_REQUEST

server
↓
latest GameSnapshot

---

58. 모바일 background

앱이 background로 이동했다고 즉시 플레이어를 탈락시키지 않는다.

짧은 grace period를 둔다.

---

59. 상대 플레이어 연결 끊김

다른 플레이어에게:

민수의 연결을 복구하고 있다…

를 보여준다.

게임판 전체를 에러 화면으로 덮지 않는다.

---

60. 서버 persistence

현재 방 상태가 프로세스 메모리에만 존재하는 문제를 해결할 준비를 한다.

Room Repository abstraction:

interface RoomRepository {
  getRoom(id): Promise<Room | null>
  saveRoom(room): Promise<void>
  deleteRoom(id): Promise<void>
}

---

61. 개발

MemoryRoomRepository

---

62. 운영

persistent implementation을 연결한다.

선택 가능:

PostgreSQL
Supabase
Redis

중 하나.

---

63. 저장할 것

- room
- players
- game state
- round
- turn
- cards
- stateVersion
- session identity

---

64. 저장하지 않아도 되는 것

- 애니메이션 진행률
- hover
- drag 위치
- 열린 drawer
- decorative UI state

---

65. Voice / STT

기능은 유지한다.

그러나 게임 UI에서는 보조 기능이다.

---

66. Voice UI

말할 때:

avatar 주변 작은 voice ring

---

67. STT

말할 때만 작은 말풍선.

오래 남기지 않는다.

---

68. Voice Settings

상단 설정 메뉴 또는 drawer에 넣는다.

---

69. Lobby 전면 개편

현재 디자인 언어를 그대로 사용한다.

---

Entry

Wish Boardgame Cafe

Avatar

Nickname

[입장]

---

Main Lobby

러브레터가 핵심 카드.

LOVE LETTER

방 만들기
방 참가

다른 게임은 준비중으로 작게 표시한다.

---

70. Waiting Room

필수 정보:

- room code
- players
- ready
- bot
- game settings
- connection status
- microphone status

---

71. App 구조

현재 "App.jsx"에 모든 화면을 계속 넣지 않는다.

app/

AppRouter.tsx
EntryScreen.tsx
LobbyScreen.tsx
WaitingRoomScreen.tsx
GameScreen.tsx

React Router를 반드시 넣을 필요는 없다.

화면 state router만 만들어도 된다.

---

72. Game UI 구조

games/love-letter/

ui/

  GameShell/

  GameHud/

  OpponentRail/

  PlayerSeat/

  ActionStage/

  PlayerHand/

  GameCard/

  Deck/

  DiscardPile/

  TargetSelector/

  GuessSelector/

  RoundResult/

  MatchResult/

---

73. Presentation

presentation/

useActionTimeline.ts

actionSequences.ts

motionTokens.ts

ActionRenderer.tsx

---

74. Machines

machines/

gameInteractionMachine.ts

presentationMachine.ts

connectionMachine.ts

---

75. Server 구조

apps/server/src/games/love-letter/

controller.ts

service.ts

serializer.ts

turnCoordinator.ts

---

76. Core 구조

packages/love-letter-core/

cards.ts
types.ts
state.ts
commands.ts
events.ts
rules.ts
engine.ts
selectors.ts

---

77. 테스트 구조

packages/love-letter-core/tests/

guard.test.ts
priest.test.ts
baron.test.ts
handmaid.test.ts
prince.test.ts
king.test.ts
countess.test.ts
princess.test.ts

round.test.ts
match.test.ts

---

78. Socket Integration Test

가짜 함수 테스트가 아니라 실제 Socket.IO client를 여러 개 연결한다.

A 연결
B 연결
C 연결

↓

방 생성

↓

준비

↓

게임 진행

---

79. Full Simulation

AI 플레이어만으로 게임을 수백 회 자동 실행할 수 있도록 testkit을 만든다.

검증:

- deadlock 없음
- impossible state 없음
- 카드 수 보존
- 중복 카드 없음
- 최종 winner 존재
- 턴 progression 정상

---

80. Disconnect Integration Test

게임 중 A socket disconnect

↓

A reconnect

↓

동일 player ID

↓

snapshot resync

↓

게임 계속

---

81. Mobile QA

실제 모바일에서 반드시 확인한다.

- drag
- target
- guess
- bottom sheet
- viewport
- background
- foreground
- 새로고침
- Wi-Fi 변경
- 빠른 연속 터치

---

82. 구현 순서

Phase 0 — Freeze

새 기능 추가 중지.

현재 게임 규칙 테스트 작성.

---

Phase 1 — TypeScript Core

"love-letter-core" 구축.

기존 게임 규칙을 순수 TypeScript로 이전.

---

Phase 2 — Protocol

공유 TypeScript protocol 구축.

---

Phase 3 — New Server Controller

기존 "love-letter.js"에서 Socket.IO와 규칙을 분리.

---

Phase 4 — Game Stability

턴, round, timer, action, bot을 안정화.

---

Phase 5 — Connection

reconnect / recovery / snapshot / stateVersion 구현.

---

Phase 6 — New Client Shell

기존 "LoveLetterBoard.jsx"를 수정하지 않고 새로운 TSX Game Screen 구축.

---

Phase 7 — New UI Layout

현재 VIP Salon 디자인 유지.

게임판 정보 구조만 전면 재설계.

---

Phase 8 — Drag Interaction

카드 drag → submit → target 구현.

---

Phase 9 — Presentation Machine

ActionTimeline 구현.

---

Phase 10 — 8개 카드 연출

순서:

하녀
백작부인
공주
사제
국왕
왕자
남작
경비병

---

Phase 11 — Card Redesign

기존 스타일을 살리면서 카드 자체 품질 개선.

---

Phase 12 — Round / Match Result

완성.

---

Phase 13 — Lobby / Waiting Room

새 구조로 교체.

---

Phase 14 — Voice / STT

재통합.

---

Phase 15 — Mobile QA

실기기 기준 최종 보완.

---

Phase 16 — Legacy Removal

정상 동작 확인 후:

App.jsx
LoveLetterBoard.jsx
기존 love-letter.js

관련 legacy code 제거.

---

83. Antigravity 구현 원칙

Antigravity는 한 번에 전체를 수정하지 않는다.

매 Phase마다:

ANALYZE
↓
PLAN
↓
IMPLEMENT
↓
TEST
↓
BROWSER VERIFY
↓
FIX

순서를 따른다.

---

84. 금지

다음 행동을 금지한다.

1. 기존 거대 JSX에 새 기능 추가
2. 게임 규칙과 애니메이션을 같은 파일에서 처리
3. Socket.IO handler 안에서 모든 게임 규칙 처리
4. arbitrary setTimeout으로 게임 진행 제어
5. UI 상태가 게임 상태를 결정
6. reconnect 로직 여러 군데 분산
7. 같은 action을 여러 이벤트로 broadcast
8. glow/pulse를 계속 추가해서 UX 문제를 덮음
9. build 성공만 보고 완료 선언
10. 모바일 테스트 없이 UI 완료 선언

---

85. 완료 기준

게임

러브레터 전체 규칙이 정상 작동한다.

---

연결

짧은 네트워크 단절 후 게임으로 복귀한다.

---

UX

모든 행동에서 사용자가 다음을 이해할 수 있다.

누가
무슨 카드를
누구에게
무슨 행동을 했고
무슨 결과가 생겼는가

---

속도

행동 결과를 볼 시간 없이 다음 턴이 시작되지 않는다.

---

UI

현재의 고급 VIP Salon 스타일을 유지한다.

다만 게임판의 정보 밀도를 줄이고 위계를 명확하게 한다.

---

모바일

한 손으로 기본 게임 진행이 가능하다.

---

코드

게임 로직이 React와 Socket.IO로부터 분리되어 있다.

---

테스트

게임 코어와 Socket 흐름의 자동 테스트가 존재한다.

---

86. 이번 재구축의 핵심

이번 프로젝트에서 가장 중요한 구조적 변화는 다음이다.

Game Core
=
무슨 일이 일어났는가

Server
=
그 결과를 저장하고 전달한다

Protocol
=
서버와 클라이언트가 같은 언어로 통신한다

Presentation Machine
=
그 결과를 어떤 순서로 보여줄 것인가

React UI
=
그 결과를 화면에 그린다

Framer Motion
=
게임 오브젝트를 움직인다

이 역할이 다시 섞이지 않게 하는 것이 이번 재구축의 가장 중요한 목표다.

---

87. 최종 제품 목표

Wish Boardgame Cafe의 러브레터를 플레이했을 때 사용자가 느껴야 하는 경험은 다음이다.

카드를 직접 끌어낸다.

↓

테이블 중앙에 카드가 놓인다.

↓

대상이 명확히 표시된다.

↓

효과가 진행된다.

↓

성공 또는 실패를 확인한다.

↓

변경된 게임 상태를 이해한다.

↓

카드가 버림패로 이동한다.

↓

다음 플레이어에게 턴이 넘어간다.

이 과정에서 사용자가 게임 로그를 읽지 않아도 무슨 일이 일어났는지 이해할 수 있어야 한다.

동시에 현재 Wish Boardgame Cafe가 가진 Carrara Marble, Obsidian, Champagne Brass 기반의 고급스러운 살롱 분위기는 그대로 유지한다. /goal /using-superpowers /execute-plan /bkit-pdca /antigravity-guide
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-08-31T02:12:39+09:00.

The user has mentioned some items in the form @[ITEM]. Here is extra information about the items that were mentioned by the user, in the order that they appear:

/goal is a [Slash Command]:
The user has marked this task with /goal, indicating that this task is intended to run for a long time without user input, e.g. overnight. You should be extra thorough and only stop when you are confident the goal has been completely fulfilled. The system will force you to continue execution, prompting you to audit your work until completion. Once complete, include <!-- GOAL_COMPLETE --> in your response. If the user explicitly asked to stop or cancel this goal, include <!-- GOAL_CANCELLED --> in your response to cancel the goal.
/using-superpowers is a [Slash Command]:
<SKILL>The user requested you read and use the "using-superpowers" skill. The path to the skill file is:
c:\Users\WISH\Documents\antigravity\busy-darwin\.agent\skills\using-superpowers\SKILL.md</SKILL>
/execute-plan is a [Workflow]:
<SKILL>The user mentioned the (execute-plan) skill. Here are its contents:
Invoke the `.agent/skills/executing-plans/SKILL.md` workflow and follow it exactly as presented to you.</SKILL>
/bkit-pdca is a [Slash Command]:
<SKILL>The user requested you read and use the "bkit-pdca" skill. The path to the skill file is:
C:\Users\WISH\.gemini\config\plugins\bkit-agents-plugin\skills\bkit-pdca\SKILL.md</SKILL>
/antigravity-guide is a [Slash Command]:
<SKILL>The user requested you read and use the "antigravity-guide" skill. The path to the skill file is:
C:\Users\WISH\.gemini\antigravity\builtin\skills\antigravity_guide\SKILL.md</SKILL>
</ADDITIONAL_METADATA>