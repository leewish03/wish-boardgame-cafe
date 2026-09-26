import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import styled, { css } from 'styled-components';
import { THEME } from './shared/theme';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  TabsContent,
  Badge,
  Input,
  Toast,
} from './shared/components';
import { useSocket } from './shared/useSocket';
import { useWebRTC } from './shared/useWebRTC';
import { useSTT } from './shared/useSTT';
import { RoomChat } from './shared/RoomChat';
import { createRoomSessionBoundary, terminalSessionCode, sessionEndMessages } from './shared/roomSession';
import { sfx } from './shared/sfx';
import {
  useSessionGuard,
  saveSession,
  loadSession,
  clearSession,
} from './shared/useSessionGuard';
import { useVisualViewportRect } from './shared/useVisualViewportRect';
import { RoomVoiceControls } from './games/love-letter/ui/GameMenuDrawer';
import {
  Coffee,
  Users,
  Copy,
  Check,
  Play,
  RotateCcw,
  Sparkles,
  Send,
  LogOut,
  Clock,
  Award,
  HelpCircle,
  Crown,
  Edit2,
  User,
  Bot,
  UserPlus,
  Trash2,
} from 'lucide-react';

const LoveLetterGame = React.lazy(() => import('./games/love-letter/ui/LoveLetterGame'));
const DalmutiGame = React.lazy(() => import('./games/dalmuti/DalmutiGame'));

// =========================================================================
// App Container & Layout
// =========================================================================

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  ${({ $isGame }) =>
    $isGame
      ? css`
          height: 100dvh;
          max-height: 100dvh;
          overflow: hidden;
        `
      : css`
          min-height: 100vh;
        `}
  width: 100%;
  background-color: ${THEME.background};
  color: ${THEME.foreground};
  font-family: ${THEME.font.sans};
  position: relative;
  overflow-x: hidden;
  ${({ $entryViewportHeight }) => $entryViewportHeight && css`
    min-height: ${$entryViewportHeight}px;
  `}
`;

const AppHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  background-color: rgba(255, 255, 255, 0.96);
  background-image: ${THEME.gradients.marbleTextureUrl}, ${THEME.gradients.marbleSlab};
  background-size: cover;
  border-bottom: 1.5px solid #dcdfe4;
  backdrop-filter: blur(14px);
  box-shadow: 0 4px 16px rgba(9, 13, 22, 0.05);
  z-index: 100;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, ${THEME.gold} 50%, transparent 100%);
  }
`;

const BrandLogo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: ${THEME.font.serif};
  font-size: 1.15rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  color: ${THEME.foreground};
  text-transform: uppercase;

  span.logo-seal {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: ${THEME.primary};
    border: 1.5px solid ${THEME.gold};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-shadow: 0 2px 6px rgba(9, 13, 22, 0.2);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: 72% 25%;
      image-rendering: pixelated;
    }
  }

  span.salon-text {
    color: ${THEME.burgundy};
    font-weight: 700;
  }
`;

const MonogramSeal = styled.div`
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: ${THEME.gradients.obsidianButton};
  border: 2px solid ${THEME.gold};
  box-shadow: 0 6px 18px rgba(9, 13, 22, 0.25), 0 0 14px rgba(197, 160, 89, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  position: relative;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 72% 25%;
    image-rendering: pixelated;
  }

  &::before {
    content: '';
    position: absolute;
    inset: 2px;
    border: 1px dashed rgba(197, 160, 89, 0.55);
    border-radius: 50%;
    pointer-events: none;
    z-index: 2;
  }
`;

const UserProfileChip = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: #ffffff;
  padding: 4px 14px 4px 6px;
  border-radius: ${THEME.radius.full};
  border: 1px solid #dcdfe4;
  box-shadow: 0 2px 8px rgba(9, 13, 22, 0.05);
  font-size: 13px;
  font-weight: 700;
  color: ${THEME.foreground};

  img {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1.5px solid ${THEME.gold};
  }
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: ${({ $isEntry }) => ($isEntry ? 'center' : 'flex-start')};
  padding: ${({ $isGame }) => ($isGame ? '0' : '28px 16px')};
  max-width: ${({ $isGame }) => ($isGame ? '100%' : '1080px')};
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin: 0 auto;
  ${({ $isEntry, $entryViewportHeight }) => $isEntry && css`
    min-height: ${$entryViewportHeight || '100dvh'}px;
    padding-top: max(20px, env(safe-area-inset-top));
    padding-bottom: max(28px, env(safe-area-inset-bottom));
    overflow-y: auto;
  `}
  ${({ $isGame }) =>
    $isGame &&
    css`
      height: 100dvh;
      max-height: 100dvh;
      overflow: hidden;
      padding: 0;
    `}
`;

// Game Card Grid Layout
const GameGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  gap: 24px;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  margin-top: 18px;

  > * { min-width: 0; max-width: 100%; box-sizing: border-box; }
  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
`;

const GameLoadingScreen = styled.div`
  width: min(400px, calc(100% - 32px));
  min-height: 168px;
  margin: auto;
  padding: 24px;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  background: ${THEME.gradients.marbleTextureUrl}, ${THEME.gradients.marbleSlab};
  color: ${THEME.foreground};
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radius.lg};
  box-shadow: ${THEME.shadows.marbleSlab};

  div {
    display: grid;
    justify-items: center;
    gap: 10px;
    font-family: ${THEME.font.serif};
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  span {
    font: 700 11px ${THEME.font.sans};
    color: ${THEME.mutedForeground};
    letter-spacing: normal;
  }

  @media (max-width: 420px) {
    width: calc(100% - 24px);
    min-height: 142px;
    padding: 18px;
  }
`;

const LobbySegmentedNav = styled.nav`
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  width:100%;
  min-width:0;
  max-width:620px;
  padding:3px;
  box-sizing:border-box;
  border:1px solid ${THEME.border};
  border-radius:${THEME.radius.md};
  background:rgba(255,255,255,.72);
`;

const LobbySegmentButton = styled.button`
  min-width:0;
  height:38px;
  padding:0 8px;
  border:0;
  border-radius:calc(${THEME.radius.md} - 3px);
  background:${({$active})=>$active ? THEME.primary : 'transparent'};
  color:${({$active})=>$active ? '#fff' : THEME.mutedForeground};
  font:800 12px ${THEME.font.sans};
  letter-spacing:.02em;
  cursor:pointer;
  overflow:hidden;
  white-space:nowrap;
  text-overflow:ellipsis;
  .desktop-label{display:inline;}
  .mobile-label{display:none;}
  @media(max-width:560px){
    height:36px;
    padding:0 4px;
    font-size:12px;
    .desktop-label{display:none;}
    .mobile-label{display:inline;}
  }
`;

const GameThumbnail = styled.div`
  height: 130px;
  border-radius: ${THEME.radius.md};
  background: ${({ $bg }) => $bg || '#090d16'};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(197, 160, 89, 0.3);
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);

  span.emblem-title {
    font-family: ${THEME.font.serif};
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: ${THEME.goldLight};
    text-transform: uppercase;
  }

  span.emblem-sub {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    letter-spacing: 0.08em;
    margin-top: 2px;
  }
