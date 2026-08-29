import React, { useState, useEffect, useRef, useMemo } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { io } from 'socket.io-client';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Users,
  Bot,
  Play,
  Copy,
  Check,
  Shield,
  Eye,
  Swords,
  Crown,
  LogOut,
  Sparkles,
  HelpCircle,
  MessageSquare,
  Scroll,
  Flame,
  Award,
  AlertCircle
} from 'lucide-react';

// =========================================================================
// 1. Theme & Card Definitions
// =========================================================================

const THEME = {
  bg: '#0B0F19',
  surface: '#151D2A',
  surfaceLight: '#1F293D',
  primary: '#E53E3E',
  primaryHover: '#C53030',
  secondary: '#3182CE',
  accentGold: '#ECC94B',
  accentGreen: '#38A169',
  accentPurple: '#9F7AEA',
  text: '#F7FAFC',
  textMuted: '#A0AEC0',
  border: '#2D3748',
  danger: '#E53E3E',
  tableGreen: '#1A362B',
  tableBorder: '#744210',
};

const CARD_DATA = {
  1: { value: 1, name: '경비병', nameEn: 'Guard', count: 5, color: '#3182CE', icon: '🛡️', desc: '상대 1명을 지목하여 2~8번 카드를 추측합니다. 일치 시 상대 탈락!' },
  2: { value: 2, name: '사제', nameEn: 'Priest', count: 2, color: '#4FD1C5', icon: '📜', desc: '상대 1명을 지목하여 그 사람의 손패를 비밀리에 확인합니다.' },
  3: { value: 3, name: '남작', nameEn: 'Baron', count: 2, color: '#9F7AEA', icon: '⚔️', desc: '상대 1명과 비밀리에 손패 숫자를 비교하여 더 낮은 쪽이 탈락합니다.' },
  4: { value: 4, name: '하녀', nameEn: 'Handmaid', count: 2, color: '#68D391', icon: '🌸', desc: '다음 내 턴 시작 전까지 다른 플레이어의 모든 카드 효과로부터 면역 보호됩니다.' },
  5: { value: 5, name: '왕자', nameEn: 'Prince', count: 2, color: '#ECC94B', icon: '👑', desc: '자신 포함 1명을 지목하여 손패를 버리고 새로 1장 드로우하게 합니다. (공주 버려지면 탈락)' },
  6: { value: 6, name: '국왕', nameEn: 'King', count: 1, color: '#ED8936', icon: '🤴', desc: '상대 1명을 지목하여 자신의 손패와 상대의 손패를 맞교환합니다.' },
  7: { value: 7, name: '백작부인', nameEn: 'Countess', count: 1, color: '#F687B3', icon: '🌹', desc: '손에 왕자(5)나 국왕(6)이 함께 있을 경우, 반드시 백작부인을 먼저 내려놓아야 합니다.' },
  8: { value: 8, name: '공주', nameEn: 'Princess', count: 1, color: '#E53E3E', icon: '👸', desc: '이 카드를 내거나 어떤 이유로든 버려지면 즉시 게임에서 탈락합니다.' },
};

// =========================================================================
// 2. Styled Components Animations & Layout
// =========================================================================

const pulse = keyframes`
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(56, 161, 105, 0.7); }
  70% { transform: scale(1.05); box-shadow: 0 0 0 12px rgba(56, 161, 105, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(56, 161, 105, 0); }
`;

