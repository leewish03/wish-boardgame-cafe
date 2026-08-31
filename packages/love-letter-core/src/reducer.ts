import { GameState } from './types';
import { GameCommand } from './commands';
import { resolveCommand } from './engine';

export function gameReducer(state: GameState, command: GameCommand): GameState {
  return resolveCommand(state, command).nextState;
}
