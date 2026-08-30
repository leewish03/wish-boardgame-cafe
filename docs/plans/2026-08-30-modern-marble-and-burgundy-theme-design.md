# Wish Boardgame Cafe: 모던 대리석(Marble & Onyx) 베이스 및 러브레터 모던 르네상스 테마 상세 설계서

> **확정 일자:** 2026-08-30  
> **기반 레퍼런스:** 
> 1. 화이트 카라라 & 제이드 오닉스 대리석 체스판
> 2. 러브레터 공식 카드 & 버건디 호감 토큰
> **컨셉 방향:** **"Ultra-Modern Luxury Marble & Minimalist Renaissance"**

---

## 1. 디자인 토큰 및 테마 아키텍처

### 1.1 플랫폼 공통: 럭셔리 대리석 & 오닉스 베이스 (Global Marble Base)

```js
export const MARBLE_BASE_THEME = {
  // Marble Surface Textures
  surface: {
    carraraWhite: '#f8fafc',
    carraraLight: '#f1f5f9',
    carraraSubtle: '#e2e8f0',
    onyxJadeVein: 'rgba(52, 211, 153, 0.12)',
    onyxAmberVein: 'rgba(217, 119, 6, 0.08)',
    stoneShadow: 'rgba(15, 23, 42, 0.12)',
    deepSlate: '#0f172a',
  },
  // Metal Accents & Filigree
  accents: {
    champagneGold: '#d4af37',
    antiqueGold: '#c5a059',
    goldLight: '#fef08a',
    goldGlow: 'rgba(212, 175, 55, 0.4)',
    roseWine: '#881337',
    burgundy: '#7b1836',
  },
  // Marble Gradients
  gradients: {
    marbleTable: `
      radial-gradient(ellipse at 50% 30%, #ffffff 0%, #f1f5f9 45%, #e2e8f0 80%, #cbd5e1 100%)
    `,
    marbleTile: `
      linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(241, 245, 249, 0.9) 100%)
    `,
    jadeOnyxTile: `
      linear-gradient(135deg, rgba(236, 253, 245, 0.95) 0%, rgba(209, 250, 229, 0.85) 100%)
    `,
    burgundySeal: `
      linear-gradient(135deg, #9f1239 0%, #7b1836 50%, #4c0519 100%)
    `,
  },
};
```

---

## 2. 화면별 세부 비주얼 명세

### 2.1 공통 쉘 & 로비 & 대기실 (App Shell / Lobby / Room)
- **배경**: 밝고 세련된 화이트 카라라 대리석 슬랩 질감 (은은한 제이드 오닉스 결 그라디언트 + 슬림 샴페인 골드 테두리)
- **카드 & 컨테이너**: 화이트 스톤 텍스처, 미세한 입체 스톤 음영(`box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08)`), 골드 1px 보더
- **텍스트 타이포그래피**: 짙은 슬레이트 차콜 (`#0f172a`, `#1e293b`)과 앤틱 골드 조합으로 압도적인 시인성과 모던함 확보

### 2.2 러브레터 인게임 보드 (LoveLetterBoard)
- **테이블 전체 배경**: 화이트 & 제이드 오닉스 대리석 체스판 질감의 럭셔리 스톤 펠트
- **상대방 좌석**: 대리석 트레이 위에 올려진 입체 좌석 카드 (턴일 때 골드 네온 펄스)
- **손패 카드 (모던 미니멀 르네상스)**:
  - **바탕**: 고급 화이트 카라라 대리석 슬랩
  - **테두리**: 섬세한 슬림 샴페인 골드 1.5px 라인
  - **넘버 & 엠블럼**: 버건디 와인 메달리온에 각인된 고유 르네상스 심볼
  - **카드 뒷면**: 딥 버건디 다마스크 리프 패턴
- **호감 토큰 (Tokens of Affection)**:
  - 실물 사진의 **딥 버건디 왁스 실(Wax Seal) 원형 토큰 (`#7b1836`) + 골드 천칭 ⚖️ 각인**
- **실시간 카드 사용 쇼케이스**:
  - 화이트 대리석 슬랩에 버건디 & 앤틱 골드가 빛나는 대형 팝업 연출

---

## 3. 구현 및 마이그레이션 단계

1. `src/shared/themes/index.js` 테마 정의 및 확장 모듈 생성
2. `src/App.jsx` 글로벌 쉘 / 로비 / 대기실의 대리석 & 오닉스 테마 전면 교체
3. `src/games/love-letter/LoveLetterBoard.jsx` 인게임 테이블, 카드, 토큰, 모달의 모던 대리석 & 버건디 르네상스 테마 전면 교체
4. 4중 자동화 QA 파이프라인 검증 (`npm test`) 및 Vite 빌드/배포
