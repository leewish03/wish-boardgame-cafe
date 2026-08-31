import { createInitialGameState } from '../src/state';
import { resolveCommand } from '../src/engine';

export function runPrincessTests(assert: any) {
  const p1 = { id: 'p1', nickname: 'Alice', tokens: 0, isBot: false, isEliminated: false, isProtected: false, discardPile: [], cardCount: 0 };
  const p2 = { id: 'p2', nickname: 'Bob', tokens: 0, isBot: false, isEliminated: false, isProtected: false, discardPile: [], cardCount: 0 };

  const state = createInitialGameState([p1, p2]);
  state.secrets['p1'] = { id: 'p1', hand: [{ id: 'c_prince', value: 5, name: '왕자' }] };
  state.secrets['p2'] = { id: 'p2', hand: [{ id: 'c_princess', value: 8, name: '공주' }] };
  state.currentTurnPlayerId = 'p1';
  state.matchState = 'PLAYING';

  // Alice plays Prince targeting Bob -> Bob discards Princess -> Bob eliminated
  const res = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_prince',
    targetId: 'p2',
  });

  assert.strictEqual(res.nextState.players.find(p => p.id === 'p2')!.isEliminated, true, 'Discarding Princess via Prince should instantly eliminate player');
}
