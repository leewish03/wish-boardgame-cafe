# Wish Boardgame Salon: 카드 게임 모션 & 1~8번 액션 시각화 애니메이션 시스템 설계서

> **작성 일자:** 2026-08-30  
> **설계 주체:** bkit-animation-designer (인터랙션 및 모션 그래픽 전문가)  
> **시스템 적용 대상:** Wish Boardgame Salon (러브레터 및 멀티플레이어 보드게임 엔진 전반)  
> **기술 스택:** React 18, Framer Motion v13, Styled-Components v6, HTML5 Canvas Particles, Web Audio SFX

---

## 1. 모션 디자인 철학 및 물리 엔진 토큰 (Motion Physics Foundation)

Wish Boardgame Salon의 애니메이션 시스템은 **"프라이빗 VIP 살롱의 고급스러운 실물 카드 감촉(Tactile Elegance)"**과 **"관전자/상대방 모두에게 한눈에 전달되는 명확한 가시성(Spectator Transparency)"**을 핵심 가치로 삼습니다.

```
                  [ Wish Salon Motion Design Philosophy ]
     ┌─────────────────────────────────────────────────────────────┐
     │ 1. Tactile Weight (물리적 질감): 스프링 물리학 기반 3D 카드 무게감 │
     │ 2. Editorial Clarity (명확한 가독성): 액션 인과관계 100% 직관화 │
     │ 3. Royal Aesthetics (황실 르네상스): 샴페인 골드, 버건디 왁스 씰 │
     │ 4. 60 FPS Smoothness (초경량 GPU 가속): transform & opacity 위주  │
     └─────────────────────────────────────────────────────────────┘
```

### 1.1 모션 타이밍 및 스프링 토큰 (Spring & Easing Tokens)

| 토큰명 | 파라미터 (Framer Motion) | CSS Cubic-Bezier / Keyframe | 용도 |
|:---|:---|:---|:---|
| `SPRING_DRAW` | `{ type: "spring", stiffness: 280, damping: 22, mass: 0.8 }` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 덱에서 손패로 드로우 시 착지 모션 |
| `SPRING_PLAY` | `{ type: "spring", stiffness: 350, damping: 26, mass: 1.0 }` | `cubic-bezier(0.22, 1, 0.36, 1)` | 손패 제출 및 테이블 중앙 쇼케이스 확대 |
| `SPRING_IMPACT` | `{ type: "spring", stiffness: 600, damping: 18, mass: 1.5 }` | `cubic-bezier(0.18, 0.89, 0.32, 1.28)` | 남작 결투 충돌, 승리 왁스 스탬프 타격 |
| `SPRING_DEFLECT` | `{ type: "spring", stiffness: 450, damping: 12, mass: 0.6 }` | `cubic-bezier(0.68, -0.55, 0.27, 1.55)` | 경비병 저격 실패 시 튕겨 나가는 모션 |
| `EASE_REVEAL` | `{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }` | `cubic-bezier(0.16, 1, 0.3, 1)` | 사제 투시 미러 팝업 및 카드 플립 |
| `EASE_VORTEX` | `{ duration: 0.75, ease: [0.7, 0, 0.84, 0] }` | `cubic-bezier(0.7, 0, 0.84, 0)` | 왕자 강제 버림 와류 소용돌이 모션 |
| `EASE_PETAL` | `{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | 백작부인 장미 꽃잎 흩날림 |

---

## 2. 핵심 카드 인터랙션 상세 명세

### 2.1 카드 드로우 연출 (3D Perspective + Spring Flip)
중앙 덱 슬롯에서 뒷면 상태의 카드가 포물선 궤적을 그리며 플레이어의 손패 슬롯으로 3D 회전하며 날아옵니다.

```
 [중앙 덱 슬롯] ─── (3D Perspective Arc: z=120px, rotateY: 180° -> 0°) ───> [내 손패 슬롯]
   (뒷면, 60px)                          (스프링 감속 & 착지 진동)              (앞면 정렬, 120px)
