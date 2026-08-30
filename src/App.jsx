import React, { useState, useEffect, useCallback } from 'react';
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
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Input,
  Toast,
} from './shared/components';
import { useSocket } from './shared/useSocket';
import { useWebRTC } from './shared/useWebRTC';
import { useSTT } from './shared/useSTT';
import { sfx } from './shared/sfx';
import {
  useSessionGuard,
  saveSession,
  loadSession,
  clearSession,
} from './shared/useSessionGuard';
import LoveLetterBoard from './games/love-letter/LoveLetterBoard';
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
} from 'lucide-react';

// =========================================================================
// App Container & Layout
// =========================================================================

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  background-color: ${THEME.background};
  color: ${THEME.foreground};
  font-family: ${THEME.font.sans};
  position: relative;
  overflow-x: hidden;
`;

const AppHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background-color: rgba(9, 9, 11, 0.85);
  border-bottom: 1px solid ${THEME.border};
  backdrop-filter: blur(8px);
  z-index: 100;
`;

const BrandLogo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.15rem;
  font-weight: 700;
  color: ${THEME.foreground};
  letter-spacing: -0.02em;

  span.logo-icon {
    font-size: 1.4rem;
  }

  span.gold-text {
    color: ${THEME.gold};
  }
`;

const UserProfileChip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: ${THEME.secondary};
  padding: 4px 12px;
  border-radius: ${THEME.radius.full};
  border: 1px solid ${THEME.border};
  font-size: 13px;
  font-weight: 600;

  img {
    width: 22px;
    height: 22px;
    border-radius: 50%;
  }
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: ${({ $isGame }) => ($isGame ? 'flex-start' : 'center')};
  padding: ${({ $isGame }) => ($isGame ? '0' : '24px 16px')};
  max-width: ${({ $isGame }) => ($isGame ? '100%' : '1080px')};
  width: 100%;
  margin: 0 auto;
`;

// Game Card Grid Layout
const GameGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  width: 100%;
  margin-top: 16px;
