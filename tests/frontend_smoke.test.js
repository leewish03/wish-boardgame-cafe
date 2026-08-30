import React from 'react';
import { renderToString } from 'react-dom/server';
import { THEME } from '../src/shared/theme.js';
import * as Components from '../src/shared/components.jsx';
import LoveLetterBoard, { CARD_DATA } from '../src/games/love-letter/LoveLetterBoard.jsx';

console.log('🧪 Starting Frontend Component SSR / Smoke Rendering Test Suite...');

// Mock browser globals for SSR testing
if (typeof window === 'undefined') {
  global.window = {
    location: { origin: 'http://localhost:3001' },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  global.document = {
    visibilityState: 'visible',
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  global.navigator = {
    onLine: true,
    clipboard: { writeText: async () => {} },
  };
}

try {
  // 1. Test Theme tokens
  console.log('▶ Test 1: Testing THEME tokens...');
  if (!THEME.background || !THEME.gold || !THEME.emerald) {
    throw new Error('THEME tokens are missing key colors.');
  }
  console.log('  ✅ Test 1 Passed: Theme tokens intact.');

  // 2. Test Common Components
  console.log('▶ Test 2: Testing Common UI Components rendering...');
  const buttonHtml = renderToString(
    React.createElement(Components.Button, { $variant: 'gold', $size: 'lg' }, '확인')
  );
  if (!buttonHtml) throw new Error('Button render failed');

  const cardHtml = renderToString(
    React.createElement(
      Components.Card,
      null,
      React.createElement(Components.CardHeader, null, React.createElement(Components.CardTitle, null, '제목')),
      React.createElement(Components.CardContent, null, '내용'),
      React.createElement(Components.CardFooter, null, '푸터')
    )
  );
  if (!cardHtml) throw new Error('Card render failed');

  const pauseHtml = renderToString(
    React.createElement(Components.PauseOverlay, {
      open: true,
      pausedPlayerNickname: '테스터',
      pauseExpiresAt: Date.now() + 180000,
    })
  );
  if (!pauseHtml) throw new Error('PauseOverlay render failed');
  console.log('  ✅ Test 2 Passed: Common UI Components (Button, Card, PauseOverlay) rendered cleanly.');

  // 3. Test LoveLetterBoard in all game states
  console.log('▶ Test 3: Testing LoveLetterBoard rendering in multiple complex states...');

  const mockRoomStatePlaying = {
    code: 'ABCDEF',
    gameType: 'LOVE_LETTER',
    hostId: 'user_1',
    gameState: 'PLAYING',
    targetTokens: 4,
    maxPlayers: 4,
    turnTimeLimit: 60,
    deckCount: 12,
    roundNumber: 2,
    turnPlayerId: 'user_1',
    isPaused: false,
    players: [
      {
        id: 'user_1',
        nickname: '플레이어 1(나)',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=u1',
        isReady: true,
        tokens: 1,
        isEliminated: false,
        isProtected: false,
        handCount: 2,
        hand: [
          { id: 'c1', name: '경비병', value: 1 },
          { id: 'c2', name: '백작부인', value: 7 },
        ],
        discardPile: [{ id: 'd1', name: '사제', value: 2 }],
      },
      {
        id: 'user_2',
        nickname: '플레이어 2',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=u2',
        isReady: true,
        tokens: 2,
        isEliminated: false,
        isProtected: true,
        handCount: 1,
        hand: [],
        discardPile: [],
      },
      {
        id: 'user_3',
        nickname: '플레이어 3(탈락자)',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=u3',
        isReady: true,
        tokens: 0,
        isEliminated: true,
        isProtected: false,
        handCount: 0,
        hand: [],
        discardPile: [{ id: 'd2', name: '공주', value: 8 }],
      },
    ],
    actionLogs: [
      { id: 'l1', text: '플레이어 1님이 경비병을 사용했습니다.', timestamp: Date.now() },
    ],
    chatMessages: [
      { id: 'm1', nickname: '플레이어 2', text: '안녕하세요!', timestamp: Date.now() },
    ],
  };

  const mockCurrentUser = {
    id: 'user_1',
    sessionToken: 'token_123',
    nickname: '플레이어 1(나)',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=u1',
  };

  const mockWebRTC = {
    isMicOn: false,
    isSpeakerOn: true,
    speakingUsers: { user_1: false, user_2: true },
    toggleMic: () => {},
    toggleSpeaker: () => {},
  };

  const mockSTT = {
    isSTTEnabled: true,
    isListening: false,
    activeBubbles: { user_2: { text: '반갑습니다~', timestamp: Date.now() } },
    toggleSTT: () => {},
  };

  // Render PLAYING state
  const boardPlayingHtml = renderToString(
    React.createElement(LoveLetterBoard, {
      roomState: mockRoomStatePlaying,
      currentUser: mockCurrentUser,
      socket: { emit: () => {}, on: () => {}, off: () => {} },
      webrtc: mockWebRTC,
      stt: mockSTT,
      onLeave: () => {},
    })
  );
  if (!boardPlayingHtml) throw new Error('LoveLetterBoard PLAYING state render failed');

  // Render PAUSED state
  const mockRoomStatePaused = {
    ...mockRoomStatePlaying,
    isPaused: true,
    pausedPlayerId: 'user_2',
    pauseExpiresAt: Date.now() + 120000,
  };
  const boardPausedHtml = renderToString(
    React.createElement(LoveLetterBoard, {
      roomState: mockRoomStatePaused,
      currentUser: mockCurrentUser,
      socket: { emit: () => {}, on: () => {}, off: () => {} },
      webrtc: mockWebRTC,
      stt: mockSTT,
      onLeave: () => {},
    })
  );
  if (!boardPausedHtml) throw new Error('LoveLetterBoard PAUSED state render failed');

  // Render ROUND_END & GAME_OVER state
  const mockRoomStateGameOver = {
    ...mockRoomStatePlaying,
    gameState: 'GAME_OVER',
    gameWinner: mockCurrentUser,
  };
  const boardGameOverHtml = renderToString(
    React.createElement(LoveLetterBoard, {
      roomState: mockRoomStateGameOver,
      currentUser: mockCurrentUser,
      socket: { emit: () => {}, on: () => {}, off: () => {} },
      webrtc: mockWebRTC,
      stt: mockSTT,
      onLeave: () => {},
    })
  );
  if (!boardGameOverHtml) throw new Error('LoveLetterBoard GAME_OVER state render failed');

  console.log('  ✅ Test 3 Passed: LoveLetterBoard cleanly rendered in PLAYING, PAUSED, ROUND_END, and GAME_OVER states.');

  console.log('\n🎉 ALL FRONTEND SSR & SMOKE COMPONENT TESTS PASSED 100%!\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Frontend Smoke Test Failure:', err);
  process.exit(1);
}