```

#### Framer Motion Variants
```javascript
export const drawCardVariants = {
  initial: (custom) => ({
    x: custom.deckOriginX - custom.handTargetX, // 덱 위치 상대 좌표
    y: custom.deckOriginY - custom.handTargetY,
    z: 150,
    scale: 0.55,
    rotateY: 180, // 카드 뒷면
    rotateZ: -25,
    opacity: 0.3,
    filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.35))',
  }),
  animate: {
    x: 0,
    y: 0,
    z: 0,
    scale: 1,
    rotateY: 0, // 앞면으로 플립
    rotateZ: 0,
    opacity: 1,
    filter: 'drop-shadow(0 4px 16px rgba(15, 23, 42, 0.08))',
    transition: {
      type: 'spring',
      stiffness: 280,
      damping: 22,
      mass: 0.8,
      velocity: 2,
    },
  },
};
```

#### CSS 3D Keyframes & Stagger
```css
.perspective-container {
  perspective: 1200px;
  perspective-origin: 50% 80%;
}

@keyframes drawGlint {
  0% { transform: translateX(-100%) rotate(45deg); opacity: 0; }
  50% { opacity: 0.8; }
  100% { transform: translateX(200%) rotate(45deg); opacity: 0; }
}

.card-draw-shimmer {
  position: absolute;
  top: 0; left: 0; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
  animation: drawGlint 0.6s 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

---

### 2.2 카드 제출 & 타겟팅 연출 (Showcase & Reticle Beam)
카드를 선택하고 제출할 때 손패에서 수직으로 15px 살짝 솟구쳤다가, 중앙 테이블로 부드럽게 글라이딩하며 1.35배 확대됩니다. 카드 테두리에 골드 림(Champagne Brass Rim) 펄스가 작동합니다.

```
 [선택 손패] ──(위로 +15px)──> [중앙 쇼케이스 이동] ──(골드 림 발광 + 135% 확대)──> [타겟 조준 레이저]
```

#### Framer Motion Variants
```javascript
export const cardPlayShowcaseVariants = {
  initial: {
    scale: 0.85,
    y: 60,
    opacity: 0,
    rotateX: 15,
  },
  animate: {
    scale: 1.35,
    y: 0,
    opacity: 1,
    rotateX: 0,
    boxShadow: '0 0 40px rgba(197, 160, 89, 0.6), 0 25px 60px rgba(15, 23, 42, 0.3)',
    transition: {
      type: 'spring',
      stiffness: 350,
      damping: 25,
      mass: 0.9,
    },
  },
  exit: {
    scale: 0.7,
    y: -40,
    opacity: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 1, 1] },
  },
};
```

#### 타겟팅 레이저 빔 (Reticle Targeting Beam SVG)
```jsx
<svg className="absolute inset-0 pointer-events-none w-full h-full z-50">
  <motion.line
    x1={sourceX}
    y1={sourceY}
    x2={targetX}
    y2={targetY}
    stroke="#c5a059"
    strokeWidth="2.5"
    strokeDasharray="6 6"
    initial={{ pathLength: 0, opacity: 0 }}
    animate={{ pathLength: 1, opacity: [0.4, 1, 0.7] }}
    transition={{ duration: 0.35, ease: "easeOut", opacity: { repeat: Infinity, duration: 0.8 } }}
  />
  <motion.circle
    cx={targetX}
    cy={targetY}
    r="22"
    stroke="#c5a059"
    strokeWidth="2"
    fill="rgba(197, 160, 89, 0.15)"
    initial={{ scale: 0 }}
    animate={{ scale: [1, 1.2, 1] }}
    transition={{ repeat: Infinity, duration: 1.0 }}
  />
</svg>
```

---

## 3. 1~8번 카드별 액션 결과 시각화 애니메이션 명세

모든 플레이어(시전자, 피격자, 제3자 관전자)가 직관적으로 상황을 인지할 수 있도록, **중앙 오버레이 + 아바타 반응 + 특수 이펙트**가 1.5초~2.0초 동안 유기적으로 결합됩니다.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      [ 카드 액션 시각화 매트릭스 ]                      │
├─────┬──────────┬──────────────────────┬────────────────────────────────┤
│ 번호 │ 카드명   │ 시각화 핵심 테마      │ 액션 애니메이션 연출            │
├─────┼──────────┼──────────────────────┼────────────────────────────────┤
│  1  │ 경비병   │ 저격 홀로그램 & 판정 │ 🎯 타겟 조준 -> 💥 격파 vs 🛡️ 튕김 │
│  2  │ 사제     │ 성스러운 신탁 & 투시 │ 📜 성스러운 빛무리 -> 🪞 비밀 미러   │
│  3  │ 남작     │ 중앙 결투 & 숫자 격돌 │ ⚔️ 카드 충돌 -> 💥 열세 카드 산산조각 │
│  4  │ 하녀     │ 에메랄드 룬 결계     │ 🌸 룬 궤도 회전 결계 실드 전개      │
│  5  │ 왕자     │ 황실 칙령 & 강제 와류 │ 👑 금빛 소용돌이 -> 패 버림 & 재드로우│
│  6  │ 국왕     │ 황실 인장 & 교차 맞교환│ 🤴 두 패의 3D 포물선 교차 비행       │
│  7  │ 백작부인 │ 우아한 벨벳 장미 낙화 │ 🌹 실크 글라이딩 & 붉은 장미 꽃잎    │
│  8  │ 공주     │ 비극적 하트 파괴      │ 👸 하트 크리스탈 균열 -> 즉시 폭발   │
└─────┴──────────┴──────────────────────┴────────────────────────────────┘
```

---

### 3.1 [1번 경비병 (Guard)] - 저격 성공/실패 듀얼 분기

- **시퀀스 1: 조준 (0.0s ~ 0.4s)**: 타겟 아바타 위에 골드 크로스헤어 락온 + 추측한 카드의 청록색 홀로그램 고스트 카드 팝업.
- **시퀀스 2A: 저격 성공 시 (💥 Crimson Shockwave & Shatter)**:
  - 타겟 아바타에 붉은색 충격파(`scale: 0.8 -> 1.8`, `opacity: 1 -> 0`) 방출.
  - 타겟 손패가 붉은 섬광과 함께 공중 분해되며 `ELIMINATED` 붉은 스탬프 타격.
  - 사운드: 중후한 타격 폭발음 (`sfx.playImpactExplosion()`).
- **시퀀스 2B: 저격 실패 시 (🛡️ Deflect Ricochet)**:
  - 타겟 아바타 앞에 강철 방패 문양이 생성되며, 저격 탄환/화살이 **`탱-!`** 소리와 함께 45도 각도로 튕겨 나감.
  - 타겟 아바타 주변에 은은한 골드 리플 잔상.
  - 사운드: 금속 튕김음 (`sfx.playShieldDeflect()`).

```javascript
// 1번 경비병 저격 성공/실패 Variants
export const guardHoloVariants = {
  initial: { scale: 0, opacity: 0, y: -20 },
  animate: { 
    scale: 1, 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 20 } 
  },
  hit: {
    scale: [1, 1.2, 0],
    filter: 'drop-shadow(0 0 30px #be123c)',
    transition: { duration: 0.35 }
  },
  miss: {
    x: [0, -15, 60],
    y: [0, -10, 40],
    rotate: [0, -20, 60],
    opacity: [1, 0.8, 0],
    transition: { duration: 0.5, ease: [0.68, -0.55, 0.27, 1.55] }
  }
};
```

---

### 3.2 [2번 사제 (Priest)] - 신탁의 빛무리 & 은밀한 미러 투시

- **공통 연출 (전체 관전자)**:
  - 사제 카드에서 성스러운 보랏빛/골드 빛무리 입자가 생성되어 타겟 플레이어에게 전달됨.
  - `👁️ [플레이어] 님이 [대상]의 손패를 은밀히 확인 중...` 펄스 인디케이터 노출.
- **시전자 전용 연출 (Secret Mirror Reveal Modal)**:
  - 시전자 화면 중앙에 양식화된 앤틱 손거울(Mirrored Tablet) 프레임이 부드럽게 떠오름.
  - 타겟의 카드가 안개(Mist)를 걷어내며 선명하게 100% 확대 노출 (`EASE_REVEAL`).
  - 확인 완료 버튼 또는 2.5초 후 자동 페이드아웃.

```javascript
export const priestMirrorVariants = {
  initial: { opacity: 0, scale: 0.8, filter: 'blur(10px)' },
  animate: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    filter: 'blur(8px)',
    transition: { duration: 0.3 }
  }
};
```

---

### 3.3 [3번 남작 (Baron)] - 중앙 결투 & 숫자 격돌 (Clash & Shatter)

- **시퀀스 1: 돌진 (0.0s ~ 0.5s)**: 시전자 카드(좌측)와 타겟 카드(우측)가 중앙을 향해 고속 돌진 (`scale: 1.15`).
- **시퀀스 2: 충돌 (0.5s ~ 0.7s)**: 중앙 좌표에서 **`쾅-!`** 격돌 (`SPRING_IMPACT`), 화면 미세 쉐이크(Screen Shake: 4px), 중앙에서 황금 불꽃 스파크 방출.
- **시퀀스 3: 판정 (0.7s ~ 1.6s)**:
  - **패배자 카드**: 즉시 흑백 반전 후 유리 파편 조각(Glass Shards 16개)으로 산산조각 폭발하며 해당 플레이어 즉시 탈락.
  - **승리자 카드**: 황금빛 테두리 후광과 함께 살롱 덱으로 우아하게 귀환.
  - **무승부 시**: 두 카드가 중앙에서 튕겨 나와 서로의 원위치로 복귀 (`scale: 1.0`).

```javascript
export const baronClashLeftVariants = {
  initial: { x: -220, y: 0, rotate: -15, scale: 0.9 },
  clash: { 
    x: -20, 
    y: 0, 
    rotate: 5, 
    scale: 1.2,
    transition: { type: "spring", stiffness: 600, damping: 20 }
  },
  win: {
    x: 0,
    scale: 1.25,
    boxShadow: '0 0 35px rgba(197, 160, 89, 0.9)',
    transition: { delay: 0.4, duration: 0.4 }
  },
  lose: {
    scale: [1.2, 1.3, 0],
    opacity: [1, 1, 0],
    filter: ['none', 'grayscale(100%) brightness(1.5)', 'grayscale(100%) brightness(0)'],
    transition: { delay: 0.4, duration: 0.35 }
  }
};
```

---

### 3.4 [4번 하녀 (Handmaid)] - 에메랄드 룬 결계 회전 전개

- **연출 메커니즘**:
  - 카드 제출 즉시 시전자 아바타 둘레에 **비취색(Jade Emerald) 룬 서클 2겹**이 3D 회전하며 안착.
  - 외부 링(시계 방향 12초 주기), 내부 링(반시계 방향 8초 주기)으로 영속 회전.
  - 반투명 에메랄드 돔 쉴드가 살짝 호흡하듯 펄스 (`pulseWave`).
  - 다음 턴이 돌아오면 결계가 자연스럽게 유리 입자로 승화하며 소멸.

```css
@keyframes runeRotateCw {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.04); }
  100% { transform: rotate(360deg) scale(1); }
}