`;

const GameThumbnail = styled.div`
  height: 140px;
  border-radius: ${THEME.radius.lg};
  background: ${({ $bg }) => $bg || THEME.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
  border: 1px solid ${THEME.border};
`;

const ChatWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 240px;
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radius.lg};
  background-color: rgba(9, 9, 11, 0.5);
  overflow: hidden;
  margin-top: 16px;
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
    font-weight: 700;
    color: ${THEME.gold};
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
  background-color: ${THEME.card};
`;

// =========================================================================
// Main App Component
// =========================================================================

export default function App() {
  const { socket, connected } = useSocket();

  // Screen State: 'entry' | 'lobby' | 'waitingRoom' | 'game'
  const [screen, setScreen] = useState('entry');

  // User State
  const [nickname, setNickname] = useState(() => {
    const saved = loadSession();
    return saved?.nickname || '';
  });
  const [avatarSeed, setAvatarSeed] = useState(() => {
    const saved = loadSession();
    return saved?.avatarUrl ? saved.avatarUrl.split('seed=')[1] || `wish_${Math.random().toString(36).substr(2, 5)}` : `wish_${Math.random().toString(36).substr(2, 5)}`;
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = loadSession();
    if (saved?.nickname) {
      return {
        id: saved.userId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sessionToken: saved.sessionToken || null,
        nickname: saved.nickname,
        avatarUrl: saved.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${saved.nickname}`,
      };
    }
    return null;
  });

  // Active Tab in Lobby: 'games' | 'join'
  const [activeTab, setActiveTab] = useState('games');

  // Room State from Server
  const [roomState, setRoomState] = useState(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Game Lobby Creation Dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedGameForCreate, setSelectedGameForCreate] = useState('LOVE_LETTER');
  const [targetTokens, setTargetTokens] = useState(4);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [turnTimeLimit, setTurnTimeLimit] = useState(60);

  // Chat message in waiting room
  const [chatInput, setChatInput] = useState('');

  // WebRTC and STT Hooks
  const webrtc = useWebRTC(socket, roomState?.code, currentUser?.id);
  const stt = useSTT(socket, roomState?.code, currentUser?.id);

  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`;

  // Handle Automatic Session Reconnect
  const handleReconnectRequest = useCallback(
    (session) => {
      if (!socket || !session?.roomCode || !session?.userId || !session?.sessionToken) return;

      socket.emit(
        'room:reconnect',
        {
          roomCode: session.roomCode,
          userId: session.userId,
          sessionToken: session.sessionToken,
        },
        (res) => {
          if (res?.success) {
            const restoredUser = {
              id: session.userId,
              sessionToken: session.sessionToken,
              nickname: session.nickname || res.player?.nickname || '플레이어',
              avatarUrl: session.avatarUrl || res.player?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${session.userId}`,
            };
            setCurrentUser(restoredUser);
            setRoomState(res.gameState);
            if (res.gameState?.gameState === 'LOBBY') {
              setScreen('waitingRoom');
            } else {
              setScreen('game');
            }
            setToastMessage('이전 게임 세션에 자동으로 재접속되었습니다!');
          } else {
            clearSession();
          }
        }
      );
    },
    [socket]
  );

  // Screen Wake Lock, beforeunload & visibilitychange guard hook
  useSessionGuard({
    socket,
    roomState,
    screen,
    onReconnectRequest: handleReconnectRequest,
  });

  // Attempt auto-reconnect on initial socket connection if session exists
  useEffect(() => {
    if (!socket || !connected) return;
    const session = loadSession();
    if (session && session.roomCode && session.userId && session.sessionToken) {
      handleReconnectRequest(session);
    }
  }, [socket, connected, handleReconnectRequest]);

  // Listen for room:state broadcast
  useEffect(() => {
    if (!socket) return;

    const handleRoomState = (state) => {
      if (!state) return;
      setRoomState(state);
      if (state.gameState === 'LOBBY') {
        setScreen('waitingRoom');
      } else {
        setScreen('game');
      }
    };

    socket.on('room:state', handleRoomState);
    return () => socket.off('room:state', handleRoomState);
  }, [socket]);

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

  // Open Room Creation Dialog
  const handleOpenCreateDialog = (gameKey) => {
    if (gameKey !== 'LOVE_LETTER') {
      setToastMessage('해당 게임은 현재 개발 중입니다! 곧 출시됩니다.');
      return;
    }
    setSelectedGameForCreate(gameKey);
    setCreateDialogOpen(true);
  };

  // Submit Room Creation
  const handleCreateRoomSubmit = () => {
    if (!socket) return;
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
      },
      (res) => {
        if (res?.success) {
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
          setCreateDialogOpen(false);
          setScreen('waitingRoom');
        } else {
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
        if (res?.success) {
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
          setScreen('waitingRoom');
        } else {
          setToastMessage(res?.error || '방 입장에 실패했습니다.');
        }
      }
    );
  };

  // Toggle Ready Status in Waiting Room
  const handleToggleReady = () => {
    if (!socket) return;
    sfx.playCardDraw();
    socket.emit('room:ready', {});
  };

  // Host Starts Game
  const handleStartGame = () => {
    if (!socket) return;
    sfx.playCardPlay();
    socket.emit('game:start', {}, (res) => {
      if (!res?.success) {
        setToastMessage(res?.error || '게임을 시작할 수 없습니다.');
      }
    });
  };

  // Send Waiting Room Chat
  const handleSendChat = (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || !socket) return;
    socket.emit('chat:message', { text: chatInput.trim() });
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
  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit('room:forfeit', {}, () => {});
    }
    clearSession();
    setRoomState(null);
    setScreen('lobby');
  };

  const isHost = roomState?.hostId === currentUser?.id;
  const myPlayer = roomState?.players?.find((p) => p.id === currentUser?.id);
  const allReady = roomState?.players?.every((p) => p.id === roomState.hostId || p.isReady);

  return (
    <AppContainer>
      {/* Global Toast */}
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />

      {/* Top Header (Hidden during full-screen game) */}
      {screen !== 'game' && (
        <AppHeader>
          <BrandLogo>
            <span className="logo-icon">🎲</span>
            <span>
              Wish <span className="gold-text">Boardgame Cafe</span>
            </span>
          </BrandLogo>

          {currentUser?.nickname && (
            <UserProfileChip>
              <img src={currentUser.avatarUrl} alt={currentUser.nickname} />
              <span>{currentUser.nickname}</span>
            </UserProfileChip>
          )}
        </AppHeader>
      )}

      <MainContent $isGame={screen === 'game'}>
        {/* ========================================================= */}
        {/* SCREEN 1: Entry / Nickname Input */}
        {/* ========================================================= */}
        {screen === 'entry' && (
          <Card style={{ maxWidth: '420px', width: '100%', padding: '10px' }}>
            <CardHeader style={{ textAlign: 'center', alignItems: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🎲 ☕</div>
              <CardTitle style={{ fontSize: '1.5rem', justifyContent: 'center' }}>
                위시 보드게임 카페
              </CardTitle>
              <CardDescription>
                친구들과 함께 즐기는 온라인 실시간 보드게임 라운지
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleEnterLobby} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      position: 'relative',
                      width: '76px',
                      height: '76px',
                      borderRadius: '50%',
                      border: `2px solid ${THEME.gold}`,
                      overflow: 'hidden',
                      backgroundColor: THEME.secondary,
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
                  >
                    <RotateCcw size={14} />
                    <span>아바타 변경</span>
                  </Button>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: THEME.mutedForeground, display: 'block', marginBottom: '6px' }}>
                    닉네임
                  </label>
                  <Input
                    type="text"
                    placeholder="카페에서 사용할 닉네임 입력"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={12}
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  $variant="gold"
                  $size="lg"
                  $fullWidth
                  disabled={!nickname.trim()}
                >
                  <Sparkles size={18} />
                  <span>카페 입장하기</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ========================================================= */}
        {/* SCREEN 2: Lobby (Tabs + Game Cards Grid) */}
        {/* ========================================================= */}
        {screen === 'lobby' && (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <TabsList>
                <TabsTrigger
                  $active={activeTab === 'games'}
                  onClick={() => setActiveTab('games')}
                >
                  🎮 전체 게임
                </TabsTrigger>
                <TabsTrigger
                  $active={activeTab === 'join'}
                  onClick={() => setActiveTab('join')}
                >
                  🔑 방 코드로 입장
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent>
              {activeTab === 'games' && (
                <GameGrid>
                  {/* Game 1: Love Letter (Live) */}
                  <Card $hoverable onClick={() => handleOpenCreateDialog('LOVE_LETTER')}>
                    <CardHeader>
                      <GameThumbnail $bg="linear-gradient(135deg, #1e1b4b 0%, #064e3b 100%)">
                        💌
                      </GameThumbnail>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <CardTitle>러브레터</CardTitle>
                        <Badge $variant="emerald">Live 🟢</Badge>
                      </div>
                      <CardDescription>
                        2~6인 · 15분 · 블러핑/심리전
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p style={{ fontSize: '13px', color: THEME.mutedForeground, margin: 0, lineHeight: 1.4 }}>
                        공주에게 비밀 연애편지를 전달하세요! 상대의 카드를 추리하고 저격하는 르네상스 왕실 카드 게임.
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button $variant="gold" $size="sm" $fullWidth>
                        <Play size={14} />
                        <span>방 만들기 / 참여</span>
                      </Button>
                    </CardFooter>
                  </Card>

                  {/* Game 2: The Great Dalmuti (Coming Soon) */}
                  <Card $hoverable onClick={() => handleOpenCreateDialog('DALMUTI')} style={{ opacity: 0.65 }}>
                    <CardHeader>
                      <GameThumbnail $bg="linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)">
                        👑
                      </GameThumbnail>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <CardTitle>달무티</CardTitle>
                        <Badge $variant="outline">Coming Soon</Badge>
                      </div>
                      <CardDescription>
                        4~8인 · 30분 · 계급 역전 카드 게임
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p style={{ fontSize: '13px', color: THEME.mutedForeground, margin: 0, lineHeight: 1.4 }}>
                        인생은 불공평합니다! 대달무티부터 농노까지 치열한 계급 투쟁이 펼쳐지는 명작 보드게임.
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button $variant="outline" $size="sm" $fullWidth disabled>
                        준비 중
                      </Button>
                    </CardFooter>
                  </Card>

                  {/* Game 3: Liar Game (Coming Soon) */}
                  <Card $hoverable onClick={() => handleOpenCreateDialog('LIAR_GAME')} style={{ opacity: 0.65 }}>
                    <CardHeader>
                      <GameThumbnail $bg="linear-gradient(135deg, #4c0519 0%, #18181b 100%)">
                        🕵️
                      </GameThumbnail>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <CardTitle>라이어 게임</CardTitle>
                        <Badge $variant="outline">Coming Soon</Badge>
                      </div>
                      <CardDescription>
                        3~8인 · 20분 · 추리/파티
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p style={{ fontSize: '13px', color: THEME.mutedForeground, margin: 0, lineHeight: 1.4 }}>
                        단 한 명의 라이어는 제시어를 모릅니다! 정체를 숨기고 자연스럽게 설명하세요.
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button $variant="outline" $size="sm" $fullWidth disabled>
                        준비 중
                      </Button>
                    </CardFooter>
                  </Card>
                </GameGrid>
              )}

              {activeTab === 'join' && (
                <Card style={{ maxWidth: '460px', margin: '30px auto' }}>
                  <CardHeader>
                    <CardTitle>🔑 방 코드로 입장</CardTitle>
                    <CardDescription>
                      친구가 공유해 준 6자리 방 코드를 입력하세요.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <Input
                        type="text"
                        placeholder="예: 7BK9XP"
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                        maxLength={6}
                        style={{ fontSize: '18px', textAlign: 'center', letterSpacing: '4px', fontWeight: 700 }}
                      />
                      <Button type="submit" $variant="gold" $size="lg" $fullWidth disabled={joinCodeInput.length < 4}>
                        방 입장하기
                      </Button>
                    </form>
                  </CardContent>
                </Card>
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
                  <CardTitle>💌 러브레터 대기실</CardTitle>
                  <CardDescription>
                    목표 토큰 {roomState?.targetTokens || 4}개 · 턴 제한시간 {roomState?.turnTimeLimit || 60}초
                  </CardDescription>
                </div>

                <Button $variant="outline" $size="sm" onClick={handleCopyCode}>
                  {copiedCode ? <Check size={14} color={THEME.emerald} /> : <Copy size={14} />}
                  <span style={{ fontWeight: 700, letterSpacing: '1px' }}>{roomState?.code || '------'}</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div style={{ fontSize: '13px', fontWeight: 700, color: THEME.gold, marginBottom: '10px' }}>
                참여 플레이어 ({roomState?.players?.length || 0}/{roomState?.maxPlayers || 4}명)
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
                        backgroundColor: THEME.secondary,
                        borderRadius: THEME.radius.lg,
                        border: `1px solid ${isMe ? THEME.gold : THEME.border}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={p.avatarUrl}
                          alt={p.nickname || '플레이어'}
                          style={{ width: '36px', height: '36px', borderRadius: '50%' }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {p.nickname || '플레이어'}
                            {isPlayerHost && <Crown size={14} color={THEME.gold} />}
                            {isMe && <span style={{ fontSize: '11px', color: THEME.goldLight }}>(나)</span>}
                          </div>
                        </div>
                      </div>

                      <div>
                        {isPlayerHost ? (
                          <Badge $variant="gold">방장</Badge>
                        ) : p.isReady ? (
                          <Badge $variant="emerald">준비 완료 🟢</Badge>
                        ) : (
                          <Badge $variant="outline">대기 중 ⚪</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Waiting Room Chat */}
              <ChatWrapper>
                <ChatFeed>
                  {(roomState?.chatMessages || []).map((msg) => (
                    <ChatBubble key={msg.id}>
                      <span className="name">{msg.nickname}:</span>
                      <span className="text">{msg.text}</span>
                    </ChatBubble>
                  ))}
                </ChatFeed>
                <ChatInputRow onSubmit={handleSendChat}>
                  <Input
                    type="text"
                    placeholder="채팅 메시지 입력..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <Button type="submit" $variant="ghost" $size="icon">
                    <Send size={16} />
                  </Button>
                </ChatInputRow>
              </ChatWrapper>
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
                    disabled={(roomState?.players?.length || 0) < 2 || !allReady}
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
        {/* SCREEN 4: In-Game Board (Love Letter) */}
        {/* ========================================================= */}
        {screen === 'game' && roomState && (
          <LoveLetterBoard
            roomState={roomState}
            currentUser={currentUser}
            socket={socket}
            webrtc={webrtc}
            stt={stt}
            onLeave={handleLeaveRoom}
          />
        )}
      </MainContent>

      {/* ========================================================= */}
      {/* DIALOG: Create Room Settings */}
      {/* ========================================================= */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>💌 러브레터 방 만들기</DialogTitle>
          <DialogDescription>게임 목표 토큰 및 규칙을 설정하세요.</DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '14px 0' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: THEME.gold, display: 'block', marginBottom: '8px' }}>
              🏆 승리 목표 토큰 수: {targetTokens}개
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[2, 3, 4, 5, 7].map((num) => (
                <Button
                  key={num}
                  type="button"
                  $variant={targetTokens === num ? 'gold' : 'secondary'}
                  $size="sm"
                  onClick={() => setTargetTokens(num)}
                  style={{ flex: 1 }}
                >
                  {num}개
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: THEME.gold, display: 'block', marginBottom: '8px' }}>
              👥 최대 플레이 인원: {maxPlayers}명
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[2, 3, 4, 5, 6].map((num) => (
                <Button
                  key={num}
                  type="button"
                  $variant={maxPlayers === num ? 'gold' : 'secondary'}
                  $size="sm"
                  onClick={() => setMaxPlayers(num)}
                  style={{ flex: 1 }}
                >
                  {num}인
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: THEME.gold, display: 'block', marginBottom: '8px' }}>
              ⏱️ 턴 제한시간: {turnTimeLimit === 0 ? '무제한' : `${turnTimeLimit}초`}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[30, 60, 90, 0].map((sec) => (
                <Button
                  key={sec}
                  type="button"
                  $variant={turnTimeLimit === sec ? 'gold' : 'secondary'}
                  $size="sm"
                  onClick={() => setTurnTimeLimit(sec)}
                  style={{ flex: 1 }}
                >
                  {sec === 0 ? '무제한' : `${sec}초`}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button $variant="outline" onClick={() => setCreateDialogOpen(false)}>
            취소
          </Button>
          <Button $variant="gold" onClick={handleCreateRoomSubmit}>
            방 만들기
          </Button>
        </DialogFooter>
      </Dialog>
    </AppContainer>
  );
}
