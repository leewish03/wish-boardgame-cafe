import { createInitialGameState } from '../src/state';
import { resolveCommand } from '../src/engine';

export function runGuardTests(assert: any) {
  const p1 = { id: 'p1', nickname: 'Alice', tokens: 0, isBot: false, isEliminated: false, isProtected: false, discardPile: [], cardCount: 0 };
  const p2 = { id: 'p2', nickname: 'Bob', tokens: 0, isBot: false, isEliminated: false, isProtected: false, discardPile: [], cardCount: 0 };

  const state = createInitialGameState([p1, p2]);
  state.secrets['p1'] = { id: 'p1', hand: [{ id: 'c_guard', value: 1, name: '경비병' }] };
  state.secrets['p2'] = { id: 'p2', hand: [{ id: 'c_priest', value: 2, name: '사제' }] };
  state.currentTurnPlayerId = 'p1';
  state.matchState = 'PLAYING';

  // Guard correct guess: Priest (2)
  const res = resolveCommand(state, {
    type: 'PLAY_CARD',
    playerId: 'p1',
    cardId: 'c_guard',
    targetId: 'p2',
    guessValue: 2,
  });

  assert.strictEqual(res.nextState.players.find(p => p.id === 'p2')!.isEliminated, true, 'Bob should be eliminated on correct guess');
  assert.ok(res.events.some(e => e.type === 'PLAYER_ELIMINATED'), 'PLAYER_ELIMINATED event emitted');
}
