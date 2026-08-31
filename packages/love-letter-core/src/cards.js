export const CARD_DEFINITIONS = {
  1: {
    value: 1,
    name: '경비병',
    nameEn: 'Guard',
    count: 5,
    color: '#3182CE',
    icon: '🛡️',
    description: '다른 플레이어를 지목해 2~8번 카드를 추측합니다. 적중 시 탈락시킵니다.',
    detailedGuide: '상대 1명을 지목하고 경비병(1)을 제외한 2~8번 카드를 추측하세요. 상대가 해당 카드를 들고 있다면 즉시 탈락합니다.',
    needsTarget: true,
    canTargetSelf: false,
    isGuessing: true,
  },
  2: {
    value: 2,
    name: '사제',
    nameEn: 'Priest',
    count: 2,
    color: '#4FD1C5',
    icon: '📜',
    description: '다른 플레이어 1명의 손패를 은밀하게 확인합니다.',
    detailedGuide: '다른 플레이어 1명을 지목해 들고 있는 카드를 비밀리에 투시합니다. 오직 당신에게만 카드가 보입니다.',
    needsTarget: true,
    canTargetSelf: false,
    isGuessing: false,
  },
  3: {
    value: 3,
    name: '남작',
    nameEn: 'Baron',
    count: 2,
    color: '#9F7AEA',
    icon: '⚔️',
    description: '다른 플레이어와 손패 숫자를 비교해 낮은 쪽이 즉시 탈락합니다.',
    detailedGuide: '다른 플레이어 1명을 지목하여 카드를 비밀리에 맞비교합니다. 숫자가 더 낮은 플레이어가 즉시 탈락하며, 비기면 아무 일도 일어나지 않습니다.',
    needsTarget: true,
    canTargetSelf: false,
    isGuessing: false,
  },
  4: {
    value: 4,
    name: '하녀',
    nameEn: 'Handmaid',
    count: 2,
    color: '#68D391',
    icon: '🌸',
    description: '다음 내 턴이 올 때까지 다른 모든 플레이어의 카드 효과로부터 보호받습니다.',
    detailedGuide: '다음 내 턴 시작 시까지 모든 상대방의 지목 공격(경비병, 사제, 남작, 왕자, 국왕)에 면역됩니다.',
    needsTarget: false,
    canTargetSelf: false,
    isGuessing: false,
  },
  5: {
    value: 5,
    name: '왕자',
    nameEn: 'Prince',
    count: 2,
    color: '#ECC94B',
    icon: '👑',
    description: '플레이어 1명(자신 포함 가능)을 지목해 들고 있는 카드를 버리고 새로 뽑게 합니다.',
    detailedGuide: '자신 또는 다른 플레이어를 지목합니다. 지목당한 사람은 손패를 버리고 덱에서 새 카드를 뽑습니다. 만약 공주(8)를 버렸다면 즉시 탈락합니다.',
    needsTarget: true,
    canTargetSelf: true,
    isGuessing: false,
  },
  6: {
    value: 6,
    name: '국왕',
    nameEn: 'King',
    count: 1,
    color: '#ED8936',
    icon: '🤴',
    description: '다른 플레이어 1명과 손패를 맞바꿉니다.',
    detailedGuide: '다른 플레이어 1명을 지목하여 서로의 손패를 교환합니다. 서로의 새 카드는 두 사람만 알 수 있습니다.',
    needsTarget: true,
    canTargetSelf: false,
    isGuessing: false,
  },
  7: {
    value: 7,
    name: '백작부인',
    nameEn: 'Countess',
    count: 1,
    color: '#F687B3',
    icon: '🌹',
    description: '왕자(5)나 국왕(6)을 함께 들고 있다면 반드시 이 카드를 먼저 내야 합니다.',
    detailedGuide: '특수 효과는 없으나, 손패에 왕자(5)나 국왕(6)이 함께 있다면 반드시 백작부인을 먼저 내려놓아야 합니다. (거짓 블러핑으로 그냥 내도 됩니다)',
    needsTarget: false,
    canTargetSelf: false,
    isGuessing: false,
  },
  8: {
    value: 8,
    name: '공주',
    nameEn: 'Princess',
    count: 1,
    color: '#E53E3E',
    icon: '👸',
    description: '어떤 이유로든 이 카드를 내려놓거나 버리게 되면 즉시 탈락합니다.',
    detailedGuide: '가장 높은 점수(8)를 가진 카드입니다. 하지만 손패에서 버려지거나 스스로 내는 순간 즉시 라운드에서 탈락합니다. 왕자 공격을 조심하세요.',
    needsTarget: false,
    canTargetSelf: false,
    isGuessing: false,
  },
};

export const CARD_DEFS = CARD_DEFINITIONS;

export function createDeck(playerCount = 4) {
  const deck = [];
  const baseCounts = {
    1: 5,
    2: 2,
    3: 2,
    4: 2,
    5: 2,
    6: 1,
    7: 1,
    8: 1,
  };

  if (playerCount >= 5) {
    baseCounts[1] += 2;
    baseCounts[2] += 1;
    baseCounts[3] += 1;
    baseCounts[4] += 1;
    baseCounts[5] += 1;
  }

  let idCounter = 1;
  for (let v = 1; v <= 8; v++) {
    const meta = CARD_DEFINITIONS[v];
    const cnt = baseCounts[v];
    for (let c = 0; c < cnt; c++) {
      deck.push({
        id: `card_${v}_${idCounter++}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        value: meta.value,
        name: meta.name,
        nameEn: meta.nameEn,
        color: meta.color,
        icon: meta.icon,
        desc: meta.description,
        description: meta.description,
      });
    }
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export const generateDeck = createDeck;