@keyframes runeRotateCcw {
  0% { transform: rotate(360deg); }
  100% { transform: rotate(0deg); }
}

.handmaid-shield-ring-outer {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 1.5px dashed rgba(4, 120, 87, 0.85);
  box-shadow: 0 0 16px rgba(4, 120, 87, 0.45);
  animation: runeRotateCw 12s linear infinite;
}

.handmaid-shield-ring-inner {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px solid rgba(167, 243, 208, 0.7);
  animation: runeRotateCcw 8s linear infinite;
}
```

---

### 3.5 [5번 왕자 (Prince)] - 황실 칙령 & 강제 손패 와류 버림 (Vortex Discard)

- **시퀀스 1: 왕자의 낙인 (0.0s ~ 0.3s)**: 타겟의 손패 위에 왕관 인장이 찍힘.
- **시퀀스 2: 와류 흡입 (0.3s ~ 0.9s)**: 손패 카드가 중앙의 버린 패 슬롯으로 720도 급격히 회전하며 빨려 들어감 (`EASE_VORTEX`, `scale: 1 -> 0.1`).
- **시퀀스 3: 분기 판정**:
  - 버려진 카드가 **8번 공주**인 경우 -> 즉시 **3.8번 공주 파괴 연출** 트리거 및 탈락.
  - 일반 카드인 경우 -> 중앙 덱(또는 비공개 세트 카드)에서 즉시 새로운 카드가 3D 포물선 드로우되어 손패에 충원.

```javascript
export const princeVortexVariants = {
  initial: { scale: 1, rotate: 0, x: 0, y: 0 },
  discard: (custom) => ({
    x: custom.discardX - custom.handX,
    y: custom.discardY - custom.handY,
    scale: 0.1,
    rotate: 720,
    opacity: 0,
    transition: {
      duration: 0.7,
      ease: [0.7, 0, 0.84, 0],
    },
  }),
};
```

---

### 3.6 [6번 국왕 (King)] - 황실 손패 맞교환 궤적 연출 (Crossover Trajectory)

- **시퀀스 1: 준비 (0.0s ~ 0.2s)**: 시전자 손패와 타겟 손패가 공중 30px 부유 (`translateZ: 60px`).
- **시퀀스 2: 교차 비행 (0.2s ~ 0.9s)**:
  - 두 카드가 서로를 향해 완만한 3D 포물선 호(Arc Curve)를 그리며 교차 비행.
  - 지나간 궤적에 황금빛 잔상(Gold Particle Ribbon)이 남음.
- **시퀀스 3: 안착 (0.9s ~ 1.2s)**:
  - 상대방의 손패 슬롯에 부드럽게 스프링 착지 (`SPRING_DRAW`).
  - 손패 교환 성공 배지 `[🤴 국왕의 칙령: 손패 맞교환 완료]` 팝업.

```javascript
export const kingSwapFlightVariants = {
  initial: { x: 0, y: 0, scale: 1, zIndex: 10 },
  flight: (custom) => ({
    x: [0, (custom.targetX - custom.startX) * 0.5, custom.targetX - custom.startX],
    y: [0, (custom.targetY - custom.startY) * 0.5 - 60, custom.targetY - custom.startY], // 위로 솟는 호
    scale: [1, 1.15, 1],
    rotateZ: [0, custom.isLeftToRight ? 15 : -15, 0],
    zIndex: 50,
    transition: {
      duration: 0.75,
      ease: [0.34, 1.3, 0.64, 1],
    },
  }),
};
```

---

### 3.7 [7번 백작부인 (Countess)] - 우아한 벨벳 장미 꽃잎 낙화 (Rose Petals)

- **연출 메커니즘**:
  - 카드 제출 시 부드럽게 슬라이드되며 중앙 테이블에 안착.
  - 카드가 놓이는 순간 카드 중심에서 **18~24개의 붉은 장미 꽃잎(Rose Petals)**이 우아하게 흩날리며 바닥으로 하강.
  - 캔버스 기반 가속 파티클 시스템: 각 꽃잎이 중력, 미세 난류(Turbulence), 회전 각도를 가짐 (`EASE_PETAL`).

```javascript
// Canvas Rose Petal Particle Model
export class RosePetal {
  constructor(x, y) {
    this.x = x + (Math.random() - 0.5) * 40;
    this.y = y + (Math.random() - 0.5) * 20;
    this.size = Math.random() * 8 + 6;
    this.speedX = (Math.random() - 0.5) * 2.5;
    this.speedY = Math.random() * 2 + 1.2;
    this.rotation = Math.random() * 360;
    this.rotSpeed = (Math.random() - 0.5) * 4;
    this.opacity = 1;
    this.decay = Math.random() * 0.015 + 0.008;
    this.color = Math.random() > 0.3 ? '#be123c' : '#881337'; // Carmine & Deep Burgundy
  }
  update() {
    this.x += this.speedX + Math.sin(this.y * 0.05) * 0.8;
    this.y += this.speedY;
    this.rotation += this.rotSpeed;
    this.opacity -= this.decay;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.globalAlpha = Math.max(0, this.opacity);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size, this.size * 0.6, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
```

---

### 3.8 [8번 공주 (Princess)] - 비극적 하트 파괴 & 즉시 탈락 (Heart Rupture)

- **시퀀스 1: 균열 (0.0s ~ 0.3s)**:
  - 화면이 순간 정지(0.15초 프리즈 텐션)되며 카드 중앙에 빛나는 루비 하트 생성.
  - 하트 중심부에 지그재그 균열(Fracture Line)이 붉게 발광하며 파고듦.
- **시퀀스 2: 파괴 폭발 (0.3s ~ 0.7s)**:
  - **`쩌적- 콰앙-!`** 소리와 함께 하트와 공주 카드가 암적색(Deep Crimson) 파편으로 폭발.
  - 화면 전체에 비네팅 암전 펄스(`rgba(99, 19, 38, 0.45)`).
- **시퀀스 3: 탈락 스탬프 (0.7s ~ 1.5s)**:
  - 플레이어 아바타 위에 검붉은 **`PRINCESS FALLEN`** 묘비 인장이 쾅 찍히며 아바타 흑백 처리.

```javascript
export const princessShatterVariants = {
  initial: { scale: 1, filter: 'brightness(1)' },
  crack: {
    scale: 1.08,
    filter: 'brightness(1.5) drop-shadow(0 0 25px #9f1239)',
    transition: { duration: 0.25 }
  },
  explode: {
    scale: 1.4,
    opacity: 0,
    filter: 'brightness(2) blur(8px)',
    transition: { duration: 0.3, ease: "easeOut" }
  }
};
```

---

## 4. 턴 전환 & 승리 토큰 스탬프 연출 (Turn & Victory Stamps)

### 4.1 턴 플레이어 아바타 펄스 글로우 (Active Turn Spotlight)
현재 턴인 플레이어는 좌석 전체가 황금 스포트라이트와 함께 아바타 주위에 2중 골드 링 펄스가 끊임없이 순환합니다.

```css
@keyframes royalTurnRing {
  0% {
    box-shadow: 0 0 0 0 rgba(197, 160, 89, 0.8), 0 0 15px rgba(197, 160, 89, 0.4);
    border-color: #c5a059;
  }
  50% {
    box-shadow: 0 0 0 8px rgba(197, 160, 89, 0), 0 0 25px rgba(197, 160, 89, 0.8);
    border-color: #fef08a;
  }
  100% {
    box-shadow: 0 0 0 0 rgba(197, 160, 89, 0), 0 0 15px rgba(197, 160, 89, 0.4);
    border-color: #c5a059;
  }
}

.active-turn-avatar {
  position: relative;
  border-radius: 50%;
  border: 2px solid #c5a059;
  animation: royalTurnRing 1.8s infinite ease-in-out;
}
```

---

### 4.2 승리 토큰 황실 버건디 왁스 씰 스탬프 (Wax Seal Stamp Impact)

라운드 승리자 또는 최종 우승자에게 황실의 공식 버건디 왁스 씰(Imperial Wax Seal)이 Z축 상공에서 수직으로 쾅! 찍히는 중후한 물리 스탬프 연출입니다.

```
 [상공 z=300px, scale=2.8, rot=-15°] ───(수직 급강하 0.25s)───> [쾅-! 타격점]
                                                                  │
 ┌────────────────────────────────────────────────────────────────┴────────────────────────┐
 │ 1. 바닥 왁스 스플래터 파편 8개 튀김 (Wax Splatter Splash)                               │
 │ 2. 스탬프 무게감 반동 (Rebound Bounce: stiffness: 600, damping: 18, mass: 1.5)           │
 │ 3. 샴페인 골드 인장 엠보싱 하이라이트 발광                                            │
 │ 4. 승리 토큰 카운터 +1 부유 텍스트 (Affection Token Counter Float Up)                   │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Framer Motion Wax Seal Stamp Specification
```javascript
export const waxSealStampVariants = {
  initial: {
    scale: 2.8,
    z: 300,
    rotate: -18,
    opacity: 0,
    filter: 'drop-shadow(0 40px 50px rgba(0, 0, 0, 0.6))',
  },
  stamp: {
    scale: [2.8, 0.92, 1.0], // 오버슈트 타격 압축
    z: 0,
    rotate: 0,
    opacity: 1,
    filter: 'drop-shadow(0 8px 20px rgba(99, 19, 38, 0.65))',
    transition: {
      type: 'spring',
      stiffness: 600,
      damping: 18,
      mass: 1.5,
      duration: 0.45,
    },
  },
};

export const waxSplatterVariants = {
  initial: { scale: 0, opacity: 0 },
  splash: (index) => {
    const angle = (index * (360 / 8) * Math.PI) / 180;
    const distance = 35 + Math.random() * 15;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      scale: [0, 1.2, 0.8],
      opacity: [1, 0.9, 0],
      transition: { duration: 0.5, ease: "easeOut" }
    };
  }
};
```

---

## 5. React / Framer Motion 아키텍처 및 구현 설계

### 5.1 액션 이펙트 매니저 컴포넌트 (`ActionEffectOverlay.jsx`)
모든 1~8번 카드 특수 애니메이션 및 스탬프는 기존 게임 레이아웃을 해치지 않는 전용 오버레이 레이어로 분리되어 실행됩니다.

```jsx
// src/games/love-letter/ActionEffectOverlay.jsx
import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME } from '../../shared/theme';

export function ActionEffectOverlay({ activeAction, onComplete }) {
  if (!activeAction) return null;

  const { type, cardValue, actor, target, result } = activeAction;

  return (
    <AnimatePresence onExitComplete={onComplete}>
      <OverlayBackdrop
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* 1번 경비병 */}
        {cardValue === 1 && (
          <GuardSnipeEffect actor={actor} target={target} result={result} />
        )}

        {/* 3번 남작 결투 */}
        {cardValue === 3 && (
          <BaronDuelEffect actor={actor} target={target} result={result} />
        )}

        {/* 5번 왕자 와류 */}
        {cardValue === 5 && (
          <PrinceVortexEffect target={target} result={result} />
        )}

        {/* 6번 국왕 교환 */}
        {cardValue === 6 && (
          <KingSwapEffect actor={actor} target={target} />
        )}

        {/* 7번 백작부인 꽃잎 */}
        {cardValue === 7 && <CountessPetalsEffect />}

        {/* 8번 공주 파괴 */}
        {cardValue === 8 && <PrincessRuptureEffect target={target} />}

        {/* 라운드 승리 왁스 스탬프 */}
        {type === 'ROUND_WIN' && (
          <WaxSealStampEffect winner={actor} tokens={result?.tokens} />
        )}
      </OverlayBackdrop>
    </AnimatePresence>
  );
}

const OverlayBackdrop = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 90;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
`;
```

---

## 6. 결론 및 향후 적용 로드맵

1. **1단계 (기본 물리 장착)**: 덱 드로우(3D Perspective Flip) 및 손패 쇼케이스 스프링 전환.
2. **2단계 (카드별 액션 오버레이)**: 경비병 저격/튕김, 사제 미러, 남작 격돌, 하녀 결계 등 1~8번 액션 이펙트 매니저 탑재.
3. **3단계 (황실 피날레 연출)**: 백작부인 캔버스 꽃잎 파티클 및 승리 왁스 스탬프 물리 피드백 연결.
4. **4단계 (SFX 큐 포인트 동기화)**: 애니메이션 키프레임과 Web Audio 사운드팩 완벽 싱크.

본 명세는 Wish Boardgame Salon의 모든 모션이 60FPS로 부드럽게 구동되며, 관전자와 플레이어 모두에게 짜릿한 시각적 쾌감을 제공하도록 최적화되었습니다.
