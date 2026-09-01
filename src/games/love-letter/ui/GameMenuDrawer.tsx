import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME } from '../../../shared/theme';
import { CARD_DEFINITIONS } from '../../../../packages/love-letter-core/src/cards';
import { CardValue } from '../../../../packages/love-letter-core/src/types';
import { getHeraldicIcon } from '../presentation/heraldicIcons';
import { sfx } from '../../../shared/sfx';
import { Copy, Check, BookOpen, Volume2, VolumeX, Music2, LogOut, X, Headphones, Mic, MicOff, Radio } from 'lucide-react';

interface GameMenuDrawerProps {
  isOpen: boolean;
  roomCode?: string;
  targetTokens?: number;
  onClose: () => void;
  onLeaveRoom: () => void;
  /** The common room-voice hook. Optional while non-game room screens migrate. */
  voice?: RoomVoiceControlsProps['voice'];
}

export interface RoomVoiceControlsProps {
  voice?: {
    isVoiceJoined?: boolean;
    isMicOn?: boolean;
    isSpeakerOn?: boolean;
    voiceStatus?: string;
    voiceError?: string | null;
    joinVoice?: () => Promise<boolean> | boolean | void;
    leaveVoice?: () => void;
    toggleMic?: () => void;
    toggleSpeaker?: () => void;
  };
  compact?: boolean;
}

/** Reusable in the waiting room and the in-game settings panel. */
export const RoomVoiceControls: React.FC<RoomVoiceControlsProps> = ({ voice, compact = false }) => {
  const joined = Boolean(voice?.isVoiceJoined);
  const micOn = Boolean(voice?.isMicOn);
  const speakerOn = voice?.isSpeakerOn !== false;
  const joining = voice?.voiceStatus === 'joining';
  const statusLabel = voice?.voiceStatus === 'requesting-mic' ? '권한 요청 중' : voice?.voiceStatus === 'joining' ? '연결 중' : joined ? '듣는 중' : '미참여';

  if (!voice) return null;
  return (
    <VoiceBlock $compact={compact} aria-live="polite">
      {!compact && <VoiceHeading><Radio size={14} /> 음성 채팅 <VoiceState>{statusLabel}</VoiceState></VoiceHeading>}
      <VoiceControls>
        <VoiceButton type="button" $active={joined} disabled={joining} onClick={(event) => { event.preventDefault(); void (joined ? voice.leaveVoice?.() : voice.joinVoice?.()); }}>
          <Headphones size={14} />{joined ? '나가기' : '듣기 참여'}
        </VoiceButton>
        <VoiceButton type="button" $active={micOn} disabled={!joined} onClick={(event) => { event.preventDefault(); void voice.toggleMic?.(); }}>
          {micOn ? <Mic size={14} /> : <MicOff size={14} />}{micOn ? '마이크 켜짐' : '마이크'}
        </VoiceButton>
        <VoiceButton type="button" $active={speakerOn} disabled={!joined} onClick={(event) => { event.preventDefault(); voice.toggleSpeaker?.(); }}>
          {speakerOn ? <Volume2 size={14} /> : <VolumeX size={14} />}{speakerOn ? '스피커 켜짐' : '스피커'}
        </VoiceButton>
      </VoiceControls>
      {voice.voiceError && <VoiceError role="alert">{voice.voiceError}</VoiceError>}
    </VoiceBlock>
  );
};