const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
  100% { transform: translateY(0px); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const glow = keyframes`
  0% { box-shadow: 0 0 5px #ecc94b, 0 0 10px #ecc94b; }
  50% { box-shadow: 0 0 20px #ecc94b, 0 0 30px #f6ad55; }
  100% { box-shadow: 0 0 5px #ecc94b, 0 0 10px #ecc94b; }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
  background-color: ${THEME.bg};
  color: ${THEME.text};
  font-family: inherit;
  position: relative;
  overflow: hidden;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background-color: ${THEME.surface};
  border-bottom: 1px solid ${THEME.border};
  z-index: 10;
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  font-size: 1.25rem;
  letter-spacing: -0.5px;
  color: #fff;
  cursor: pointer;

  span {
    background: linear-gradient(135deg, #e53e3e, #ecc94b);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
`;

const HeaderControls = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const UserBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: ${THEME.surfaceLight};
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;

  img {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    object-fit: cover;
  }
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background-color: ${(props) => (props.$active ? THEME.accentGreen : props.$danger ? THEME.danger : THEME.surfaceLight)};
  color: #fff;
  border: 1px solid ${THEME.border};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    background-color: ${(props) => (props.$active ? '#2f855a' : props.$danger ? '#c53030' : '#2d3748')};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const MainContent = styled.main`
  display: flex;
  flex: 1;
  height: calc(100vh - 65px);
  position: relative;
  overflow: hidden;

  @media (max-width: 1024px) {
    flex-direction: column;
    height: auto;
  }
`;

// =========================================================================
// 3. Login & Lobby Screens
// =========================================================================

const AuthOverlay = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 65px);
  padding: 24px;
  background: radial-gradient(circle at center, #1a202c 0%, #0b0f19 100%);
`;

const AuthCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 440px;
  background-color: ${THEME.surface};
  border: 1px solid ${THEME.border};
  border-radius: 20px;
  padding: 36px 32px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  animation: ${fadeIn} 0.4s ease;
`;

const AuthTitle = styled.h1`
  font-size: 1.8rem;
  font-weight: 800;
  margin-bottom: 8px;
  text-align: center;
`;

const AuthSubtitle = styled.p`
  font-size: 0.95rem;
  color: ${THEME.textMuted};
  margin-bottom: 28px;
  text-align: center;
  line-height: 1.5;
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px 20px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${(props) => (props.$variant === 'secondary' ? THEME.surfaceLight : props.$variant === 'green' ? THEME.accentGreen : THEME.primary)};
  color: #fff;

  &:hover {
    filter: brightness(1.1);
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  background-color: ${THEME.bg};
  border: 1px solid ${THEME.border};
  color: #fff;
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: ${THEME.secondary};
  }
`;

const LobbyCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 600px;
  background-color: ${THEME.surface};
  border: 1px solid ${THEME.border};
  border-radius: 20px;
  padding: 32px;
  margin: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  animation: ${fadeIn} 0.4s ease;
`;

const LobbyGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const PlayerListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  background-color: ${THEME.bg};
  border: 1px solid ${THEME.border};
  border-radius: 14px;
  padding: 14px;
  max-height: 260px;
  overflow-y: auto;
`;

const PlayerSlot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: ${THEME.surface};
  border-radius: 10px;
  border: 1px solid ${(props) => (props.$isHost ? THEME.accentGold : THEME.border)};

  .info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }

  .name {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .badge {
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 10px;
    background-color: ${(props) => (props.$isReady ? THEME.accentGreen : THEME.surfaceLight)};
    color: #fff;
  }
`;

// =========================================================================
// 4. Game Table & Card Components
// =========================================================================

const GameArea = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
  background: radial-gradient(circle at center, #1e3a2b 0%, #0d1a13 85%, #070e0a 100%);
  border: 12px solid ${THEME.tableBorder};
  border-radius: 24px;
  margin: 12px;
  box-shadow: inset 0 0 60px rgba(0, 0, 0, 0.8), 0 10px 30px rgba(0, 0, 0, 0.7);
  overflow: hidden;
`;

const TableCenter = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 32px;
  position: relative;
`;

const DeckBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 90px;
  height: 130px;
  background: linear-gradient(135deg, #742a2a, #9b2c2c);
  border: 2px solid #ecc94b;
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.6);
  font-weight: 800;
  font-size: 1.4rem;
  color: #ecc94b;
  position: relative;
  user-select: none;

  &::after {
    content: 'DECK';
    font-size: 0.7rem;
    letter-spacing: 2px;
    margin-top: 4px;
    color: #feb2b2;
  }
`;

const DiscardPileBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 90px;
  height: 130px;
  background-color: rgba(0, 0, 0, 0.3);
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  position: relative;
  font-size: 0.8rem;
  color: ${THEME.textMuted};
`;

const ActionBanner = styled.div`
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  border: 1px solid ${THEME.accentGold};
  padding: 8px 24px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 0.95rem;
  color: #fff;
  z-index: 5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  animation: ${fadeIn} 0.3s ease;
  white-space: nowrap;
`;

const OpponentsRow = styled.div`
  display: flex;
  justify-content: space-around;
  padding: 16px 20px;
  gap: 12px;
  flex-wrap: wrap;
  z-index: 2;
`;

const PlayerSeat = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  background-color: rgba(15, 23, 42, 0.75);
  padding: 10px 14px;
  border-radius: 16px;
  border: 2px solid ${(props) => (props.$isTurn ? THEME.accentGold : props.$isEliminated ? '#4a5568' : 'rgba(255, 255, 255, 0.15)')};
  opacity: ${(props) => (props.$isEliminated ? 0.45 : 1)};
  transition: all 0.3s ease;
  ${(props) => props.$isTurn && glow}
`;

const AvatarWrapper = styled.div`
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;

  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid #fff;
    object-fit: cover;
  }

  ${(props) =>
    props.$isSpeaking &&
    css`
      animation: ${pulse} 1.5s infinite;
      border-color: ${THEME.accentGreen};
    `}
`;

const SpeechBubble = styled.div`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: #fff;
  color: #1a202c;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  margin-bottom: 8px;
  z-index: 20;
  animation: ${fadeIn} 0.2s ease;

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 6px;
    border-style: solid;
    border-color: #fff transparent transparent transparent;
  }
`;

const ProtectionBadge = styled.div`
  position: absolute;
  top: -6px;
  right: -6px;
  background-color: ${THEME.accentGreen};
  color: #fff;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  border: 2px solid #fff;
`;

const TokenCount = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  font-weight: 700;
  color: ${THEME.accentGold};
`;

const MyHandArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background-color: rgba(11, 15, 25, 0.85);
  border-top: 1px solid ${THEME.border};
  z-index: 10;
`;

const CardsContainer = styled.div`
  display: flex;
  gap: 20px;
  justify-content: center;
  align-items: center;
`;

const CardItem = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 130px;
  height: 190px;
  background: ${(props) => `linear-gradient(145deg, #1f293d, #151d2a)`};
  border: 3px solid ${(props) => props.$color || THEME.border};
  border-radius: 14px;
  padding: 10px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5);
  cursor: ${(props) => (props.$canPlay ? 'pointer' : 'not-allowed')};
  transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  opacity: ${(props) => (props.$disabled ? 0.4 : 1)};
  position: relative;
  user-select: none;

  &:hover {
    ${(props) =>
      props.$canPlay &&
      css`
        transform: translateY(-16px) scale(1.05);
        box-shadow: 0 18px 30px rgba(0, 0, 0, 0.7);
      `}
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .number {
    font-size: 1.4rem;
    font-weight: 800;
    color: ${(props) => props.$color || '#fff'};
  }

  .icon {
    font-size: 1.4rem;
  }

  .name {
    font-size: 1rem;
    font-weight: 700;
    text-align: center;
    color: #fff;
  }

  .desc {
    font-size: 0.68rem;
    color: ${THEME.textMuted};
    line-height: 1.2;
    text-align: center;
  }
`;

// =========================================================================
// 5. Modals (Target & Guess Selection)
// =========================================================================

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
  animation: ${fadeIn} 0.2s ease;
`;

const ModalContent = styled.div`
  background-color: ${THEME.surface};
  border: 1px solid ${THEME.border};
  border-radius: 20px;
  width: 100%;
  max-width: 480px;
  padding: 28px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const TargetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
`;

const TargetOption = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: ${THEME.bg};
  border: 2px solid ${(props) => (props.$selected ? THEME.accentGold : THEME.border)};
  border-radius: 12px;
  cursor: pointer;
  color: #fff;
  transition: all 0.2s ease;

  img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
  }

  &:hover {
    border-color: ${THEME.accentGold};
    background-color: ${THEME.surfaceLight};
  }
