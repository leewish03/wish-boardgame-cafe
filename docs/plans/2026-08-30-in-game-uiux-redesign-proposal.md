# 🏛️ Wish Boardgame Salon: 인게임 UI/UX 전면 개편안
> **"Private VIP Marble Salon" — 초보자도 1초 만에 인지하는 최고급 미니멀 인터페이스**

---

## 1. 개요 및 디자인 철학 (Design Paradigm)

기존 인게임 UI는 러브레터 카드 8종마다 제각각인 원색(파랑, 보라, 초록, 주황 등) 테두리, 중앙 영역에 겹치는 안내 메시지(THINKING..., 덱 슬롯, 말풍선, 타겟팅 배너), 손패 설명 텍스트의 말줄임(`...`), 사이드 메뉴의 구식 이모지로 인해 시각적 피로도와 난잡함이 존재했습니다.

본 개편안은 **"Monochrome Italian Carrara Marble & Hairline Brass"** 원칙에 따라, 다음 6대 혁신을 단행합니다:
1. **1초 인지 3단 레이아웃 (1-Second Cognition Flow):** 내 손패 / 상대 상태 / 현재 턴 / 다음 액션의 완벽한 분리.
2. **컬러 미니멀리즘 (Color Minimalism):** 무지개 원색을 100% 제거하고, 화이트 카라라 대리석 슬랩과 샴페인 골드 헤어라인 프레임으로 단일화.
3. **노-트렁케이션 카드 엔진 (No-Truncation Text Layout):** 폰트/패딩/심볼 크기 최적화를 통해 손패에서 8종 카드 효과 전문이 잘림 없이 100% 노출.
4. **중앙 충돌 제로화 (Collision-Free Center Table):** 턴 바를 상단 고정 슬림 리본으로 분리하고, 중앙 펠트는 덱 슬롯과 카드 애니메이션 전용 공간으로 정돈.
5. **2인전 제거 카드 UI 완전 삭제 (Deck Simplification):** 덱 장수만 미니멀하게 표시.
6. **럭셔리 사이드 드로어 (Boutique Salon Drawer):** 이모지를 전면 삭제하고 Lucide 벡터 아이콘과 슬림 브라스 스위치 토글 적용.

---

## 2. 1초 인지 3단 정보 구조 (Information Architecture)

```
+-------------------------------------------------------------------------+
| [TOP BAR: 38px]  Round 1/4 (Gold Badge)           [STT] [Settings] [Exit] |
+-------------------------------------------------------------------------+
| [1. OPPONENTS SEATS: 20%]                                               |
|  +--------------------+  +--------------------+  +--------------------+ |
|  | [Avatar] [TurnGlow]|  | [Avatar]           |  | [Avatar]           | |
|  | Nickname           |  | Nickname           |  | Nickname           | |
|  | ⚖ 2/4  🃏1  🌸보호  |  | ⚖ 1/4  🃏1         |  | ⚖ 0/4  🃏0  ☠️탈락   | |
|  | Discard: [1][4]    |  | Discard: [2]       |  | Discard: [8]       | |
|  +--------------------+  +--------------------+  +--------------------+ |
+-------------------------------------------------------------------------+
| [STICKY TURN RIBBON: 28px]                                              |
|  ✨ YOUR TURN: 사용할 카드를 터치하여 선택하세요 (Gold Hairline Glow)    |
+-------------------------------------------------------------------------+
| [2. CLEAN CENTER TABLE: 22%]                                            |
|                                                                         |
|                         [ DECK: 13장 ]                                  |
|                   (Carrara Marble Deck Slab)                            |
|                                                                         |
|                 (Card Play Animation Runway)                            |
+-------------------------------------------------------------------------+
| [3. MY PLAY & HAND AREA: 48%]                                           |
|  My Status: ⚖ 1/4 (내 토큰)                     내 낸 패: [1][3] (+2)     |
|                                                                         |
|     +-----------------------+       +-----------------------+           |
|     | (1) Guard      [🛡️]   |       | (7) Countess   [🌹]   |           |
|     | 경비병                |       | 백작부인              |           |
|     | 상대 1명을 지목하여   |       | 손에 왕자(5)나 국왕   |           |
|     | 2~8번 카드를 추측.    |       | (6)이 함께 있을 경우, |           |
|     | 일치 시 상대 즉시탈락!|       | 반드시 먼저 사용!     |           |
|     +-----------------------+       +-----------------------+           |
|                                                                         |
|  [ACTION BAR: 42px]                                                     |
|  [  ✨ [경비병 (1)] 카드 사용하기 - 대상을 선택하세요  ] (Obsidian/Gold) |
+-------------------------------------------------------------------------+
```

---

## 3. 핵심 6대 개편 상세 기획

