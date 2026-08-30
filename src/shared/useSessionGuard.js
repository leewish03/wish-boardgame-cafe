import { useEffect, useRef } from 'react';

export const SESSION_STORAGE_KEY = 'wish_boardgame_session';

/**
 * Save session details to localStorage
 * @param {Object} data - { roomCode, userId, sessionToken, nickname, avatarUrl }
 */
export function saveSession(data) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!data) {
      clearSession();
      return;
    }
    const sessionData = {
      ...data,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
  } catch (err) {
    console.error('Failed to save session to localStorage:', err);
  }
}

/**
 * Load session details from localStorage
 * @returns {Object|null}
 */
export function loadSession() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load session from localStorage:', err);
    return null;
  }
}

/**
 * Clear session from localStorage
 */
export function clearSession() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear session from localStorage:', err);
  }
}

/**
 * Hook to guard session:
 * 1. Screen Wake Lock API (prevents mobile display sleeping during game)
 * 2. beforeunload listener (warns before accidental refresh/tab close)
 * 3. visibilitychange, pageshow, focus, online listeners (auto-reconnect on return)
 */
export function useSessionGuard({
  socket,
  roomState,
  screen,
  onReconnectRequest,
}) {
  const wakeLockRef = useRef(null);

  // 1. Screen Wake Lock API
  useEffect(() => {
    let isMounted = true;

    const requestWakeLock = async () => {
      if (
        typeof navigator !== 'undefined' &&
        'wakeLock' in navigator &&
        (screen === 'waitingRoom' || screen === 'game')
      ) {
        try {
          if (!wakeLockRef.current) {
            const lock = await navigator.wakeLock.request('screen');
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
          console.warn('Screen Wake Lock request failed:', err);
        }
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
        } catch (err) {
          // Ignore release errors
        }
        wakeLockRef.current = null;
      }
    };

    if (screen === 'waitingRoom' || screen === 'game') {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Re-request wake lock when returning to visibility
    const handleVisibilityWakeLock = () => {
      if (
        document.visibilityState === 'visible' &&
        (screen === 'waitingRoom' || screen === 'game')
      ) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityWakeLock);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityWakeLock);
      releaseWakeLock();
    };
  }, [screen]);

  // 2. beforeunload Event Listener (Prevent Accidental Refresh/Tab Close)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const isRoomActive =
        roomState &&
        (screen === 'waitingRoom' || screen === 'game') &&
        roomState.gameState !== 'GAME_OVER';

      if (isRoomActive) {
        e.preventDefault();
        const confirmationMessage =
          '게임 또는 대기실이 진행 중입니다. 페이지를 벗어나시겠습니까?';
        e.returnValue = confirmationMessage;
        return confirmationMessage;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomState, screen]);

  // 3. visibilitychange, pageshow, focus, online (Auto Reconnect & Sync)
  useEffect(() => {
    const handleResume = () => {
      if (document.visibilityState === 'visible' || (typeof navigator !== 'undefined' && navigator.onLine)) {
        const session = loadSession();
        if (session && session.roomCode && session.userId && session.sessionToken) {
          // If socket disconnected, reconnect
          if (socket && !socket.connected) {
            socket.connect();
          }

          // Trigger reconnect callback
          if (typeof onReconnectRequest === 'function') {
            onReconnectRequest(session);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('pageshow', handleResume);
    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleResume);

    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('pageshow', handleResume);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
    };
  }, [socket, onReconnectRequest]);

  // 4. 1-Second Heartbeat & Session State Verification Polling
  useEffect(() => {
    if (!socket || (screen !== 'waitingRoom' && screen !== 'game')) return;

    const intervalId = setInterval(() => {
      const session = loadSession();
      if (!session || !session.roomCode || !session.userId || !session.sessionToken) return;

      if (!socket.connected) {
        socket.connect();
        if (typeof onReconnectRequest === 'function') {
          onReconnectRequest(session);
        }
        return;
      }

      socket.emit(
        'session:heartbeat',
        {
          roomCode: session.roomCode,
          userId: session.userId,
          sessionToken: session.sessionToken,
        },
        (res) => {
          if (res?.success) {
            // Desync check: if client thinks room is paused, but server is unpaused (or vice-versa)
            if (roomState && roomState.isPaused && !res.isPaused) {
              if (typeof onReconnectRequest === 'function') {
                onReconnectRequest(session);
              }
            }
          }
        }
      );
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [socket, screen, roomState, onReconnectRequest]);
}
