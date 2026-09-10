import { PlayerId, PlayerPublic } from '../../../../packages/love-letter-core/src/types';

export interface PlayerCopy {
  name: string;
  subject: string;
  object: string;
  possessive: string;
}

/** Keeps local-player wording stable across the game surface. */
export function playerCopy(players: PlayerPublic[], playerId: PlayerId | null | undefined, localUserId: PlayerId): PlayerCopy {
  if (playerId === localUserId) {
    return { name: '나', subject: '내가', object: '나를', possessive: '내' };
  }

  const nickname = players.find((player) => player.id === playerId)?.nickname;
  if (nickname) {
    return { name: nickname, subject: `${nickname}님이`, object: `${nickname}님을`, possessive: `${nickname}님의` };
  }

  return { name: '상대', subject: '상대가', object: '상대를', possessive: '상대의' };
}