### 1) 컬러 미니멀리즘: 카라라 대리석 슬랩 & 샴페인 골드 단일화
- **기존 문제:** 경비병(파랑), 사제(보라), 남작(진보라), 하녀(초록), 왕자(주황), 국왕(갈색), 백작부인(자주), 공주(빨강) 등 산만한 원색 테두리로 살롱의 고급스러움 저해.
- **개편 사양:**
  - **베이스 슬랩:** 화이트 카라라 대리석 텍스처 (`#ffffff` 베이스 + 은은한 스톤 결)
  - **프레임:** 0.5px 더블 헤어라인 샴페인 브라스 인레이 (`#c5a059`, `rgba(197, 160, 89, 0.45)`)
  - **숫자 엠블럼:** 앤틱 골드/옵시디언 씰 (모든 카드 100% 동일한 고급 마감)
  - **카드 구분:** 서체(`Cinzel` & `Noto Serif KR`), 정제된 흑백/골드 라인 엠블럼, 번호로 격조 있게 구분.

### 2) 노-트렁케이션 카드 엔진: 손패 설명 전문 100% 노출
- **기존 문제:** `height: 148px`에 2rem 이모지가 차지하는 공간이 커서 `-webkit-line-clamp: 2`로 설명 텍스트가 잘려 초보자가 카드 효과를 알 수 없음.
- **개편 사양:**
  - **슬랩 규격:** 가로 `132px` × 세로 `164px` (모바일 화면 비율에 최적화)
  - **상단 헤더:** 22px 높이로 압축 (좌측 골드 넘버 씰 + 우측 영문 명칭)
  - **중앙 심볼:** 1.25rem의 정갈한 라인 아트 심볼 (세련된 세로 20px 영역)
  - **카드명 & 본문:**
    - 카드명: `13px`, `font-weight: 800`, `letter-spacing: -0.02em`
    - 설명 전문: `font-size: 9.5px`, `line-height: 1.35`, `color: #334155`, **말줄임 없음 (`overflow: visible`, `line-clamp` 완전 제거)**.
    - 최대 4줄의 긴 설명(경비병, 백작부인, 하녀)도 여유롭게 전 문장 표시.

### 3) 중앙 안내 메시지 겹침 해소 (Collision-Free Center)
- **독립 레이어 분리 구조:**
  - **[Layer 1] 글로벌 슬림 턴 리본 (Sticky Turn Ribbon):**
    - 위치: 상단 네비바 직하단 (28px 고정)
    - 내 턴: 샴페인 골드 시머 배경 + `✨ YOUR TURN: 카드를 선택하여 제출하세요`
    - 상대 턴: 은은한 대리석/슬레이트 배경 + `⏳ [플레이어명] 님의 턴: 생각 중...`
  - **[Layer 2] 클린 중앙 펠트 (Center Felt):**
    - 덱 슬롯 단일 컴포넌트 (`DECK 13장`)만 중앙 상단에 깔끔하게 배치.
    - 카드 드로우 / 카드 제출 애니메이션 전용 클린 영역 확보.
  - **[Layer 3] 아바타 내재형 상태 표시:**
    - `THINKING...` 뱃지: 중앙이 아닌 상대방 좌석 카드 내부 펄스 링으로 축소.
    - STT 말풍선: 플레이어 아바타 하단에 툴팁 형태로 단정하게 출력.
  - **[Layer 4] 하단 액션 컨트롤 바 (Action Bar):**
    - 타겟팅 모드 전환 시 중앙 팝업 대신 하단 액션 바가 `🎯 지목할 상대를 터치하세요 (취소)`로 전환.

### 4) 2인 플레이 시 3장 제거 UI 완전 삭제
- **변경 사항:**
  - 덱 슬롯 옆의 `제외: 1, 2, 3` 오픈 카드 표시 영역 전면 제거.
  - 중앙에는 오직 `DECK: {deckCount}장`만 깔끔한 카라라 석판 칩으로 렌더링.

### 5) 사이드 드로어 메뉴 전면 리디자인
- **이모지 완전 삭제 & Lucide 아이콘 전환:**
  - `⚙️ 방 설정 및 게임 가이드` ➔ `<Settings size={16} /> 방 설정 및 살롱 가이드`
  - `🎛️ 음성 통화 설정` ➔ `<Sliders size={15} /> 음성 및 살롱 사운드`
  - `📜 전체 액션 히스토리` ➔ `<History size={15} /> 라운드 액션 로그`
  - `🃏 러브레터 카드 가이드` ➔ `<BookOpen size={15} /> 카드 헤리티지 아카이브 (1~8)`