`;

const ChatWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 240px;
  border: 1px solid #dcdfe4;
  border-radius: ${THEME.radius.lg};
  background-color: #ffffff;
  background-image: ${THEME.gradients.marbleTextureUrl}, ${THEME.gradients.marbleSlab};
  background-size: cover;
  overflow: hidden;
  margin-top: 16px;
  box-shadow: ${THEME.shadows.marbleSlab};
`;

const ChatFeed = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ChatBubble = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;

  span.name {
    font-weight: 800;
    color: ${THEME.burgundy};
    white-space: nowrap;
  }

  span.text {
    color: ${THEME.foreground};
    word-break: break-word;
  }
`;

const ChatInputRow = styled.form`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid ${THEME.border};
  background-color: rgba(255, 255, 255, 0.95);
`;

// =========================================================================
// Main App Component
// =========================================================================

export default function App() {
  const { socket, connected } = useSocket();

  // Screen State: 'entry' | 'lobby' | 'waitingRoom' | 'game'
  const [screen, setScreen] = useState(() => {
    const saved = loadSession();
    if (saved?.nickname) {
      return 'lobby'; // If nickname exists in session, enter lobby directly!
    }
    return 'entry';
  });

  // User State
  const [nickname, setNickname] = useState(() => {
    const saved = loadSession();
    return saved?.nickname || '';
  });
  const [avatarSeed, setAvatarSeed] = useState(() => {
    const saved = loadSession();
    return saved?.avatarUrl
      ? saved.avatarUrl.split('seed=')[1]?.split('&')[0] || `wish_${Math.random().toString(36).substr(2, 5)}`
      : `wish_${Math.random().toString(36).substr(2, 5)}`;
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = loadSession();
    if (saved?.nickname) {
      return {
        id: saved.userId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sessionToken: saved.sessionToken || null,
        nickname: saved.nickname,
        avatarUrl: saved.avatarUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${saved.nickname}&backgroundColor=090d16,1e293b,3b0b17,047857`,
      };
    }
    return null;
  });

  // Profile Edit Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editAvatarSeed, setEditAvatarSeed] = useState('');

  // Active Tab in Lobby: 'games' | 'rooms' | 'join'
  const [activeTab, setActiveTab] = useState('games');
  const [openRooms, setOpenRooms] = useState([]);
  const [roomsUpdatedAt, setRoomsUpdatedAt] = useState(0);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [roomsError, setRoomsError] = useState('');
  const reconnectInFlightRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const queuedReconnectRef = useRef(null);
  const roomListQueuedRef = useRef(false);
  // Do not wait for Socket.IO's first connection to show the recovery route.
  // A reload must always present the saved room choice immediately.
  const [reconnectOffer, setReconnectOffer] = useState(() => {
    const saved = loadSession();
    return saved?.roomCode && saved?.userId && saved?.sessionToken ? saved : null;
  });

  // Room State from Server
  const [roomState, setRoomState] = useState(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const roomSessionRef = useRef(createRoomSessionBoundary());
  const invalidateRoomSession = useCallback(() => {
    roomSessionRef.current.invalidate();
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = null;
    reconnectInFlightRef.current = false;
    queuedReconnectRef.current = null;
  }, []);
  const handleRoomUnavailable = useCallback((result) => {
    const code = terminalSessionCode(result);
    if (!code || !roomSessionRef.current.matches(result)) return;
    // A server restart can leave the browser with one final, stale table
    // snapshot. Never leave that screen interactive: its room no longer
    // exists on the authority, so clear the recovery route and return home.
    invalidateRoomSession();
    setReconnectOffer(null);
    clearSession();
    setCurrentUser(previous => previous ? { ...previous, sessionToken: null } : previous);
    setRoomState(null);
    setScreen('lobby');
    setToastMessage(sessionEndMessages[code]);
  }, [invalidateRoomSession]);

  // Game Lobby Creation Dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedGameForCreate, setSelectedGameForCreate] = useState('LOVE_LETTER');
  const [targetTokens, setTargetTokens] = useState(4);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [turnTimeLimit, setTurnTimeLimit] = useState(60);
  const [roundCount, setRoundCount] = useState(10);
  const [useStrippedDeck, setUseStrippedDeck] = useState(true);
  const [philanthropicScoring, setPhilanthropicScoring] = useState(false);
  const [merchantExchange, setMerchantExchange] = useState(false);

  // Chat message in waiting room
  const [chatInput, setChatInput] = useState('');

  // WebRTC and STT Hooks
  const webrtc = useWebRTC(socket, roomState?.code, currentUser?.id, currentUser?.sessionToken);
  const stt = useSTT(socket, roomState?.code, currentUser?.id);
  const visualViewport = useVisualViewportRect(screen === 'entry' || profileModalOpen);

  const avatarUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${avatarSeed}&backgroundColor=090d16,1e293b,3b0b17,047857`;

  // Reconnect is invoked only after the returning player explicitly chooses
  // it, except when an already-open table is recovering its own transport.
  const handleReconnectRequest = useCallback(
    (session) => {
      if (!socket || !session?.roomCode || !session?.userId || !session?.sessionToken || reconnectInFlightRef.current) return;
      if (!socket.connected) {
        queuedReconnectRef.current = session;
        setReconnectOffer(session);
        socket.connect();
        return;
      }
      const request = roomSessionRef.current.begin(session.roomCode, session.userId);
      reconnectInFlightRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!roomSessionRef.current.isCurrent(request)) return;
        roomSessionRef.current.invalidate();
        reconnectInFlightRef.current = false;
        reconnectTimeoutRef.current = null;
        setReconnectOffer(session);
        setToastMessage('재접속 응답이 지연되고 있습니다. 다시 시도해 주세요.');
      }, 6000);

      socket.emit(
        'room:reconnect',
        {
          roomCode: session.roomCode,
          userId: session.userId,
          sessionToken: session.sessionToken,
          requestId: request.requestId,
        },
        (res) => {
          if (!roomSessionRef.current.isCurrent(request)) return;
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
          reconnectInFlightRef.current = false;
          if (res?.success) {
            if (res.roomCode !== session.roomCode || res.userId !== session.userId) return;
            roomSessionRef.current.accept(request, res.roomCode, res.userId);
            queuedReconnectRef.current = null;
            setReconnectOffer(null);
            const restoredUser = {
              id: session.userId,
              sessionToken: session.sessionToken,
              nickname: session.nickname || res.player?.nickname || '플레이어',
              avatarUrl: session.avatarUrl || res.player?.avatarUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${session.userId}&backgroundColor=090d16,1e293b,3b0b17,047857`,
            };
            setCurrentUser(restoredUser);
            setRoomState(res.gameState);
            socket.emit(res.gameState?.gameType === 'DALMUTI' ? 'dalmuti:view-ready' : 'game:view-ready', { roomCode: res.roomCode, userId: res.userId, requestId: request.requestId });
            if (res.gameState?.gameState === 'LOBBY') {
              setScreen('waitingRoom');
            } else {
              setScreen('game');
            }
            if (!res.alreadyConnected) setToastMessage('이전 게임 세션에 다시 접속했습니다.');
          } else if (terminalSessionCode(res)) {
            handleRoomUnavailable({ ...res, roomCode: session.roomCode, userId: session.userId, requestId: request.requestId });
          } else {
            // Keep the route visible until the player explicitly chooses to
            // abandon it. A transient reconnect failure is not a departure.
            setReconnectOffer(session);
            setToastMessage(res?.error || '이전 방에 다시 접속하지 못했습니다. 다시 시도해 주세요.');
            if (session.nickname) {
              setNickname(session.nickname);
              setCurrentUser({
                id: session.userId || `user_${Date.now()}`,
                nickname: session.nickname,
                avatarUrl: session.avatarUrl,
              });
              setScreen('lobby');
            }
          }
        }
      );
    },
    [socket, handleRoomUnavailable]
  );

  useEffect(() => () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!connected || !queuedReconnectRef.current) return;
    const queued = queuedReconnectRef.current;
    queuedReconnectRef.current = null;
    handleReconnectRequest(queued);
  }, [connected, handleReconnectRequest]);

  // Screen Wake Lock, beforeunload & visibilitychange guard hook
  useSessionGuard({
    socket,
    roomState,
    screen,
    onReconnectRequest: handleReconnectRequest,
    onRoomUnavailable: handleRoomUnavailable,
    roomSessionBoundary: roomSessionRef.current,
  });

  // Recover sessions saved by older builds as well. The dialog deliberately
  // remains a choice; this never navigates back to the table on its own.
  useEffect(() => {
    const session = loadSession();
    if (session && session.roomCode && session.userId && session.sessionToken) {
      setReconnectOffer((previous) => previous || session);
    }
  }, []);

  const handleDeclineReconnect = useCallback(() => {
    const saved = reconnectOffer;
    invalidateRoomSession();
    setReconnectOffer(null);
    // The player has explicitly chosen to abandon this table. Notify the
    // authoritative server when possible, then leave locally without waiting
    // for a connection response that may itself be recovering.
    if (socket?.connected && saved?.roomCode && saved?.userId) {
      socket.emit('room:forfeit', { roomCode: saved.roomCode, userId: saved.userId, sessionToken: saved.sessionToken });
    }
    clearSession();
    setCurrentUser(previous => previous ? { ...previous, sessionToken: null } : previous);
    setRoomState(null);
    setScreen('lobby');
  }, [reconnectOffer, socket, invalidateRoomSession]);

  const refreshOpenRooms = useCallback(() => {
    if (!socket) return;
    const requestList = () => {
      roomListQueuedRef.current = false;
      setRoomsLoading(true);
      setRoomsError('');
      socket.emit('room:list', {}, (result) => {
        setRoomsLoading(false);
        setRoomsLoaded(true);
        if (!result?.success) {
          setRoomsError(result?.error || '방 현황을 불러오지 못했습니다.');
          return;
        }
        setOpenRooms(Array.isArray(result.rooms) ? result.rooms : []);
        setRoomsUpdatedAt(Date.now());
      });
    };
    if (!socket.connected) {
      setRoomsLoading(true);
      if (!roomListQueuedRef.current) {
        roomListQueuedRef.current = true;
        socket.once('connect', requestList);
        socket.connect();
      }
      return;
    }
    requestList();
  }, [socket]);

  useEffect(() => {
    if (screen !== 'lobby') return undefined;
    refreshOpenRooms();
    const interval = window.setInterval(refreshOpenRooms, 5000);
    return () => window.clearInterval(interval);
  }, [screen, refreshOpenRooms]);

  const keepInputVisible = useCallback((event) => {
    const input = event.currentTarget;
    window.setTimeout(() => input?.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'smooth' }), 180);
  }, []);

  // Listen for room:state and room:resumed broadcast
  useEffect(() => {
    if (!socket) return;

    const handleRoomState = (state) => {
      if (!state) return;
      if (!roomSessionRef.current.allows(state)) {
        roomSessionRef.current.buffer(state);
        return;
      }
      // A saved session from a fresh visit must be decided in the reconnect
      // dialog before any room broadcast can navigate the player to a table.
      if (reconnectOffer && screen !== 'waitingRoom' && screen !== 'game') return;
      setRoomState(state);
      if (state.gameState === 'LOBBY') {
        setScreen('waitingRoom');
      } else {
        setScreen('game');
      }
    };

    const handleRoomResumed = (payload) => {
      if (!roomSessionRef.current.matches({ roomCode: payload?.roomCode })) return;
      setRoomState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          isPaused: false,
          pausedPlayerId: null,
          pauseExpiresAt: null,
        };
      });
      setToastMessage('플레이어가 복귀하여 게임이 재개되었습니다!');
      sfx.playTurnAlert();
    };

    socket.on('room:state', handleRoomState);
    socket.on('room:resumed', handleRoomResumed);
    socket.on('room:unavailable', handleRoomUnavailable);

    const handleChatMessage = (message) => {
      if (!message?.id) return;
      setRoomState((previous) => {
        if (!previous) return previous;
        const messages = previous.chatMessages || [];
        if (messages.some((candidate) => candidate.id === message.id)) return previous;
        return { ...previous, chatMessages: [...messages, message].slice(-30) };
      });
    };
    socket.on('chat:message', handleChatMessage);

    return () => {
      socket.off('room:state', handleRoomState);
      socket.off('room:resumed', handleRoomResumed);
      socket.off('room:unavailable', handleRoomUnavailable);
      socket.off('chat:message', handleChatMessage);
    };
  }, [socket, sfx, reconnectOffer, screen, handleRoomUnavailable]);

  // Handle Entry (Nickname submission)
  const handleEnterLobby = (e) => {
    e?.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) return;

    const userObj = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      nickname: trimmed,
      avatarUrl,
    };
    setCurrentUser(userObj);
    saveSession({
      nickname: trimmed,
      avatarUrl,
    });
    setScreen('lobby');
    sfx.playCardDraw();
  };

  const handleRefreshAvatar = () => {
    setAvatarSeed(`wish_${Math.random().toString(36).substr(2, 6)}`);
    sfx.playCardDraw();
  };

  const handleOpenProfileModal = () => {
    setEditNickname(currentUser?.nickname || nickname || '');
    setEditAvatarSeed(avatarSeed);
    setProfileModalOpen(true);
  };

  const handleRefreshEditAvatar = () => {
    setEditAvatarSeed(`wish_${Math.random().toString(36).substr(2, 6)}`);
    sfx.playCardDraw();
  };

  const handleSaveProfile = (e) => {
    e?.preventDefault();
    const trimmed = editNickname.trim();
    if (!trimmed) return;

    const newAvatarUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${editAvatarSeed}&backgroundColor=090d16,1e293b,3b0b17,047857`;
    const updatedUser = {
      ...(currentUser || {}),
      id: currentUser?.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      nickname: trimmed,
      avatarUrl: newAvatarUrl,
    };

    setNickname(trimmed);
    setAvatarSeed(editAvatarSeed);
    setCurrentUser(updatedUser);
    // Editing a profile must not erase an active room's recovery token.
    saveSession({ ...(loadSession() || {}), ...updatedUser });
    setProfileModalOpen(false);
    setToastMessage('프로필이 성공적으로 변경되었습니다.');
    sfx.playCardDraw();
  };

  // Open Room Creation Dialog
  const handleOpenCreateDialog = (gameKey) => {
    if (gameKey !== 'LOVE_LETTER' && gameKey !== 'DALMUTI') {
      setToastMessage('해당 게임은 현재 개발 중입니다! 곧 출시됩니다.');
      return;
    }
    setSelectedGameForCreate(gameKey);
    if (gameKey === 'DALMUTI') {
      setMaxPlayers((value) => value < 4 ? 6 : Math.min(8, value));
      setTurnTimeLimit((value) => value === 60 ? 30 : value);
    } else {
      setMaxPlayers((value) => Math.min(6, value));
    }
    setCreateDialogOpen(true);
  };

  // Submit Room Creation
  const handleCreateRoomSubmit = () => {
    if (!socket) return;
    invalidateRoomSession();
    const request = roomSessionRef.current.begin(null, null);
    sfx.playCardPlay();

    const currentNick = currentUser?.nickname || nickname.trim() || '방장';
    const currentAvatar = currentUser?.avatarUrl || avatarUrl;

    socket.emit(
      'room:create',
      {
        gameType: selectedGameForCreate,
        nickname: currentNick,
        avatarUrl: currentAvatar,
        targetTokens,
        maxPlayers,
        turnTimeLimit,
        roundCount,
        useStrippedDeck,
        philanthropicScoring,
        merchantExchange,
      },
      (res) => {
        if (!roomSessionRef.current.isCurrent(request)) return;
        if (res?.success) {
          roomSessionRef.current.accept(request, res.roomCode, res.userId);
          const updatedUser = {
            id: res.userId,
            sessionToken: res.sessionToken,
            nickname: currentNick,
            avatarUrl: currentAvatar,
          };
          saveSession({
            roomCode: res.roomCode,
            ...updatedUser,
          });
          setCurrentUser(updatedUser);
          const buffered = roomSessionRef.current.takeBuffered();
          if (buffered) setRoomState(buffered);
          setCreateDialogOpen(false);
          setScreen('waitingRoom');
        } else {
          roomSessionRef.current.invalidate();
          setToastMessage(res?.error || '방 생성에 실패했습니다.');
        }
      }
    );
  };

  // Join Room by Code
  const handleJoinRoom = (e) => {
    e?.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code || !socket) return;
    invalidateRoomSession();
    const request = roomSessionRef.current.begin(code, null);

    sfx.playCardPlay();
    const currentNick = currentUser?.nickname || nickname.trim() || '플레이어';
    const currentAvatar = currentUser?.avatarUrl || avatarUrl;

    socket.emit(
      'room:join',
      {
        roomCode: code,
        nickname: currentNick,
        avatarUrl: currentAvatar,
      },
      (res) => {
        if (!roomSessionRef.current.isCurrent(request)) return;
        if (res?.success) {
          roomSessionRef.current.accept(request, res.roomCode, res.userId);
          const updatedUser = {
            id: res.userId,
            sessionToken: res.sessionToken,
            nickname: currentNick,
            avatarUrl: currentAvatar,
          };
          saveSession({
            roomCode: res.roomCode,
            ...updatedUser,
          });
          setCurrentUser(updatedUser);
          const buffered = roomSessionRef.current.takeBuffered();
          if (buffered) setRoomState(buffered);
          setScreen('waitingRoom');
        } else {
          roomSessionRef.current.invalidate();
          setToastMessage(res?.error || '방 입장에 실패했습니다.');
        }
      }
    );
  };

  // Toggle Ready Status in Waiting Room
  const handleToggleReady = () => {
    if (!socket) return;
    sfx.playCardDraw();
    socket.emit('room:ready', {
      roomCode: roomState?.code,
      userId: currentUser?.id,
    });
  };

  // Add AI Bot to Room
  const handleAddBot = () => {
    if (!socket) return;
    sfx.playCardDraw();
    socket.emit(
      'room:add-bot',
      {
        roomCode: roomState?.code,
        userId: currentUser?.id,
      },
      (res) => {
        if (!res?.success) {
          setToastMessage(res?.error || 'AI 봇 추가 실패');
        }
        // Entry/exit is a shared, persistent system message. The server sends
        // it through chat:message, so do not also cover the lower UI with a
        // local toast that only one participant sees.
      }
    );
  };

  // Remove AI Bot from Room
  const handleRemoveBot = (botId) => {
    if (!socket) return;
    sfx.playCardDraw();
    socket.emit(
      'room:remove-bot',
      {
        roomCode: roomState?.code,
        userId: currentUser?.id,
        botId,
      },
      (res) => {
        if (!res?.success) {
          setToastMessage(res?.error || 'AI 봇 제거 실패');
        }
      }
    );
  };

  // Host Starts Game
  const handleStartGame = () => {
    if (!socket) return;
    sfx.playCardPlay();
    socket.emit(
      roomState?.gameType === 'DALMUTI' ? 'dalmuti:start' : 'game:start',
      {
        roomCode: roomState?.code,
        userId: currentUser?.id,
      },
      (res) => {
        if (!res?.success) {
          setToastMessage(res?.error || '게임을 시작할 수 없습니다.');
        }
      }
    );
  };

  // Send Waiting Room Chat
  const handleSendChat = (eventOrText) => {
    eventOrText?.preventDefault?.();
    const text = typeof eventOrText === 'string' ? eventOrText.trim() : chatInput.trim();
    if (!text || !socket) return;
    socket.emit('chat:message', {
      roomCode: roomState?.code,
      userId: currentUser?.id,
      text,
    });
    setChatInput('');
  };

  // Copy Room Code to Clipboard
  const handleCopyCode = () => {
    if (!roomState?.code) return;
    navigator.clipboard.writeText(roomState.code);
    setCopiedCode(true);
    setToastMessage(`방 코드 [${roomState.code}] 가 클립보드에 복사되었습니다.`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Leave Room
  const handleLeaveRoom = ({ immediate = false } = {}) => {
    const isPlaying = roomState?.gameState === 'PLAYING';
    if (isPlaying && !immediate && !window.confirm('진행 중인 게임에서 나가면 기권 처리됩니다. 나갈까요?')) return;
    const departingSession = loadSession();
    invalidateRoomSession();
    const departureGeneration = roomSessionRef.current.version();

    let completed = false;
    const finishLeave = () => {
      if (roomSessionRef.current.version() !== departureGeneration) return;
      if (completed) return;
      completed = true;
      clearSession();
      setReconnectOffer(null);
      setCurrentUser(previous => previous ? { ...previous, sessionToken: null } : previous);
      setRoomState(null);
      setScreen('lobby');
    };

    if (!socket) {
      finishLeave();
      return;
    }

    // A network request is still sent, but leaving the local table must never
    // depend on a callback from a connection that is currently recovering.
    const fallback = window.setTimeout(finishLeave, 800);
    socket.emit(isPlaying ? 'room:forfeit' : 'room:leave', {
      roomCode: roomState?.code,
      userId: currentUser?.id,
      sessionToken: departingSession?.sessionToken,
    }, (result) => {
      if (roomSessionRef.current.version() !== departureGeneration) return;
      if (fallback) window.clearTimeout(fallback);
      if (!result?.success) {
        finishLeave();
        if (terminalSessionCode(result)) setToastMessage(sessionEndMessages[terminalSessionCode(result)]);
        return;
      }
      finishLeave();
    });
  };

  const isHost = roomState?.hostId === currentUser?.id;
  const myPlayer = roomState?.players?.find((p) => p.id === currentUser?.id);
  const allReady = roomState?.players?.every((p) => p.id === roomState.hostId || p.isReady);

  return (
    <AppContainer $isGame={screen === 'game'} $entryViewportHeight={screen === 'entry' ? visualViewport.height : null}>
      {/* Global Toast */}
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />

      <Dialog open={!!reconnectOffer}>
        <DialogHeader><DialogTitle>진행 중인 방을 찾았습니다</DialogTitle><DialogDescription>이전 방에 다시 접속할지, 이 방에서 나갈지 선택해 주세요.</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button $variant="secondary" onClick={handleDeclineReconnect}>방에서 나가기</Button>
          <Button $variant="gold" onClick={() => { const saved = reconnectOffer; setReconnectOffer(null); handleReconnectRequest(saved); }}>재접속</Button>
        </DialogFooter>
      </Dialog>

      {/* Top Header (Hidden during full-screen game) */}
      {screen !== 'game' && (
        <AppHeader>
          <BrandLogo>
            <span className="logo-seal">
              <img src="/assets/owner_logo.jpg" alt="Wish" />
            </span>
            <span>
              WISH <span className="salon-text">SALON</span>
            </span>
          </BrandLogo>

          {currentUser?.nickname && screen !== 'entry' && (
            <UserProfileChip
              onClick={handleOpenProfileModal}
              style={{ cursor: 'pointer' }}
              title="프로필 / 닉네임 변경"
            >
              <img src={currentUser.avatarUrl} alt={currentUser.nickname} />
              <span>{currentUser.nickname}</span>
              <Edit2 size={12} color={THEME.mutedForeground} style={{ marginLeft: '2px' }} />
            </UserProfileChip>
          )}
        </AppHeader>
      )}

      <MainContent $isGame={screen === 'game'} $isEntry={screen === 'entry'} $entryViewportHeight={visualViewport.height}>
        {/* ========================================================= */}
        {/* SCREEN 1: Entry / Nickname Input */}
        {/* ========================================================= */}
        {screen === 'entry' && (
          <Card style={{ maxWidth: '440px', width: '100%', padding: '14px' }}>
            <CardHeader style={{ textAlign: 'center', alignItems: 'center' }}>
              <MonogramSeal>
                <img src="/assets/owner_logo.jpg" alt="Wish" />
              </MonogramSeal>
              <CardTitle style={{ fontSize: '1.6rem', justifyContent: 'center', letterSpacing: '0.08em' }}>
                WISH SALON
              </CardTitle>
              <CardDescription style={{ fontFamily: THEME.font.koreanSerif, fontSize: '14px', color: '#475569', marginTop: '2px' }}>
                프라이빗 실시간 보드게임 라운지
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleEnterLobby} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      position: 'relative',
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      border: `2px solid ${THEME.gold}`,
                      boxShadow: '0 4px 14px rgba(9, 13, 22, 0.15)',
                      overflow: 'hidden',
                      backgroundColor: '#090d16',
                    }}
                  >
                    <img
                      src={avatarUrl}
                      alt="Avatar Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <Button
                    type="button"
                    $variant="ghost"
                    $size="sm"
                    onClick={handleRefreshAvatar}
                    style={{ fontSize: '12px', color: '#64748b' }}
                  >
                    <RotateCcw size={13} />
                    <span>문양 씰 변경</span>
                  </Button>
                </div>

                <div>
                  <label style={{ fontFamily: THEME.font.serif, fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', color: THEME.mutedForeground, display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                    NICKNAME (닉네임)
                  </label>
                  <Input
                    type="text"
                    placeholder="살롱에서 사용할 닉네임 입력"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={12}
                    autoFocus
                    onFocus={keepInputVisible}
                  />
                </div>

                <Button
                  type="submit"
                  $variant="default"
                  $size="lg"
                  $fullWidth
                  disabled={!nickname.trim()}
                  style={{ letterSpacing: '0.12em' }}
                >
                  <span>ENTER SALON</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ========================================================= */}
        {/* SCREEN 2: Lobby (Tabs + Game Cards Grid) */}
        {/* ========================================================= */}
        {screen === 'lobby' && (
          <div style={{ width: '100%', minWidth: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: '100%', minWidth: 0, display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '20px' }}>
              <LobbySegmentedNav aria-label="로비 메뉴">
                <LobbySegmentButton
                  $active={activeTab === 'games'}
                  onClick={() => setActiveTab('games')}
                >
                  <span className="desktop-label">SALON GAMES</span><span className="mobile-label">게임</span>
                </LobbySegmentButton>
                <LobbySegmentButton
                  $active={activeTab === 'rooms'}
                  onClick={() => setActiveTab('rooms')}
                >
                  <span className="desktop-label">ROOM STATUS</span><span className="mobile-label">방 현황</span>
                </LobbySegmentButton>
                <LobbySegmentButton
                  $active={activeTab === 'join'}
                  onClick={() => setActiveTab('join')}
                >
                  <span className="desktop-label">ENTER CODE</span><span className="mobile-label">코드 입장</span>
                </LobbySegmentButton>
              </LobbySegmentedNav>
            </div>

            <TabsContent style={{ marginTop: '0', width: '100%' }}>
              {activeTab === 'games' && (
                <GameGrid>
                  {/* Game 1: Love Letter (Live) */}
                  <Card $hoverable onClick={() => handleOpenCreateDialog('LOVE_LETTER')}>
                    <CardHeader>
                      <GameThumbnail $bg="linear-gradient(135deg, #791a30 0%, #3b0b17 54%, #090d16 100%)">
                        <span className="emblem-title">LOVE LETTER</span>
                        <span className="emblem-sub">ROYAL COURT</span>
                      </GameThumbnail>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <CardTitle>러브레터</CardTitle>
                        <Badge $variant="emerald">LIVE</Badge>
                      </div>
                      <CardDescription>
                        2~6인 · 15분 · 르네상스 왕실 심리전
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                        공주에게 비밀 연애편지를 전달하세요. 상대의 카드를 추리하고 저격하는 클래식 명작 카드 게임.
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button $variant="default" $size="sm" $fullWidth>
                        <Play size={13} />
                        <span>입장 / 테이블 생성</span>
                      </Button>
                    </CardFooter>
                  </Card>

                  {/* Game 2: The Great Dalmuti */}
                  <Card $hoverable onClick={() => handleOpenCreateDialog('DALMUTI')}>
                    <CardHeader>
                      <GameThumbnail $bg="linear-gradient(135deg, #312e81 0%, #090d16 100%)">
                        <span className="emblem-title">THE DALMUTI</span>
                        <span className="emblem-sub">CLASS STRUGGLE</span>
                      </GameThumbnail>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <CardTitle>달무티</CardTitle>
                        <Badge $variant="emerald">LIVE</Badge>
                      </div>
                      <CardDescription>
                        4~8인 · 30분 · 계급 역전 카드 게임
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                        달무티부터 농노까지 치열한 계급 투쟁이 펼쳐지는 명작 보드게임.
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button $variant="default" $size="sm" $fullWidth>
                        <Play size={13} />
                        입장 / 테이블 생성
                      </Button>
                    </CardFooter>
                  </Card>

                  {/* Game 3: Liar Game (Coming Soon) */}
                  <Card $hoverable onClick={() => handleOpenCreateDialog('LIAR_GAME')} style={{ opacity: 0.6 }}>
                    <CardHeader>
                      <GameThumbnail $bg="linear-gradient(135deg, #3b0b17 0%, #090d16 100%)">
                        <span className="emblem-title">THE LIAR</span>
                        <span className="emblem-sub">DECEPTION</span>
                      </GameThumbnail>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <CardTitle>라이어 게임</CardTitle>
                        <Badge $variant="outline">COMING SOON</Badge>
                      </div>
                      <CardDescription>
                        3~8인 · 20분 · 심리 추리
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                        단 한 명의 라이어는 제시어를 모릅니다. 정체를 숨기고 자연스럽게 설명하세요.
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button $variant="secondary" $size="sm" $fullWidth disabled>
                        준비 중
                      </Button>
                    </CardFooter>
                  </Card>
                </GameGrid>
              )}

              {activeTab === 'join' && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', minHeight: '380px' }}>
                  <Card style={{ maxWidth: '460px', width: '100%', padding: '8px' }}>
                    <CardHeader style={{ textAlign: 'center' }}>
                      <CardTitle style={{ justifyContent: 'center' }}>초대 코드로 입장</CardTitle>
                      <CardDescription>
                        공유받은 6자리 살롱 코드를 입력하세요.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <Input
                          type="text"
                          placeholder="예: 7BK9XP"
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                          maxLength={6}
                          style={{ fontSize: '20px', textAlign: 'center', letterSpacing: '6px', fontWeight: 800, fontFamily: THEME.font.mono }}
                          autoFocus
                        />
                        <Button type="submit" $variant="default" $size="lg" $fullWidth disabled={joinCodeInput.length < 4}>
                          살롱 입장하기
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'rooms' && (
                <div style={{ width: '100%', maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(() => {
                    const saved = loadSession();
                    return saved?.roomCode && saved?.userId && saved?.sessionToken ? (
                      <Card style={{ borderColor: THEME.gold }}><CardContent style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}><div style={{ minWidth: 0 }}><strong style={{ fontSize: '13px' }}>내가 있던 방</strong><div style={{ fontSize: '11px', color: THEME.mutedForeground, marginTop: '3px' }}>코드 {saved.roomCode} · 다시 연결할 수 있습니다.</div></div><Button $variant="gold" $size="sm" onClick={() => handleReconnectRequest(saved)}>다시 접속</Button></CardContent></Card>
                    ) : null;
                  })()}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div><CardTitle>열린 방 현황</CardTitle><CardDescription>방 코드는 숨겨지며 여기서 입장할 수 없습니다.</CardDescription></div>
                    <Button $variant="secondary" $size="sm" onClick={refreshOpenRooms}>새로고침</Button>
                  </div>
                  {roomsLoading && !roomsLoaded ? <Card><CardContent style={{ padding: '24px', textAlign: 'center', color: THEME.mutedForeground }}>열린 방 현황을 불러오는 중입니다…</CardContent></Card> : null}
                  {roomsError ? <Card><CardContent style={{ padding: '24px', textAlign: 'center', color: THEME.burgundy }}>{roomsError}</CardContent></Card> : null}
                  {roomsLoaded && !roomsLoading && !roomsError && openRooms.length === 0 ? <Card><CardContent style={{ padding: '24px', textAlign: 'center', color: THEME.mutedForeground }}>현재 표시할 활성 방이 없습니다.</CardContent></Card> : null}
                  {openRooms.map((room) => (
                    <Card key={room.id} style={{ cursor: 'default' }}>
                      <CardContent style={{ padding: '13px 16px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: '10px' }}>
                        <div style={{ minWidth: 0 }}><strong style={{ fontSize: '14px' }}>{room.hostName}의 {room.gameType === 'DALMUTI' ? '달무티' : '러브레터'}</strong><div style={{ fontSize: '11px', color: THEME.mutedForeground, marginTop: '4px' }}>라운드 {room.roundNumber} · {room.gameType === 'DALMUTI' ? `${room.roundCount || 10}라운드제` : `목표 ${room.targetTokens}`} · 사람 {room.humanCount} / AI {room.botCount}</div></div>
                        <div style={{ textAlign: 'right', fontSize: '11px', fontWeight: 800 }}><Badge $variant={room.status === 'PLAYING' ? 'burgundy' : room.status === 'RECONNECTING' ? 'outline' : 'emerald'}>{room.status === 'RECONNECTING' ? '재접속 대기' : room.status}</Badge><div style={{ marginTop: '5px', color: THEME.mutedForeground }}>{room.connectedCount}/{room.playerCount} 연결 · 최대 {room.maxPlayers}</div></div>
                      </CardContent>
                    </Card>
                  ))}
                  {roomsUpdatedAt ? <div style={{ textAlign: 'right', fontSize: '10px', color: THEME.mutedForeground }}>방 현황은 5초마다 갱신됩니다.</div> : null}
                </div>
              )}
            </TabsContent>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCREEN 3: Waiting Room */}
        {/* ========================================================= */}
        {screen === 'waitingRoom' && (
          <Card style={{ maxWidth: '640px', width: '100%' }}>
            <CardHeader>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <CardTitle>{roomState?.gameType === 'DALMUTI' ? '달무티 계급 살롱' : '러브레터 살롱'}</CardTitle>
                  <CardDescription>
                    {roomState?.gameType === 'DALMUTI' ? `${roomState?.roundCount || 10}라운드 · 4~8인` : `목표 토큰 ${roomState?.targetTokens || 4}개`} · 턴 제한시간 {roomState?.turnTimeLimit === 0 ? '무제한' : `${roomState?.turnTimeLimit ?? 60}초`}
                  </CardDescription>
                </div>

                <Button $variant="outline" $size="sm" onClick={handleCopyCode}>
                  {copiedCode ? <Check size={14} color={THEME.emerald} /> : <Copy size={14} />}
                  <span style={{ fontWeight: 800, letterSpacing: '1px' }}>{roomState?.code || '------'}</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontFamily: THEME.font.serif, fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: THEME.gold, textTransform: 'uppercase' }}>
                  PLAYERS ({roomState?.players?.length || 0}/{roomState?.maxPlayers || 4}) · {roomState?.gameType === 'DALMUTI' ? '최소 4인' : '최소 2인'}
                </div>
                {isHost && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Button
                      $variant="outline"
                      $size="sm"
                      onClick={handleAddBot}
                      disabled={(roomState?.players?.length || 0) >= (roomState?.maxPlayers || 4)}
                      style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                    >
                      <UserPlus size={13} />
                      <span style={{ marginLeft: '4px' }}>+ AI 봇 추가</span>
                    </Button>
                    {roomState?.players?.some((p) => p.isBot) && (
                      <Button
                        $variant="secondary"
                        $size="sm"
                        onClick={() => handleRemoveBot()}
                        style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                      >
                        <Trash2 size={13} />
                        <span style={{ marginLeft: '4px' }}>- 봇 제거</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(roomState?.players || []).map((p) => {
                  const isPlayerHost = p.id === roomState?.hostId;
                  const isMe = p.id === currentUser?.id;

                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        backgroundColor: '#ffffff',
                        borderRadius: THEME.radius.md,
                        border: `1px solid ${isMe ? THEME.gold : p.isBot ? 'rgba(197, 160, 89, 0.4)' : '#e2e8f0'}`,
                        boxShadow: '0 1px 4px rgba(9, 13, 22, 0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={p.avatarUrl}
                          alt={p.nickname || '플레이어'}
                          style={{ width: '34px', height: '34px', borderRadius: '50%', border: `1px solid ${p.isBot ? THEME.emerald : THEME.gold}` }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {p.nickname || '플레이어'}
                            {isPlayerHost && <Crown size={14} color={THEME.gold} />}
                            {isMe && <span style={{ fontSize: '11px', color: THEME.goldAntique }}>(나)</span>}
                          </div>
                        </div>
                      </div>

                      <div>
                        {p.isBot ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isHost && (
                              <button
                                style={{ background: 'transparent', border: 'none', color: THEME.rose, cursor: 'pointer', padding: '2px 4px', fontSize: '12px' }}
                                onClick={() => handleRemoveBot(p.id)}
                                title="봇 제거"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ) : isPlayerHost ? (
                          <Badge $variant="gold">HOST</Badge>
                        ) : p.isReady ? (
                          <Badge $variant="emerald">READY</Badge>
                        ) : (
                          <Badge $variant="outline">WAITING</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '12px' }}><RoomVoiceControls voice={webrtc} compact /></div>

              <RoomChat messages={roomState?.chatMessages || []} onSend={handleSendChat} />
            </CardContent>

            <CardFooter style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: '16px' }}>
              <Button $variant="destructive" $size="sm" onClick={handleLeaveRoom}>
                <LogOut size={15} />
                <span>나가기</span>
              </Button>

              <div style={{ display: 'flex', gap: '10px' }}>
                {!isHost && (
                  <Button
                    $variant={myPlayer?.isReady ? 'default' : 'gold'}
                    onClick={handleToggleReady}
                  >
                    {myPlayer?.isReady ? '준비 취소' : '준비 완료'}
                  </Button>
                )}

                {isHost && (
                  <Button
                    $variant="gold"
                    onClick={handleStartGame}
                    disabled={(roomState?.players?.length || 0) < (roomState?.gameType === 'DALMUTI' ? 4 : 2) || !allReady}
                  >
                    <Play size={16} />
                    <span>게임 시작</span>
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        )}

        {/* ========================================================= */}
        {/* SCREEN 4: Game-specific board */}
        {/* ========================================================= */}
        {screen === 'game' && roomState && (
          <Suspense fallback={<GameLoadingScreen><div>TABLE PREPARING<span>게임 테이블을 준비하고 있습니다</span></div></GameLoadingScreen>}>
          {roomState.gameType === 'DALMUTI' ? <DalmutiGame
            roomState={roomState}
            currentUser={currentUser}
            socket={socket}
            webrtc={webrtc}
            stt={stt}
            chatMessages={roomState?.chatMessages || []}
            onSendChat={handleSendChat}
            onLeave={handleLeaveRoom}
            onRoomUnavailable={handleRoomUnavailable}
          /> : <LoveLetterGame
            roomState={roomState}
            currentUser={currentUser}
            socket={socket}
            webrtc={webrtc}
            stt={stt}
            chatMessages={roomState?.chatMessages || []}
            onSendChat={handleSendChat}
            onLeave={handleLeaveRoom}
          />}
          </Suspense>
        )}
      </MainContent>

      {/* ========================================================= */}
      {/* DIALOG: Create Room Settings */}
      {/* ========================================================= */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>{selectedGameForCreate === 'DALMUTI' ? '달무티 계급 살롱 테이블 생성' : '러브레터 살롱 테이블 생성'}</DialogTitle>
          <DialogDescription>{selectedGameForCreate === 'DALMUTI' ? '라운드 수와 공식 선택 규칙을 설정하세요.' : '게임 목표 토큰 및 규칙을 설정하세요.'}</DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', margin: '16px 0' }}>
          {selectedGameForCreate === 'LOVE_LETTER' && <div>
            <label style={{ fontFamily: THEME.font.serif, fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: THEME.gold, display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
              VICTORY TARGET (승리 목표 토큰): {targetTokens}개
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[2, 3, 4, 5, 7].map((num) => (
                <Button
                  key={num}
                  type="button"
                  $variant={targetTokens === num ? 'default' : 'secondary'}
                  $size="sm"
                  onClick={() => setTargetTokens(num)}
                  style={{ flex: 1, borderColor: targetTokens === num ? THEME.gold : THEME.border }}
                >
                  {num}개
                </Button>
              ))}
            </div>
          </div>}

          {selectedGameForCreate === 'DALMUTI' && <div>
            <label style={{ fontFamily: THEME.font.serif, fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: THEME.gold, display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
              MATCH ROUNDS (매치 라운드): {roundCount}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[5, 10, 20].map((num) => <Button key={num} type="button" $variant={roundCount === num ? 'default' : 'secondary'} $size="sm" onClick={() => setRoundCount(num)} style={{ flex: 1 }}>{num}라운드</Button>)}
            </div>
          </div>}

          <div>
            <label style={{ fontFamily: THEME.font.serif, fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: THEME.gold, display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
              MAX PLAYERS (최대 플레이 인원): {maxPlayers}명
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(selectedGameForCreate === 'DALMUTI' ? [4, 5, 6, 7, 8] : [2, 3, 4, 5, 6]).map((num) => (
                <Button
                  key={num}
                  type="button"
                  $variant={maxPlayers === num ? 'default' : 'secondary'}
                  $size="sm"
                  onClick={() => setMaxPlayers(num)}
                  style={{ flex: 1, borderColor: maxPlayers === num ? THEME.gold : THEME.border }}
                >
                  {num}인
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontFamily: THEME.font.serif, fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: THEME.gold, display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
              TURN TIME LIMIT (턴 제한시간): {turnTimeLimit === 0 ? '무제한' : `${turnTimeLimit}초`}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[30, 60, 90, 0].map((sec) => (
                <Button
                  key={sec}
                  type="button"
                  $variant={turnTimeLimit === sec ? 'default' : 'secondary'}
                  $size="sm"
                  onClick={() => setTurnTimeLimit(sec)}
                  style={{ flex: 1, borderColor: turnTimeLimit === sec ? THEME.gold : THEME.border }}
                >
                  {sec === 0 ? '무제한' : `${sec}초`}
                </Button>
              ))}
            </div>
          </div>

          {selectedGameForCreate === 'DALMUTI' && <div style={{ display: 'grid', gap: '8px' }}>
            {[
              ['4·5인 축소 덱', useStrippedDeck, setUseStrippedDeck],
              ['자선 점수', philanthropicScoring, setPhilanthropicScoring],
              ['상인 무작위 교환', merchantExchange, setMerchantExchange],
            ].map(([label, checked, setter]) => <label key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '9px 11px', border: `1px solid ${checked ? THEME.gold : THEME.border}`, borderRadius: THEME.radius.md, background: checked ? '#fffdf3' : '#fff', fontSize: '12px', fontWeight: 750, cursor: 'pointer' }}>
              <span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => setter(event.target.checked)}/>
            </label>)}
          </div>}
        </div>

        <DialogFooter>
          <Button $variant="outline" $size="sm" onClick={() => setCreateDialogOpen(false)}>
            취소
          </Button>
          <Button $variant="default" $size="sm" onClick={handleCreateRoomSubmit}>
            살롱 테이블 개설
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ========================================================= */}
      {/* DIALOG: Edit Profile Modal */}
      {/* ========================================================= */}
      <Dialog open={profileModalOpen} onClose={() => setProfileModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>프로필 및 닉네임 설정</DialogTitle>
          <DialogDescription>살롱에서 사용할 닉네임과 문양 씰을 변경하세요.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px', margin: '16px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                position: 'relative',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                border: `2px solid ${THEME.gold}`,
                boxShadow: '0 4px 14px rgba(9, 13, 22, 0.15)',
                overflow: 'hidden',
                backgroundColor: '#090d16',
              }}
            >
              <img
                src={`https://api.dicebear.com/7.x/shapes/svg?seed=${editAvatarSeed}&backgroundColor=090d16,1e293b,3b0b17,047857`}
                alt="Avatar Edit Preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <Button
              type="button"
              $variant="ghost"
              $size="sm"
              onClick={handleRefreshEditAvatar}
              style={{ fontSize: '12px', color: '#64748b' }}
            >
              <RotateCcw size={13} />
              <span>문양 씰 변경</span>
            </Button>
          </div>

          <div>
            <label style={{ fontFamily: THEME.font.serif, fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: THEME.gold, display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
              NICKNAME (닉네임)
            </label>
            <Input
              type="text"
              placeholder="새 닉네임 입력"
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
              maxLength={12}
              autoFocus
              onFocus={keepInputVisible}
            />
          </div>

          <DialogFooter>
            <Button type="button" $variant="outline" $size="sm" onClick={() => setProfileModalOpen(false)}>
              취소
            </Button>
            <Button type="submit" $variant="default" $size="sm" disabled={!editNickname.trim()}>
              저장하기
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </AppContainer>
  );
}