export const GameMenuDrawer: React.FC<GameMenuDrawerProps> = ({
  isOpen,
  roomCode,
  targetTokens = 4,
  onClose,
  onLeaveRoom,
  voice,
}) => {
  const [copied, setCopied] = useState(false);
  const [sfxOn, setSfxOn] = useState(sfx.enabled);
  const [musicOn, setMusicOn] = useState(sfx.getSettings().musicEnabled);
  const [musicVolume, setMusicVolume] = useState(Math.round(sfx.getSettings().musicVolume * 100));
  const [sfxVolume, setSfxVolume] = useState(Math.round(sfx.getSettings().sfxVolume * 100));
  const [activeTab, setActiveTab] = useState<'rules' | 'settings'>('rules');

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSfx = () => {
    const next = !sfxOn;
    sfx.setEnabled(next);
    setSfxOn(next);
  };

  const handleToggleMusic = () => {
    const next = !musicOn;
    sfx.setMusicEnabled(next);
    setMusicOn(next);
  };

  const handleMusicVolume = (value: number) => {
    sfx.setMusicVolume(value / 100);
    setMusicVolume(value);
  };

  const handleSfxVolume = (value: number) => {
    sfx.setSfxVolume(value / 100);
    setSfxVolume(value);
  };

  const cardsList = [1, 2, 3, 4, 5, 6, 7, 8] as CardValue[];

  return (
    <AnimatePresence>
      {isOpen && (
        <Overlay
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <DrawerContainer
            as={motion.div}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={e => e.stopPropagation()}
          >
            <DrawerHeader>
              <HeaderTitle>
                러브레터 살롱 메뉴
              </HeaderTitle>
              <CloseBtn onClick={onClose}>
                <X size={16} />
              </CloseBtn>
            </DrawerHeader>

            {/* Room Info Pill */}
            {roomCode && (
              <RoomCodeCard>
                <CodeInfo>
                  <CodeLabel>SALON TABLE CODE</CodeLabel>
                  <CodeValue>{roomCode}</CodeValue>
                </CodeInfo>
                <CopyButton onClick={handleCopyCode} title="코드 복사">
                  {copied ? <Check size={14} color={THEME.emerald} /> : <Copy size={14} />}
                  <span>{copied ? '복사됨' : '복사'}</span>
                </CopyButton>
              </RoomCodeCard>
            )}

            {/* Tabs */}
            <TabsRow>
              <TabBtn
                $active={activeTab === 'rules'}
                onClick={() => setActiveTab('rules')}
              >
                <BookOpen size={13} />
                <span>카드 규칙 가이드</span>
              </TabBtn>
              <TabBtn
                $active={activeTab === 'settings'}
                onClick={() => setActiveTab('settings')}
              >
                <Volume2 size={13} />
                <span>게임 설정</span>
              </TabBtn>
            </TabsRow>

            <DrawerBody>
              {activeTab === 'rules' ? (
                <CardsGuideList>
                  {cardsList.map(val => {
                    const card = CARD_DEFINITIONS[val];
                    return (
                      <CardGuideItem key={val}>
                        <CardGuideHeader>
                          <ValBadge>{val}</ValBadge>
                          <EmblemBox>{getHeraldicIcon(val, 18)}</EmblemBox>
                          <CardName>{card.name} ({card.nameEn})</CardName>
                          <CardCountTag>총 {card.count}장</CardCountTag>
                        </CardGuideHeader>
                        <CardDesc>{card.detailedGuide || card.description}</CardDesc>
                      </CardGuideItem>
                    );
                  })}
                </CardsGuideList>
              ) : (
                <SettingsList>
                  <SettingRow>
                    <span>배경 음악</span>
                    <ToggleBtn $active={musicOn} onClick={handleToggleMusic}>
                      <Music2 size={14} />
                      <span>{musicOn ? '켜짐' : '꺼짐'}</span>
                    </ToggleBtn>
                  </SettingRow>
                  <VolumeRow>
                    <label htmlFor="music-volume">음악 볼륨 <strong>{musicVolume}%</strong></label>
                    <input id="music-volume" type="range" min="0" max="100" value={musicVolume} onChange={event => handleMusicVolume(Number(event.target.value))} disabled={!musicOn} />
                  </VolumeRow>
                  <SettingRow>
                    <span>효과음 (SFX)</span>
                    <ToggleBtn $active={sfxOn} onClick={handleToggleSfx}>
                      {sfxOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
                      <span>{sfxOn ? '켜짐' : '꺼짐'}</span>
                    </ToggleBtn>
                  </SettingRow>
                  <VolumeRow>
                    <label htmlFor="sfx-volume">효과음 볼륨 <strong>{sfxVolume}%</strong></label>
                    <input id="sfx-volume" type="range" min="0" max="100" value={sfxVolume} onChange={event => handleSfxVolume(Number(event.target.value))} disabled={!sfxOn} />
                  </VolumeRow>

                  <RoomVoiceControls voice={voice} />

                  <SettingRow>
                    <span>목표 호감도 토큰</span>
                    <ValueTag>{targetTokens}개 승리</ValueTag>
                  </SettingRow>
                </SettingsList>
              )}
            </DrawerBody>

            <DrawerFooter>
              <LeaveBtn onClick={onLeaveRoom}>
                <LogOut size={15} />
                <span>게임 나가기 / 기권</span>
              </LeaveBtn>
            </DrawerFooter>
          </DrawerContainer>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(9, 13, 22, 0.65);
  backdrop-filter: blur(6px);
  z-index: 2100;
  display: flex;
  justify-content: flex-end;
`;

const DrawerContainer = styled.div`
  width: 100%;
  max-width: 380px;
  height: 100%;
  background-color: #ffffff;
  background-image: ${THEME.gradients.marbleSlab};
  border-left: 2px solid ${THEME.gold};
  box-shadow: -8px 0 32px rgba(9, 13, 22, 0.25);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1.5px solid ${THEME.border};
  background: #ffffff;
`;

const HeaderTitle = styled.h3`
  margin: 0;
  font-family: ${THEME.font.serif};
  font-size: 14px;
  font-weight: 800;
  color: ${THEME.foreground};
  display: flex;
  align-items: center;
  gap: 6px;
`;

const CloseBtn = styled.button`
  background: #f1f5f9;
  border: 1px solid ${THEME.border};
  color: ${THEME.mutedForeground};
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    background: #e2e8f0;
    color: ${THEME.foreground};
  }
`;

const RoomCodeCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 18px 0;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid ${THEME.gold};
  border-radius: ${THEME.radius.lg};
`;

const CodeInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const CodeLabel = styled.span`
  font-size: 9px;
  font-weight: 800;
  font-family: ${THEME.font.serif};
  color: ${THEME.goldAntique};
`;

const CodeValue = styled.span`
  font-size: 15px;
  font-weight: 900;
  color: ${THEME.primary};
  letter-spacing: 0.08em;
`;

const CopyButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  background: #ffffff;
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radius.md};
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  color: ${THEME.foreground};
  cursor: pointer;

  &:hover {
    background: ${THEME.secondary};
    border-color: ${THEME.gold};
  }
`;

const TabsRow = styled.div`
  display: flex;
  padding: 10px 18px 0;
  gap: 8px;
`;

const TabBtn = styled.button<{ $active: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 8px 0;
  background: ${props => (props.$active ? '#ffffff' : 'transparent')};
  border: 1px solid ${props => (props.$active ? THEME.gold : 'transparent')};
  border-bottom: ${props => (props.$active ? '2px solid ' + THEME.burgundy : '1px solid transparent')};
  border-radius: ${THEME.radius.md} ${THEME.radius.md} 0 0;
  font-size: 11.5px;
  font-weight: 800;
  color: ${props => (props.$active ? THEME.burgundy : THEME.mutedForeground)};
  cursor: pointer;
`;

const DrawerBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px 18px;
`;

const CardsGuideList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CardGuideItem = styled.div`
  background: #ffffff;
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radius.md};
  padding: 8px 10px;
  box-shadow: 0 1px 3px rgba(9, 13, 22, 0.03);
  min-height: 68px;
  box-sizing: border-box;
`;

const CardGuideHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
`;

const ValBadge = styled.span`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: ${THEME.primary};
  color: ${THEME.goldLight};
  font-family: ${THEME.font.serif};
  font-weight: 800;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const EmblemBox = styled.span`
  display: flex;
  align-items: center;
`;

const CardName = styled.span`
  font-size: 11px;
  font-weight: 800;
  color: ${THEME.foreground};
`;

const CardCountTag = styled.span`
  font-size: 9px;
  color: ${THEME.mutedForeground};
  margin-left: auto;
`;

const CardDesc = styled.p`
  margin: 0;
  font-size: 10px;
  color: ${THEME.mutedForeground};
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const VoiceBlock = styled.section<{ $compact: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: ${props => props.$compact ? '0' : '10px 12px'};
  background: ${props => props.$compact ? 'transparent' : '#ffffff'};
  border: ${props => props.$compact ? 'none' : `1px solid ${THEME.border}`};
  border-radius: ${THEME.radius.md};
`;

const VoiceHeading = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 800;
  color: ${THEME.foreground};
`;

const VoiceState = styled.span`
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
  color: ${THEME.mutedForeground};
`;

const VoiceControls = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
`;

const VoiceButton = styled.button<{ $active: boolean }>`
  min-width: 0;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 4px;
  border: 1px solid ${props => props.$active ? THEME.gold : THEME.border};
  border-radius: ${THEME.radius.sm};
  background: ${props => props.$active ? 'rgba(197, 160, 89, 0.14)' : '#f8fafc'};
  color: ${props => props.$active ? THEME.primary : THEME.mutedForeground};
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;

  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const VoiceError = styled.p`
  margin: 0;
  color: ${THEME.destructive};
  font-size: 10.5px;
  line-height: 1.35;
`;

const SettingsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #ffffff;
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radius.md};
  font-size: 12px;
  font-weight: 700;
  color: ${THEME.foreground};
`;

const ToggleBtn = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: ${props => (props.$active ? 'rgba(197, 160, 89, 0.15)' : '#f1f5f9')};
  border: 1px solid ${props => (props.$active ? THEME.gold : THEME.border)};
  border-radius: ${THEME.radius.md};
  font-size: 11px;
  font-weight: 800;
  color: ${props => (props.$active ? THEME.primary : THEME.mutedForeground)};
  cursor: pointer;
`;

const VolumeRow = styled.div`
  padding: 8px 12px 10px;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radius.md};

  label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 7px;
    font-size: 11px;
    color: ${THEME.foreground};
  }

  strong { color: ${THEME.burgundy}; }

  input { width: 100%; accent-color: ${THEME.burgundy}; }
  input:disabled { opacity: 0.45; }
`;

const ValueTag = styled.span`
  font-size: 11.5px;
  font-weight: 800;
  color: ${THEME.burgundy};
`;

const DrawerFooter = styled.div`
  padding: 14px 18px;
  border-top: 1px solid ${THEME.border};
  background: #ffffff;
`;

const LeaveBtn = styled.button`
  width: 100%;
  height: 40px;
  background: ${THEME.destructive};
  color: #ffffff;
  border: none;
  border-radius: ${THEME.radius.md};
  font-family: ${THEME.font.serif};
  font-weight: 800;
  font-size: 12.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(159, 18, 57, 0.25);
  transition: all 0.15s ease;

  &:hover {
    background: #881337;
  }
`;
