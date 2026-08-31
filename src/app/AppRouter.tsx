import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { EntryScreen } from '../screens/EntryScreen';
import { LobbyScreen } from '../screens/LobbyScreen';
import { WaitingRoomScreen } from '../screens/WaitingRoomScreen';
import { LoveLetterGame } from '../games/love-letter/ui/LoveLetterGame';
import { GameState } from '../../packages/love-letter-core/src/types';
import { useWebRTC } from '../shared/useWebRTC';
import { useSTT } from '../shared/useSTT';
import { sfx } from '../shared/sfx';

type Screen = 'ENTRY' | 'LOBBY' | 'WAITING' | 'GAME';

export const AppRouter: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('ENTRY');
  const [user, setUser] = useState<{ id: string; nickname: string; avatar: string } | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [roomState, setRoomState] = useState<any>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [mySecretHand, setMySecretHand] = useState<any[]>([]);

  // WebRTC & STT integration
  const webrtc = useWebRTC(socket, roomCode, user?.id);
  const stt = useSTT(socket, roomCode, user?.id, user?.nickname, webrtc.isMicOn);

  useEffect(() => {
    const savedNick = localStorage.getItem('wish_nickname');
    const savedAvatar = localStorage.getItem('wish_avatar') || '👑';
    const savedId = localStorage.getItem('wish_userid') || `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    localStorage.setItem('wish_userid', savedId);

    if (savedNick) {
      setUser({ id: savedId, nickname: savedNick, avatar: savedAvatar });
      setScreen('LOBBY');
    }

    const s = io(window.location.origin, { transports: ['websocket', 'polling'] });
    setSocket(s);

    s.on('room:state', (state) => {
      setRoomState(state);
      if (state.gameState === 'PLAYING' || state.gameState === 'ROUND_END' || state.gameState === 'GAME_OVER') {
        setScreen('GAME');
      } else if (state.gameState === 'LOBBY') {
        setScreen('WAITING');
      }
    });

    s.on('game:snapshot', (snapshot) => {
      if (snapshot.game) {
        setGameState(snapshot.game);
        setMySecretHand(snapshot.mySecretHand || []);
      }
    });

    return () => {
      s.disconnect();
    };
  }, []);

  const handleLogin = (nickname: string, avatar: string) => {
    const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    localStorage.setItem('wish_nickname', nickname);
    localStorage.setItem('wish_avatar', avatar);
    localStorage.setItem('wish_userid', userId);
    setUser({ id: userId, nickname, avatar });
    setScreen('LOBBY');
  };

  const handleLogout = () => {
    localStorage.removeItem('wish_nickname');
    localStorage.removeItem('wish_avatar');
    setUser(null);
    setScreen('ENTRY');
  };

  const handleCreateRoom = (gameType: string) => {
    if (!socket || !user) return;
    socket.emit('room:create', {
      gameType,
      nickname: user.nickname,
      avatarUrl: user.avatar,
      userId: user.id,
    }, (res: any) => {
      if (res && res.roomCode) {
        setRoomCode(res.roomCode);
        setScreen('WAITING');
      }
    });
  };

  const handleJoinRoom = (code: string) => {
    if (!socket || !user) return;
    socket.emit('room:join', {
      roomCode: code,
      nickname: user.nickname,
      avatarUrl: user.avatar,
      userId: user.id,
    }, (res: any) => {
      if (res && !res.error) {
        setRoomCode(code);
        setScreen('WAITING');
      } else {
        alert(res?.error || '입장에 실패했습니다.');
      }
    });
  };

  const handleAddBot = () => {
    if (!socket || !roomCode) return;
    socket.emit('room:add-bot', { roomCode });
  };

  const handleToggleReady = () => {
    if (!socket || !roomCode) return;
    socket.emit('room:toggle-ready', { roomCode });
  };

  const handleStartGame = () => {
    if (!socket || !roomCode) return;
    socket.emit('loveletter:start-game', { roomCode });
    sfx.playRoundWin();
  };

  const handlePlayCard = (cardId: string, targetId?: string, guessValue?: number) => {
    if (!socket || !roomCode) return;
    socket.emit('loveletter:play-card', {
      roomCode,
      cardId,
      targetUserId: targetId,
      guessValue,
    });
    sfx.playCardPlay();
  };

  const handleLeaveRoom = () => {
    if (socket && roomCode) {
      socket.emit('room:leave', { roomCode });
    }
    setRoomCode('');
    setRoomState(null);
    setGameState(null);
    setScreen('LOBBY');
  };

  if (screen === 'ENTRY' || !user) {
    return <EntryScreen onLogin={handleLogin} />;
  }

  if (screen === 'LOBBY') {
    return (
      <LobbyScreen
        user={user}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === 'WAITING' && roomState) {
    return (
      <WaitingRoomScreen
        roomCode={roomCode}
        players={roomState.players || []}
        isHost={roomState.hostId === socket?.id || roomState.players?.[0]?.socketId === socket?.id}
        myUserId={user.id}
        onAddBot={handleAddBot}
        onToggleReady={handleToggleReady}
        onStartGame={handleStartGame}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  if (screen === 'GAME' && gameState) {
    return (
      <LoveLetterGame
        gameState={gameState}
        myUserId={user.id}
        myHand={mySecretHand}
        socket={socket}
        speakingUsers={webrtc.speakingUsers}
        userSubtitles={stt.userSubtitles}
        isMicOn={webrtc.isMicOn}
        isSpeakerOn={webrtc.isSpeakerOn}
        isSTTActive={stt.isSTTActive}
        onToggleMic={webrtc.toggleMic}
        onToggleSpeaker={webrtc.toggleSpeaker}
        onToggleSTT={stt.toggleSTT}
        onPlayCard={handlePlayCard}
        onStartNextRound={handleStartGame}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return (
    <LobbyScreen
      user={user}
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoom}
      onLogout={handleLogout}
    />
  );
};
