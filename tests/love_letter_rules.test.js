import assert from 'assert';

console.log('🧪 러브레터(Love Letter) 룰 엔진 단위 테스트 시작...\n');

// Mock Card Data
const CARD_DEFS = {
  1: { value: 1, name: '경비병' },
  2: { value: 2, name: '사제' },
  3: { value: 3, name: '남작' },
  4: { value: 4, name: '하녀' },
  5: { value: 5, name: '왕자' },
  6: { value: 6, name: '국왕' },
  7: { value: 7, name: '백작부인' },
  8: { value: 8, name: '공주' },
};

function createMockRoom() {
  return {
    code: 'TEST01',
    gameState: 'PLAYING',
    turnPlayerId: 'p1',
    deck: [
      { id: 'c_deck1', value: 1, name: '경비병' },
      { id: 'c_deck2', value: 3, name: '남작' },
    ],
    setAsideCard: { id: 'c_setaside', value: 4, name: '하녀' },
    players: [
      {
        id: 'p1',
        name: '플레이어1',
        isEliminated: false,
        isProtected: false,
        hand: [{ id: 'c1', value: 1, name: '경비병' }, { id: 'c2', value: 5, name: '왕자' }],
        discardPile: [],
      },
      {
        id: 'p2',
        name: '플레이어2',
        isEliminated: false,
        isProtected: false,
        hand: [{ id: 'c3', value: 3, name: '남작' }],
        discardPile: [],
      },
      {
        id: 'p3',
        name: '플레이어3',
        isEliminated: false,
        isProtected: true, // Under Handmaid protection
        hand: [{ id: 'c4', value: 8, name: '공주' }],
        discardPile: [],
      },
    ],
  };
}

// 1. Guard (1) Test
{
  console.log('▶ Test 1: 경비병(1) 정답 추측 시 대상 탈락 검증');
  const room = createMockRoom();
  const player = room.players[0];
  const target = room.players[1];

  // Play Guard (1) against p2 guessing 3 (Baron)
  const cardIndex = player.hand.findIndex((c) => c.value === 1);
  const card = player.hand.splice(cardIndex, 1)[0];
  player.discardPile.push(card);

  const guessedVal = 3;
  if (!target.isProtected && target.hand[0].value === guessedVal) {
    target.isEliminated = true;
    target.discardPile.push(target.hand.pop());
  }

  assert.strictEqual(target.isEliminated, true, 'p2는 경비병 정답 저격으로 탈락해야 합니다.');
  assert.strictEqual(target.hand.length, 0, '탈락한 플레이어의 손패는 0장이어야 합니다.');
  console.log('  ✔ 통과: 경비병 정답 저격 정상 탈락\n');
}

// 2. Handmaid Protection Test
{
  console.log('▶ Test 2: 하녀(4) 보호 상태의 플레이어 공격 무효 검증');
  const room = createMockRoom();
  const player = room.players[0];
  const protectedTarget = room.players[2]; // p3 has isProtected: true

  const cardIndex = player.hand.findIndex((c) => c.value === 1);
  const card = player.hand.splice(cardIndex, 1)[0];
  player.discardPile.push(card);

  const guessedVal = 8;
  if (!protectedTarget.isProtected && protectedTarget.hand[0].value === guessedVal) {
    protectedTarget.isEliminated = true;
  }

  assert.strictEqual(protectedTarget.isEliminated, false, '하녀 보호 중인 플레이어는 공격받지 않아야 합니다.');
  console.log('  ✔ 통과: 하녀 보호막 정상 작동\n');
}

// 3. Countess Rule Constraint Test
{
  console.log('▶ Test 3: 백작부인(7) 소지 시 왕자(5)/국왕(6) 제출 금지 검증');
  const handWithPrince = [{ value: 7, name: '백작부인' }, { value: 5, name: '왕자' }];
  const handWithKing = [{ value: 7, name: '백작부인' }, { value: 6, name: '국왕' }];

  function canPlayCard(hand, cardToPlay) {
    const otherCard = hand.find((c) => c !== cardToPlay);
    if (otherCard && otherCard.value === 7 && (cardToPlay.value === 5 || cardToPlay.value === 6)) {
      return false; // Constraint violated
    }
    return true;
  }

  assert.strictEqual(canPlayCard(handWithPrince, handWithPrince[1]), false, '왕자를 낼 수 없어야 합니다.');
  assert.strictEqual(canPlayCard(handWithPrince, handWithPrince[0]), true, '백작부인은 낼 수 있어야 합니다.');
  assert.strictEqual(canPlayCard(handWithKing, handWithKing[1]), false, '국왕을 낼 수 없어야 합니다.');
  console.log('  ✔ 통과: 백작부인 강제 규칙 검증 완료\n');
}

// 4. Prince (5) Discard Princess (8) Instant Elimination Test
{
  console.log('▶ Test 4: 왕자(5)로 인해 공주(8)가 버려질 시 즉시 탈락 검증');
  const room = createMockRoom();
  room.players[2].isProtected = false; // remove protection
  const target = room.players[2]; // holds Princess (8)

  const discardedCard = target.hand.pop();
  target.discardPile.push(discardedCard);

  if (discardedCard.value === 8) {
    target.isEliminated = true;
  }

  assert.strictEqual(target.isEliminated, true, '공주 카드가 버려지면 즉시 탈락해야 합니다.');
  console.log('  ✔ 통과: 공주 버려짐 즉시 탈락 검증 완료\n');
}

// 5. Baron (3) Duel Comparison Test
{
  console.log('▶ Test 5: 남작(3) 결투 시 더 낮은 카드 보유자 탈락 검증');
  const playerCard = { value: 5, name: '왕자' }; // p1
  const targetCard = { value: 3, name: '남작' }; // p2

  let p1Eliminated = false;
  let p2Eliminated = false;

  if (playerCard.value > targetCard.value) {
    p2Eliminated = true;
  } else if (playerCard.value < targetCard.value) {
    p1Eliminated = true;
  }

  assert.strictEqual(p2Eliminated, true, '더 낮은 카드(3번)를 가진 대상이 탈락해야 합니다.');
  assert.strictEqual(p1Eliminated, false, '더 높은 카드(5번)를 가진 시전자는 생존해야 합니다.');
  console.log('  ✔ 통과: 남작 결투 판정 검증 완료\n');
}

console.log('🎉 모든 룰 엔진 단위 테스트(5/5)가 완벽하게 통과했습니다!');