- **슬림 럭셔리 토글 스위치 적용:**
  - 투박한 원색 버튼 대신 딥 옵시디언 슬레이트 & 샴페인 골드 핀 토글 스위치 도입.
- **카드 가이드 리스트 미니멀화:**
  - 무지개색 좌측 보더 제거 ➔ 카라라 슬랩 바탕 + 골드 넘버 인레이 씰.

---

## 4. 컴포넌트별 styled-components CSS 코드 명세

### 1) 카라라 대리석 손패 카드 (`HandCardSlab`)
```javascript
// 통일된 카라라 대리석 슬랩 & 더블 헤어라인 골드 프레임
const HandCardSlab = styled(motion.div)`
  width: 132px;
  height: 164px;
  border-radius: 12px;
  background-color: #ffffff;
  background-image: 
    radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 1) 0%, rgba(248, 250, 252, 0.95) 100%),
    url('/assets/carrara_marble.jpg');
  background-size: cover;
  background-position: center;
  border: 1px solid #dcdfe4;
  box-shadow: ${({ $isSelected }) =>
    $isSelected
      ? '0 12px 28px rgba(15, 23, 42, 0.16), 0 0 0 2px #c5a059, 0 0 20px rgba(197, 160, 89, 0.4)'
      : '0 4px 14px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)'};
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: ${({ $canPlay }) => ($canPlay ? 'pointer' : 'default')};
  position: relative;
  overflow: hidden;
  user-select: none;
  box-sizing: border-box;
  transform: ${({ $isSelected }) => ($isSelected ? 'translateY(-12px)' : 'translateY(0)')};
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s, border-color 0.22s, opacity 0.2s;

  opacity: ${({ $isRestricted, $isMyTurn }) =>
    $isRestricted ? 0.35 : $isMyTurn ? 1 : 0.5};
  filter: ${({ $isRestricted, $isMyTurn }) =>
    $isRestricted ? 'grayscale(90%)' : $isMyTurn ? 'none' : 'grayscale(30%)'};

  /* Double Hairline Brass Inlay */
  &::after {
    content: '';
    position: absolute;
    inset: 3px;
    border: 1px solid ${({ $isSelected }) => ($isSelected ? '#c5a059' : 'rgba(197, 160, 89, 0.35)')};
    border-radius: 9px;
    pointer-events: none;
    transition: border-color 0.2s;
  }
`;

const CardTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  z-index: 2;
`;

const CardNumberSeal = styled.div`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: ${THEME.gradients.goldShimmer};
  color: #090d16;
  font-family: ${THEME.font.serif};
  font-size: 13px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #ffffff;
  box-shadow: 0 1px 4px rgba(197, 160, 89, 0.4);
  line-height: 1;
`;

const CardEnglishName = styled.span`
  font-family: ${THEME.font.serif};
  font-size: 9px;
  font-weight: 700;
  color: #8c6d31;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

const CardEmblemIcon = styled.div`
  font-size: 1.25rem;
  text-align: center;
  margin: 1px 0;
  filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.1));
  z-index: 2;
`;

const CardBottomBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 2;
`;

const CardKoreanTitle = styled.div`
  font-family: ${THEME.font.serif};
  font-size: 12px;
  font-weight: 800;
  color: #090d16;
  line-height: 1.1;
  letter-spacing: -0.01em;
`;

const CardFullDescription = styled.div`
  font-family: ${THEME.font.sans};
  font-size: 9px;
  font-weight: 500;
  color: #334155;
  line-height: 1.32;
  letter-spacing: -0.02em;
  word-break: keep-all;
  overflow: visible;
`;
```

---

### 2) 상단 고정 슬림 턴 리본 (`StickyTurnRibbon`)
```javascript
const StickyTurnRibbon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  min-height: 28px;
  padding: 0 12px;
  background: ${({ $isMyTurn }) =>
    $isMyTurn
      ? 'linear-gradient(135deg, rgba(254, 240, 138, 0.95) 0%, rgba(197, 160, 89, 0.95) 100%)'
      : 'rgba(255, 255, 255, 0.92)'};
  border-bottom: 1px solid
    ${({ $isMyTurn }) => ($isMyTurn ? '#c5a059' : '#e2e8f0')};
  color: ${({ $isMyTurn }) => ($isMyTurn ? '#090d16' : '#475569')};
  font-family: ${THEME.font.serif};
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.03em;
  gap: 6px;
  box-shadow: ${({ $isMyTurn }) =>
    $isMyTurn ? '0 2px 8px rgba(197, 160, 89, 0.35)' : '0 1px 3px rgba(15, 23, 42, 0.03)'};
  z-index: 90;
  flex-shrink: 0;
  transition: all 0.3s ease;
`;
```

---

