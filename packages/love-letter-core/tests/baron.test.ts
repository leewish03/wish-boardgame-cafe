import { createInitialGameState } from '../src/state';
import { executeCommand } from '../src/engine';

export function runBaronTests(assert: any) {
  const p1 = { id: 'p1', nickname: 'Alice', tokens: 0, isBot: false, isEliminated: false, isProtected: false, discardPile: [], cardCount: 0 };
  const p2 = { id: 'p2', nickname: 'Bob', tokens: 0, isBot: false, isEliminated: false, isProtected: false, discardPile: [], cardCount: 0 };

  let state = createInitialGameState([p1, p2]);
  state.secrets['p1'] = { hand: [{ id: 'c_baron', value: 3, name: '남작' }, { id: 'c_prince', value: 5, name: '왕자' }] };
  state.secrets['p2'] = { hand: [{ id: 'c_priest', value: 2, name: '사제' }] };
  state.currentTurnPlayerId = 'p1';
  state.matchState = 'PLAYING';

  // Alice plays Baron against Bob (5 vs 2 -> Bob eliminated)
  const res = executeCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_baron',
    targetId: 'p2',
  });

  assert.strictEqual(res.nextState.players.find(p => p.id === 'p2')!.isEliminated, true, 'Bob with lower card should be eliminated');
}