`;

// =========================================================================
// 6. Right Chat & Activity Panel
// =========================================================================

const SidePanel = styled.aside`
  width: 320px;
  background-color: ${THEME.surface};
  border-left: 1px solid ${THEME.border};
  display: flex;
  flex-direction: column;
  height: 100%;

  @media (max-width: 1024px) {
    width: 100%;
    height: 300px;
  }
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid ${THEME.border};
  font-weight: 700;
  font-size: 0.95rem;
`;

const ChatMessages = styled.div`
  flex: 1;
  padding: 14px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ChatBubble = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  background-color: ${(props) => (props.$isSTT ? 'rgba(79, 209, 197, 0.15)' : THEME.surfaceLight)};
  border-left: 3px solid ${(props) => (props.$isSTT ? THEME.accentGreen : THEME.secondary)};
  padding: 8px 12px;
  border-radius: 8px;

  .author {
    font-weight: 700;
    font-size: 0.75rem;
    color: ${(props) => (props.$isSTT ? THEME.accentGreen : THEME.textMuted)};
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .text {
    line-height: 1.4;
    word-break: break-word;
  }
`;

const ChatInputRow = styled.form`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid ${THEME.border};
  background-color: ${THEME.surface};
`;

// =========================================================================
// 7. Main LoveLetterApp Component
// =========================================================================

export default function LoveLetterApp() {
  // Auth & User
  const [user, setUser] = useState(null);
  const [demoName, setDemoName] = useState('');

  // Room State
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomState, setRoomState] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [errorToast, setErrorToast] = useState('');

  // Game UI & Interaction
  const [selectedCardForPlay, setSelectedCardForPlay] = useState(null);
  const [targetPlayerId, setTargetPlayerId] = useState(null);
  const [guessedCardVal, setGuessedCardVal] = useState(2);
  const [priestRevealedCard, setPriestRevealedCard] = useState(null);

  // STT & Voice
  const [isMicOn, setIsMicOn] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [sttSupported, setSttSupported] = useState(true);
  const [activeSpeechBubbles, setActiveSpeechBubbles] = useState({}); // userId -> text
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // Audio Context & VAD
  const [speakingUsers, setSpeakingUsers] = useState({}); // userId -> boolean

  // Refs
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // userId -> RTCPeerConnection
  const audioElementsRef = useRef({}); // userId -> HTMLAudioElement
  const recognitionRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Initialize Socket.io
  useEffect(() => {
    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket server');
    });

    socket.on('room:joined', ({ roomCode, isHost }) => {
      setIsHost(isHost);
    });

    socket.on('room:state_sync', (state) => {
      setRoomState(state);
    });

    socket.on('room:error', (msg) => {
      showToast(msg);
    });

    socket.on('game:error', (msg) => {
      showToast(msg);
    });

    socket.on('game:priest_reveal', ({ targetName, card }) => {
      setPriestRevealedCard({ targetName, card });
      setTimeout(() => {
        setPriestRevealedCard(null);
      }, 4000);
    });

    socket.on('stt:bubble', ({ senderId, text, isFinal }) => {
      setActiveSpeechBubbles((prev) => ({ ...prev, [senderId]: text }));
      if (isFinal) {
        setTimeout(() => {
          setActiveSpeechBubbles((prev) => {
            const next = { ...prev };
            delete next[senderId];
            return next;
          });
        }, 3500);
      }
    });

    socket.on('chat:broadcast', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    // WebRTC Signaling
    socket.on('webrtc:peer_joined', async ({ peerId, socketId }) => {
      if (localStreamRef.current) {
        createPeerOffer(socketId, peerId);
      }
    });

    socket.on('webrtc:offer', async ({ fromSocketId, fromUserId, offer }) => {
      handleReceiveOffer(fromSocketId, fromUserId, offer);
    });

    socket.on('webrtc:answer', async ({ fromSocketId, answer }) => {
      const pc = peersRef.current[fromSocketId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('webrtc:ice_candidate', async ({ fromSocketId, candidate }) => {
      const pc = peersRef.current[fromSocketId];
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on('webrtc:peer_left', ({ socketId, userId }) => {
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].close();
        delete peersRef.current[socketId];
      }
      if (audioElementsRef.current[userId]) {
        audioElementsRef.current[userId].remove();
        delete audioElementsRef.current[userId];
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const showToast = (msg) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(''), 4000);
  };

  // Google Login GIS SDK Init
  useEffect(() => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: '1234567890-sample.apps.googleusercontent.com', // Replace with real ID in env
        callback: handleGoogleLoginCallback,
      });
      window.google.accounts.id.renderButton(
        document.getElementById('googleSignInBtn'),
        { theme: 'outline', size: 'large', width: 320, text: 'signin_with', locale: 'ko' }
      );
    }
  }, []);

  const handleGoogleLoginCallback = async (response) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
      } else {
        showToast(data.error || '로그인 실패');
      }
    } catch (err) {
      showToast('서버 연결 오류');
    }
  };

  const handleDemoLogin = async () => {
    const name = demoName.trim() || `플레이어_${Math.floor(Math.random() * 900 + 100)}`;
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demoUser: {
            id: `usr_${Math.random().toString(36).substr(2, 8)}`,
            name,
            email: `${name}@loveletter.local`,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
      }
    } catch (err) {
      showToast('로그인 처리 실패');
    }
  };

  // Web Speech API STT Engine
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSttSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (socketRef.current && (interim || final)) {
        socketRef.current.emit('stt:speech', {
          text: final || interim,
          isFinal: Boolean(final),
        });
      }
    };

    recognition.onerror = (e) => {
      console.warn('STT Error:', e.error);
    };

    recognition.onend = () => {
      if (isMicOn) {
        try {
          recognition.start();
        } catch (e) {}
      }
    };

    recognitionRef.current = recognition;
  }, [isMicOn]);

  // Mic Toggle & WebRTC Stream
  const toggleMic = async () => {
    if (!isMicOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        setIsMicOn(true);

        // Start STT
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {}
        }

        // Setup VAD
        setupVAD(stream, user.id);
      } catch (err) {
        showToast('마이크 접근 권한이 필요합니다.');
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsMicOn(false);
      setSpeakingUsers((prev) => ({ ...prev, [user?.id]: false }));
    }
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
    Object.values(audioElementsRef.current).forEach((audio) => {
      audio.muted = !isDeafened;
    });
  };

  const setupVAD = (stream, userId) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      analyser.fftSize = 512;
      microphone.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!localStreamRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setSpeakingUsers((prev) => ({ ...prev, [userId]: average > 20 }));
        requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch (e) {
      console.warn('VAD Error:', e);
    }
  };

  // WebRTC Peer Connection Helper
  const createPeerOffer = async (targetSocketId, targetUserId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peersRef.current[targetSocketId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('webrtc:ice_candidate', {
          toSocketId: targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      attachRemoteAudio(targetUserId, event.streams[0]);
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current.emit('webrtc:offer', {
      toSocketId: targetSocketId,
      offer,
    });
  };

  const handleReceiveOffer = async (fromSocketId, fromUserId, offer) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peersRef.current[fromSocketId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('webrtc:ice_candidate', {
          toSocketId: fromSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      attachRemoteAudio(fromUserId, event.streams[0]);
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current.emit('webrtc:answer', {
      toSocketId: fromSocketId,
      answer,
    });
  };

  const attachRemoteAudio = (peerUserId, stream) => {
    let audio = audioElementsRef.current[peerUserId];
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.muted = isDeafened;
      document.body.appendChild(audio);
      audioElementsRef.current[peerUserId] = audio;
    }
    audio.srcObject = stream;
  };

  // Room Actions
  const handleCreateRoom = () => {
    if (!user) return;
    socketRef.current.emit('room:create', { user });
  };

  const handleJoinRoom = () => {
    if (!user || !roomCodeInput.trim()) return;
    socketRef.current.emit('room:join', { roomCode: roomCodeInput.trim(), user });
  };

  const handleToggleReady = () => {
    socketRef.current.emit('room:ready');
  };

  const handleAddBot = () => {
    socketRef.current.emit('room:add_bot');
  };

  const handleRemoveBot = (botId) => {
    socketRef.current.emit('room:remove_bot', { botId });
  };

  const handleStartGame = () => {
    socketRef.current.emit('game:start');
  };

  // Card Play Handling
  const handleCardClick = (card) => {
    if (!isMyTurn || roomState.gameState !== 'PLAYING') return;

    // Check Countess Constraint
    const otherCard = myPlayer?.hand.find((c) => c.id !== card.id);
    if (otherCard && otherCard.value === 7 && (card.value === 5 || card.value === 6)) {
      showToast('백작부인(7)을 소지 중일 때는 왕자(5)나 국왕(6)을 낼 수 없습니다.');
      return;
    }

    // Direct play cards
    if (card.value === 4 || card.value === 7 || card.value === 8) {
      socketRef.current.emit('game:play_card', { cardId: card.id });
      return;
    }

    // Modal requiring cards (1, 2, 3, 5, 6)
    setSelectedCardForPlay(card);
    setTargetPlayerId(null);
    setGuessedCardVal(2);
  };

  const handleConfirmPlayCard = () => {
    if (!selectedCardForPlay) return;

    // For Prince (5), target can be self
    if (selectedCardForPlay.value === 5 && !targetPlayerId) {
      // Default to self if no target picked
      setTargetPlayerId(user.id);
    }

    socketRef.current.emit('game:play_card', {
      cardId: selectedCardForPlay.id,
      targetPlayerId: targetPlayerId || (selectedCardForPlay.value === 5 ? user.id : null),
      guessedCardValue: selectedCardForPlay.value === 1 ? guessedCardVal : null,
    });

    setSelectedCardForPlay(null);
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current.emit('chat:send', { text: chatInput });
    setChatInput('');
  };

  // Computed state
  const myPlayer = useMemo(() => {
    return roomState?.players?.find((p) => p.id === user?.id) || null;
  }, [roomState, user]);

  const isMyTurn = roomState?.turnPlayerId === user?.id;

  const validTargets = useMemo(() => {
    if (!roomState || !selectedCardForPlay) return [];
    if (selectedCardForPlay.value === 5) {
      // Prince can target self or alive unprotected players
      return roomState.players.filter((p) => !p.isEliminated && (!p.isProtected || p.id === user?.id));
    }
    // Others target alive, non-protected opponents
    return roomState.players.filter((p) => p.id !== user?.id && !p.isEliminated && !p.isProtected);
  }, [roomState, selectedCardForPlay, user]);

  // -------------------------------------------------------------
  // Render: 1. Login View
  // -------------------------------------------------------------
  if (!user) {
    return (
      <Container>
        <Header>
          <Brand>💌 <span>러브레터 온라인</span></Brand>
        </Header>
        <AuthOverlay>
          <AuthCard>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>💌</div>
            <AuthTitle>러브레터 온라인</AuthTitle>
            <AuthSubtitle>
              친구들과 브라우저에서 바로 즐기는 실시간 보드게임!<br />
              실시간 WebRTC 음성 통화 및 한국어 STT 자막 지원
            </AuthSubtitle>

            {/* Google Login GIS Button */}
            <div id="googleSignInBtn" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}></div>

            <div style={{ width: '100%', height: '1px', backgroundColor: THEME.border, margin: '18px 0' }}></div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.85rem', color: THEME.textMuted, textAlign: 'center' }}>
                빠른 테스트를 위한 닉네임 로그인
              </div>
              <Input
                placeholder="닉네임 입력 (예: 공주러버)"
                value={demoName}
                onChange={(e) => setDemoName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDemoLogin()}
              />
              <Button $variant="secondary" onClick={handleDemoLogin}>
                게스트로 즉시 시작
              </Button>
            </div>
          </AuthCard>
        </AuthOverlay>
      </Container>
    );
  }

  // -------------------------------------------------------------
  // Render: 2. Lobby View
  // -------------------------------------------------------------
  if (!roomState) {
    return (
      <Container>
        <Header>
          <Brand>💌 <span>러브레터 온라인</span></Brand>
          <HeaderControls>
            <UserBadge>
              <img src={user.picture} alt={user.name} />
              <span>{user.name}</span>
            </UserBadge>
            <IconButton onClick={() => setUser(null)} title="로그아웃" $danger>
              <LogOut size={18} />
            </IconButton>
          </HeaderControls>
        </Header>
        <AuthOverlay>
          <LobbyCard>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, textAlign: 'center' }}>게임 로비</h2>
            <LobbyGrid>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>새로운 방 만들기</h3>
                <p style={{ fontSize: '0.85rem', color: THEME.textMuted }}>
                  새 방을 만들고 친구를 초대하세요. AI 봇과 함께 1인 플레이도 가능합니다.
                </p>
                <Button onClick={handleCreateRoom}>
                  <Sparkles size={18} /> 방 생성하기
                </Button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>코드로 방 입장</h3>
                <Input
                  placeholder="6자리 방 코드 입력 (예: AB12CD)"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                />
                <Button $variant="secondary" onClick={handleJoinRoom}>
                  입장하기
                </Button>
              </div>
            </LobbyGrid>
            {errorToast && (
              <div style={{ color: THEME.danger, fontSize: '0.9rem', textAlign: 'center' }}>
                {errorToast}
              </div>
            )}
          </LobbyCard>
        </AuthOverlay>
      </Container>
    );
  }

  // -------------------------------------------------------------
  // Render: 3. Waiting Room in Lobby State
  // -------------------------------------------------------------
  if (roomState.gameState === 'LOBBY') {
    return (
      <Container>
        <Header>
          <Brand>💌 <span>러브레터 온라인</span></Brand>
          <HeaderControls>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: THEME.surfaceLight, padding: '6px 12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }}>
              방 코드: <span style={{ color: THEME.accentGold, letterSpacing: '1px' }}>{roomState.code}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(roomState.code);
                  showToast('방 코드가 클립보드에 복사되었습니다.');
                }}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}
              >
                <Copy size={16} />
              </button>
            </div>
            <UserBadge>
              <img src={user.picture} alt={user.name} />
              <span>{user.name}</span>
            </UserBadge>
          </HeaderControls>
        </Header>
        <AuthOverlay>
          <LobbyCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>대기실 ({roomState.players.length}/{roomState.maxPlayers}명)</h2>
              {isHost && <span style={{ fontSize: '0.8rem', color: THEME.accentGold, fontWeight: 700 }}>👑 당신이 방장입니다</span>}
            </div>

            <PlayerListContainer>
              {roomState.players.map((p) => (
                <PlayerSlot key={p.id} $isHost={p.id === roomState.hostId} $isReady={p.isReady}>
                  <div className="info">
                    <img src={p.picture} alt={p.name} />
                    <span className="name">
                      {p.name} {p.isBot && '🤖'} {p.id === roomState.hostId && '👑'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge">{p.isReady ? '준비 완료' : '대기 중'}</span>
                    {isHost && p.isBot && (
                      <button
                        onClick={() => handleRemoveBot(p.id)}
                        style={{ background: 'none', border: 'none', color: THEME.danger, cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        추방
                      </button>
                    )}
                  </div>
                </PlayerSlot>
              ))}
            </PlayerListContainer>

            <div style={{ display: 'flex', gap: '10px' }}>
              {isHost && (
                <Button
                  $variant="secondary"
                  onClick={handleAddBot}
                  disabled={roomState.players.length >= roomState.maxPlayers}
                >
                  <Bot size={18} /> AI 봇 추가
                </Button>
              )}

              {isHost ? (
                <Button
                  $variant="green"
                  onClick={handleStartGame}
                  disabled={roomState.players.length < 2}
                >
                  <Play size={18} /> 게임 시작 (최소 2인)
                </Button>
              ) : (
                <Button
                  $variant={myPlayer?.isReady ? 'secondary' : 'green'}
                  onClick={handleToggleReady}
                >
                  <Check size={18} /> {myPlayer?.isReady ? '준비 취소' : '준비 완료'}
                </Button>
              )}
            </div>

            {errorToast && (
              <div style={{ color: THEME.danger, fontSize: '0.9rem', textAlign: 'center' }}>
                {errorToast}
              </div>
            )}
          </LobbyCard>
        </AuthOverlay>
      </Container>
    );
  }

  // -------------------------------------------------------------
  // Render: 4. In-Game Board View
  // -------------------------------------------------------------
  const opponents = roomState.players.filter((p) => p.id !== user.id);

  return (
    <Container>
      {/* Top Header with Voice & Controls */}
      <Header>
        <Brand>
          💌 <span>러브레터</span>
          <span style={{ fontSize: '0.8rem', color: THEME.textMuted, fontWeight: 500 }}>
            (방: {roomState.code})
          </span>
        </Brand>

        <HeaderControls>
          {/* WebRTC Voice Chat Controls */}
          <IconButton
            $active={isMicOn}
            onClick={toggleMic}
            title={isMicOn ? '마이크 끄기 (STT 중지)' : '마이크 켜기 (WebRTC & STT 시작)'}
          >
            {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
          </IconButton>

          <IconButton
            $active={isDeafened}
            onClick={toggleDeafen}
            title={isDeafened ? '스피커 켜기' : '스피커 음소거'}
          >
            {isDeafened ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </IconButton>

          <UserBadge>
            <img src={user.picture} alt={user.name} />
            <span>{user.name}</span>
          </UserBadge>
        </HeaderControls>
      </Header>

      <MainContent>
        {/* Game Table Area */}
        <GameArea>
          {/* Action Log Banner */}
          {roomState.lastActionLog && (
            <ActionBanner>{roomState.lastActionLog}</ActionBanner>
          )}

          {/* Opponents Row */}
          <OpponentsRow>
            {opponents.map((opp) => (
              <PlayerSeat
                key={opp.id}
                $isTurn={roomState.turnPlayerId === opp.id}
                $isEliminated={opp.isEliminated}
              >
                {/* Real-time STT Speech Bubble */}
                {activeSpeechBubbles[opp.id] && (
                  <SpeechBubble>💬 {activeSpeechBubbles[opp.id]}</SpeechBubble>
                )}

                <AvatarWrapper $isSpeaking={speakingUsers[opp.id]}>
                  <img src={opp.picture} alt={opp.name} />
                  {opp.isProtected && (
                    <ProtectionBadge title="하녀 보호막">🛡️</ProtectionBadge>
                  )}
                </AvatarWrapper>

                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {opp.name} {opp.isBot && '🤖'}
                </div>

                <TokenCount>
                  <Crown size={14} /> {opp.tokens}/{roomState.targetTokens}
                </TokenCount>

                <div style={{ fontSize: '0.75rem', color: THEME.textMuted }}>
                  손패: {opp.handCount}장 | 버림: {opp.discardPile.length}장
                </div>

                {opp.isEliminated && (
                  <span style={{ fontSize: '0.75rem', color: THEME.danger, fontWeight: 700 }}>
                    탈락
                  </span>
                )}
              </PlayerSeat>
            ))}
          </OpponentsRow>

          {/* Table Center (Deck & Discard) */}
          <TableCenter>
            <DeckBox>{roomState.deckCount}</DeckBox>

            <DiscardPileBox>
              {roomState.setAsideOpenCards?.length > 0 && (
                <div style={{ fontSize: '0.7rem', color: THEME.accentGold, marginBottom: '4px' }}>
                  공개 제외: {roomState.setAsideOpenCards.map((c) => c.value).join(', ')}
                </div>
              )}
              버린 카드
            </DiscardPileBox>
          </TableCenter>

          {/* My Player Hand Area */}
          <MyHandArea>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '700px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AvatarWrapper $isSpeaking={speakingUsers[user.id]}>
                  <img src={user.picture} alt={user.name} />
                  {myPlayer?.isProtected && <ProtectionBadge>🛡️</ProtectionBadge>}
                </AvatarWrapper>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    {user.name} {isMyTurn && <span style={{ color: THEME.accentGold }}> (내 턴입니다!)</span>}
                  </div>
                  <TokenCount>
                    <Crown size={14} /> 토큰: {myPlayer?.tokens || 0}/{roomState.targetTokens}
                  </TokenCount>
                </div>
              </div>

              {myPlayer?.isEliminated && (
                <div style={{ color: THEME.danger, fontWeight: 800, fontSize: '1.1rem' }}>
                  이번 라운드에서 탈락하셨습니다.
                </div>
              )}
            </div>

            {/* Hand Cards */}
            <CardsContainer>
              {myPlayer?.hand?.map((card) => {
                const isCountessLocked =
                  (card.value === 5 || card.value === 6) &&
                  myPlayer.hand.some((c) => c.value === 7);

                return (
                  <CardItem
                    key={card.id}
                    $color={CARD_DATA[card.value]?.color}
                    $canPlay={isMyTurn && !isCountessLocked && !myPlayer?.isEliminated}
                    $disabled={!isMyTurn || isCountessLocked || myPlayer?.isEliminated}
                    onClick={() => handleCardClick(card)}
                  >
                    <div className="header">
                      <span className="number">{card.value}</span>
                      <span className="icon">{CARD_DATA[card.value]?.icon}</span>
                    </div>
                    <div className="name">{card.name}</div>
                    <div className="desc">{CARD_DATA[card.value]?.desc}</div>
                  </CardItem>
                );
              })}
            </CardsContainer>
          </MyHandArea>
        </GameArea>

        {/* Right Side Chat & STT Panel */}
        <SidePanel>
          <PanelHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={16} /> 실시간 채팅 & 음성 STT
            </div>
            {!sttSupported && (
              <span style={{ fontSize: '0.7rem', color: THEME.accentGold }}>STT 미지원 브라우저</span>
            )}
          </PanelHeader>

          <ChatMessages>
            {chatMessages.map((msg) => (
              <ChatBubble key={msg.id} $isSTT={msg.isSTT}>
                <div className="author">
                  {msg.isSTT ? <Mic size={12} /> : null}
                  <span>{msg.senderName}</span>
                  <span style={{ fontSize: '0.65rem', marginLeft: 'auto' }}>{msg.timestamp}</span>
                </div>
                <div className="text">{msg.text}</div>
              </ChatBubble>
            ))}
            <div ref={chatBottomRef} />
          </ChatMessages>

          <ChatInputRow onSubmit={handleSendChat}>
            <Input
              placeholder="메시지 입력..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <IconButton type="submit" $active>
              <Send size={16} />
            </IconButton>
          </ChatInputRow>
        </SidePanel>
      </MainContent>

      {/* Target & Guess Modal for Guard / Priest / Baron / Prince / King */}
      {selectedCardForPlay && (
        <ModalBackdrop>
          <ModalContent>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
              [{selectedCardForPlay.name}] 대상 선택
            </h3>
            <p style={{ fontSize: '0.85rem', color: THEME.textMuted }}>
              {selectedCardForPlay.desc}
            </p>

            <TargetGrid>
              {validTargets.map((target) => (
                <TargetOption
                  key={target.id}
                  $selected={targetPlayerId === target.id}
                  onClick={() => setTargetPlayerId(target.id)}
                >
                  <img src={target.picture} alt={target.name} />
                  <span>{target.name}</span>
                </TargetOption>
              ))}
            </TargetGrid>

            {validTargets.length === 0 && (
              <div style={{ color: THEME.textMuted, fontSize: '0.85rem', textAlign: 'center' }}>
                지목 가능한 대상이 없습니다 (효과 무효 처리).
              </div>
            )}

            {/* Guard (1) Card Guess Dropdown */}
            {selectedCardForPlay.value === 1 && validTargets.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700 }}>추측할 카드 선택 (2~8):</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {[2, 3, 4, 5, 6, 7, 8].map((val) => (
                    <Button
                      key={val}
                      type="button"
                      $variant={guessedCardVal === val ? 'primary' : 'secondary'}
                      style={{ padding: '8px' }}
                      onClick={() => setGuessedCardVal(val)}
                    >
                      {val}. {CARD_DATA[val].name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <Button $variant="secondary" onClick={() => setSelectedCardForPlay(null)}>
                취소
              </Button>
              <Button
                $variant="green"
                onClick={handleConfirmPlayCard}
                disabled={validTargets.length > 0 && !targetPlayerId && selectedCardForPlay.value !== 5}
              >
                카드 내기
              </Button>
            </div>
          </ModalContent>
        </ModalBackdrop>
      )}

      {/* Priest Reveal Secret Overlay */}
      {priestRevealedCard && (
        <ModalBackdrop>
          <ModalContent style={{ textAlign: 'center', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
              👁️ [{priestRevealedCard.targetName}]님의 손패 확인
            </h3>
            <CardItem
              $color={CARD_DATA[priestRevealedCard.card.value]?.color}
              style={{ cursor: 'default', transform: 'scale(1.1)', margin: '16px 0' }}
            >
              <div className="header">
                <span className="number">{priestRevealedCard.card.value}</span>
                <span className="icon">{CARD_DATA[priestRevealedCard.card.value]?.icon}</span>
              </div>
              <div className="name">{priestRevealedCard.card.name}</div>
              <div className="desc">{CARD_DATA[priestRevealedCard.card.value]?.desc}</div>
            </CardItem>
            <p style={{ fontSize: '0.85rem', color: THEME.textMuted }}>
              3초 후 자동으로 닫힙니다...
            </p>
          </ModalContent>
        </ModalBackdrop>
      )}

      {/* Game Over Celebration Modal */}
      {roomState.gameState === 'GAME_OVER' && roomState.gameWinner && (
        <ModalBackdrop>
          <ModalContent style={{ textAlign: 'center', alignItems: 'center' }}>
            <div style={{ fontSize: '3.5rem' }}>👑</div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: THEME.accentGold }}>
              [{roomState.gameWinner.name}] 최종 우승!
            </h2>
            <p style={{ fontSize: '0.95rem', color: THEME.textMuted }}>
              호감도 토큰 {roomState.gameWinner.tokens}개를 먼저 획득하여 러브레터 챔피언이 되었습니다!
            </p>
            {isHost && (
              <Button $variant="green" onClick={handleStartGame} style={{ marginTop: '16px' }}>
                새 게임 시작
              </Button>
            )}
          </ModalContent>
        </ModalBackdrop>
      )}
    </Container>
  );
}
