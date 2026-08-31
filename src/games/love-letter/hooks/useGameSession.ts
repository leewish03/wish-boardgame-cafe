import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { saveSession, loadSession, clearSession } from '../../../shared/useSessionGuard';

export interface GameSession {
  roomCode: string;
  userId: string;
  sessionToken?: string;
  nickname: string;
  avatarUrl?: string;
}

type StoredGameSession = Partial<GameSession>;

export interface UseGameSessionOptions {
  socket: Socket | null;
  roomCode?: string;
  currentUser?: { id: string; nickname: string; avatarUrl?: string; sessionToken?: string } | null;
  onSessionRestored?: (session: GameSession, gameState?: any) => void;
}

export function useGameSession({
  socket,
  roomCode,
  currentUser,
  onSessionRestored,
}: UseGameSessionOptions) {
  const [session, setSession] = useState<GameSession | null>(() => {
    const loaded = loadSession() as StoredGameSession | null;
    if (loaded && loaded.roomCode && loaded.userId) {
      return loaded as GameSession;
    }
    if (roomCode && currentUser) {
      return {
        roomCode,
        userId: currentUser.id,
        sessionToken: currentUser.sessionToken,
        nickname: currentUser.nickname,
        avatarUrl: currentUser.avatarUrl,
      };
    }
    return null;
  });

  const wakeLockRef = useRef<any>(null);

  // Sync session state to storage when active room/user details change
  useEffect(() => {
    if (roomCode && currentUser?.id) {
      const newSession: GameSession = {
        roomCode,
        userId: currentUser.id,
        sessionToken: currentUser.sessionToken || `token_${currentUser.id}_${Date.now()}`,
        nickname: currentUser.nickname,
        avatarUrl: currentUser.avatarUrl,
      };
      setSession(newSession);
      saveSession(newSession);
    }
  }, [roomCode, currentUser?.id, currentUser?.nickname, currentUser?.avatarUrl, currentUser?.sessionToken]);

  // Handle Automatic Session Reconnect
  const reconnect = useCallback(
    (targetSession?: GameSession) => {
      const s = targetSession || session || (loadSession() as StoredGameSession | null);
      if (!socket || !s || !s.roomCode || !s.userId) return;
      const activeSession = s as GameSession;

      socket.emit(
        'room:reconnect',
        {
          roomCode: activeSession.roomCode,
          userId: activeSession.userId,
          sessionToken: activeSession.sessionToken,
        },
        (res: any) => {
          if (res?.success) {
            const restored: GameSession = {
              roomCode: activeSession.roomCode,
              userId: activeSession.userId,
              sessionToken: activeSession.sessionToken,
              nickname: activeSession.nickname || res.player?.nickname || '플레이어',
              avatarUrl: activeSession.avatarUrl || res.player?.avatarUrl,
            };
            setSession(restored);
            saveSession(restored);
            if (onSessionRestored) {
              onSessionRestored(restored, res.gameState);
            }
          }
        }
      );
    },
    [socket, session, onSessionRestored]
  );

  // Screen Wake Lock API
  useEffect(() => {
    let isMounted = true;

    const requestWakeLock = async () => {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && session?.roomCode) {
        try {
          if (!wakeLockRef.current) {
            const lock = await (navigator as any).wakeLock.request('screen');
            if (isMounted) {
              wakeLockRef.current = lock;
              lock.addEventListener('release', () => {
                wakeLockRef.current = null;
              });
            } else {
              lock.release();
            }
          }
        } catch (err) {
          // Ignore wake lock request rejection
        }
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [session?.roomCode, reconnect]);

  const endSession = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  return {
    session,
    reconnect,
    endSession,
    saveSession,
    loadSession,
    clearSession,
  };
}