### 3) 단일 덱 슬롯 (`MinimalDeckSlab`)
```javascript
const MinimalDeckSlab = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: #ffffff;
  background-image: ${THEME.gradients.marbleSlab};
  border: 1px solid #c5a059;
  border-radius: 8px;
  padding: 4px 12px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05), inset 0 0 0 1px rgba(197, 160, 89, 0.25);
  cursor: pointer;
  user-select: none;
  transition: transform 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(197, 160, 89, 0.3);
  }
`;

const DeckLabel = styled.span`
  font-family: ${THEME.font.serif};
  font-size: 10px;
  font-weight: 800;
  color: #8c6d31;
  letter-spacing: 0.06em;
`;

const DeckCountNumber = styled.span`
  font-family: ${THEME.font.sans};
  font-size: 13px;
  font-weight: 900;
  color: #090d16;
`;
```

---

### 4) 럭셔리 사이드 드로어 토글 스위치 (`LuxurySwitch`)
```javascript
const SwitchContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: border-color 0.15s;

  &:hover {
    border-color: #c5a059;
  }
`;

const SwitchLabelBlock = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #090d16;
  font-size: 12px;
  font-weight: 700;
`;

const ToggleTrack = styled.button`
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background-color: ${({ $active }) => ($active ? '#090d16' : '#e2e8f0')};
  border: 1px solid ${({ $active }) => ($active ? '#c5a059' : '#cbd5e1')};
  position: relative;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  outline: none;

  &:focus-visible {
    box-shadow: 0 0 0 2px #c5a059;
  }
`;

const ToggleThumb = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${({ $active }) =>
    $active ? THEME.gradients.goldShimmer : '#ffffff'};
  position: absolute;
  top: 2px;
  left: ${({ $active }) => ($active ? '20px' : '2px')};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
`;
```

---

## 5. 전/후 비교 요약 (Before & After Matrix)

| 구분 | AS-IS (기존 문제점) | TO-BE (개편안) | 기대 효과 |
| :--- | :--- | :--- | :--- |
| **카드 색상 체계** | 8종 카드마다 파랑, 보라, 초록 등 무지개색 테두리 난립 | 화이트 카라라 대리석 슬랩 + 골드 헤어라인 프레임으로 100% 통일 | 통일된 럭셔리 살롱 무드 완성, 시각적 피로도 0% |
| **손패 설명 텍스트** | 높이 부족 및 `-webkit-line-clamp: 2`로 설명 말줄임(`...`) 발생 | 심볼 축소 및 최적 비율 패딩 조율로 설명 전문 100% 표시 | 초보자가 1초 만에 카드 효과 완벽 이해 |
| **중앙 안내 메시지** | THINKING, 덱 슬롯, STT 말풍선, 팝업 배너가 중앙에 겹침 | 상단 고정 1줄 턴 리본 + 클린 펠트 테이블로 레이어 완전 분리 | 시각적 충돌 및 난잡함 완벽 해소 |
| **2인전 제거 UI** | 덱 슬롯 옆 `제외: 1, 2, 3` 오픈 카드 난잡한 렌더링 | 제외 카드 UI 전면 삭제, 오직 심플한 `DECK: 13장` 칩만 노출 | 핵심 정보에 집중하는 미니멀리즘 극대화 |
| **사이드 드로어** | `⚙️`, `📜`, `🛡️`, `🎛️` 등 구식 이모지 다수 사용 | Lucide 벡터 아이콘 + 샴페인 골드 헤어라인 + 럭셔리 토글 스위치 | 최고급 VIP 살롱에 걸맞은 인터페이스 정체성 확립 |

---

## 6. 개발 적용 가이드 (Implementation Steps)

1. **`src/games/love-letter/LoveLetterBoard.jsx` 리팩토링:**
   - `CARD_DATA` 색상 의존성 제거 및 카라라/골드 단일 슬랩 스타일 적용.
   - `CardDescSnippet`의 line-clamp 제거 및 컴팩트 레이아웃(`HandCardSlab`) 교체.
   - 상단 `StickyTurnRibbon` 삽입 및 중앙 `CenterTurnBanner`, `TargetingBanner` 레이어 정리.
   - `setAsideOpenCards` 렌더링 블록 삭제.
   - `SideDrawer` 내부의 이모지를 Lucide 아이콘 및 `SwitchContainer` 토글로 전면 교체.
2. **`src/shared/theme.js` & `src/shared/components.jsx` 보강:**
   - `AffectionTokenBadge`, `Badge`, `Card` 컴포넌트의 이모지 의존 제거 및 정밀 브라스 인레이 스타일 강화.
3. **검증 및 빌드 테스트:**
   - `npm run build`를 통한 빌드 무결성 확인 및 모바일/데스크톱 뷰포트 반응형 검증.
