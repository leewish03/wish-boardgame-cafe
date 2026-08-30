import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import { THEME } from './theme';
import { X } from 'lucide-react';

// =========================================================================
// Keyframe Animations
// =========================================================================

export const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

export const zoomIn = keyframes`
  from { opacity: 0; transform: translate(-50%, -48%) scale(0.97); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

export const slideInRight = keyframes`
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
`;

export const slideUp = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const pulseRing = keyframes`
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(4, 120, 87, 0.6); }
  70% { transform: scale(1.05); box-shadow: 0 0 0 8px rgba(4, 120, 87, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(4, 120, 87, 0); }
`;

export const goldGlow = keyframes`
  0% { box-shadow: 0 0 4px rgba(197, 160, 89, 0.4); }
  50% { box-shadow: 0 0 16px rgba(197, 160, 89, 0.75); }
  100% { box-shadow: 0 0 4px rgba(197, 160, 89, 0.4); }
`;

// =========================================================================
// 1. Button Component (Obsidian Slate & Brushed Brass)
// =========================================================================

const buttonVariants = {
  default: css`
    background: ${THEME.gradients.obsidianButton};
    color: #ffffff;
    font-family: ${THEME.font.serif};
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: 1px solid #1e293b;
    box-shadow: 0 4px 12px rgba(9, 13, 22, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15);
    &:hover {
      background: #000000;
      border-color: ${THEME.gold};
      box-shadow: 0 6px 18px rgba(9, 13, 22, 0.35), 0 0 12px rgba(197, 160, 89, 0.3);
      color: ${THEME.goldLight};
    }
  `,
  secondary: css`
    background-color: #ffffff;
    color: ${THEME.foreground};
    border: 1px solid ${THEME.border};
    font-weight: 600;
    &:hover {
      background-color: ${THEME.secondary};
      border-color: #cbd5e1;
    }
  `,
  outline: css`
    border: 1.5px solid ${THEME.borderGold};
    background-color: rgba(255, 255, 255, 0.9);
    color: ${THEME.foreground};
    font-family: ${THEME.font.serif};
    font-weight: 700;
    letter-spacing: 0.05em;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
    &:hover {
      background-color: #ffffff;
      border-color: ${THEME.goldAntique};
      box-shadow: 0 4px 12px rgba(197, 160, 89, 0.2);
    }
  `,
  ghost: css`
    background-color: transparent;
    color: ${THEME.foreground};
    &:hover {
      background-color: rgba(15, 23, 42, 0.05);
    }
  `,
  destructive: css`
    background-color: ${THEME.destructive};
    color: #ffffff;
    font-weight: 700;
    &:hover {
      background-color: #881337;
    }
  `,
  emerald: css`
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    color: #ffffff;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(4, 120, 87, 0.25);
    &:hover {
      filter: brightness(1.06);
    }
  `,
  burgundy: css`
    background: ${THEME.gradients.burgundySeal};
    color: #ffffff;
    border: 1px solid ${THEME.gold};
    font-family: ${THEME.font.serif};
    font-weight: 700;
    letter-spacing: 0.04em;
    box-shadow: 0 4px 12px rgba(99, 19, 38, 0.3);
    &:hover {
      filter: brightness(1.1);
      box-shadow: 0 6px 16px rgba(99, 19, 38, 0.45);
    }
  `,
  gold: css`
    background: ${THEME.gradients.goldShimmer};
    color: #090d16;
    font-family: ${THEME.font.serif};
    font-weight: 800;
    letter-spacing: 0.06em;
    border: 1px solid rgba(255, 255, 255, 0.6);
    box-shadow: 0 4px 14px rgba(197, 160, 89, 0.35);
    &:hover {
      filter: brightness(1.06);
      box-shadow: 0 6px 20px rgba(197, 160, 89, 0.55);
    }
  `,
};

const buttonSizes = {
  default: css`
    height: 42px;
    padding: 0 20px;
    font-size: 13.5px;
  `,
  sm: css`
    height: 32px;
    padding: 0 12px;
    font-size: 11.5px;
    border-radius: ${THEME.radius.sm};
  `,
  lg: css`
    height: 48px;
    padding: 0 28px;
    font-size: 15px;
    border-radius: ${THEME.radius.md};
  `,
  icon: css`
    height: 36px;
    width: 36px;
    padding: 0;
    border-radius: ${THEME.radius.sm};
  `,
};

export const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
  border-radius: ${THEME.radius.sm};
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  outline: none;
  user-select: none;

  &:focus-visible {
    box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px ${THEME.ring};
  }

  &:disabled {
    pointer-events: none;
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:active {
    transform: scale(0.985);
  }

  ${({ $variant = 'default' }) => buttonVariants[$variant] || buttonVariants.default}
  ${({ $size = 'default' }) => buttonSizes[$size] || buttonSizes.default}
  ${({ $fullWidth }) => $fullWidth && css`width: 100%;`}
`;

// =========================================================================
// 2. Marble Slab / Card Components (Double Hairline Brass Inlay)
// =========================================================================

export const Card = styled.div`
  border-radius: ${THEME.radius.lg};
  background-color: #ffffff;
  background-image: ${THEME.gradients.marbleTextureUrl}, ${THEME.gradients.marbleSlab};
  background-size: cover;
  background-position: center;
  color: ${THEME.foreground};
  border: 1px solid #dcdfe4;
  box-shadow: ${THEME.shadows.marbleSlab};
  overflow: hidden;
  position: relative;
  transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;

  /* Double Hairline Brass Inlay Frame */
  &::after {
    content: '';
    position: absolute;
    inset: 4px;
    border: 1px solid rgba(197, 160, 89, 0.45);
    border-radius: calc(${THEME.radius.lg} - 3px);
    pointer-events: none;
  }

  ${({ $hoverable }) =>
    $hoverable &&
    css`
      cursor: pointer;
      &:hover {
        border-color: ${THEME.gold};
        box-shadow: ${THEME.shadows.marbleCardHover};
        transform: translateY(-3px);
      }
    `}

  ${({ $active }) =>
    $active &&
    css`
      border-color: ${THEME.gold};
      box-shadow: 0 0 0 1px ${THEME.gold}, ${THEME.shadows.goldNeon};
    `}
`;

export const CardHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: ${({ $padding = '24px' }) => $padding};
  position: relative;
  z-index: 2;
`;

export const CardTitle = styled.h3`
  font-family: ${THEME.font.serif};
  font-size: 1.3rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: 0.04em;
  margin: 0;
  color: ${THEME.foreground};
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const CardDescription = styled.p`
  font-size: 0.875rem;
  color: ${THEME.mutedForeground};
  margin: 0;
  line-height: 1.5;
`;

export const CardContent = styled.div`
  padding: ${({ $padding = '0 24px 24px 24px' }) => $padding};
  position: relative;
  z-index: 2;
`;

export const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px 24px 24px;
  gap: 12px;
  position: relative;
  z-index: 2;
`;

// =========================================================================
// 3. Dialog / Modal (Polished Marble Slab Modal)
// =========================================================================

const DialogOverlayWrapper = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgba(9, 13, 22, 0.75);
  backdrop-filter: blur(10px);
  animation: ${fadeIn} 0.2s ease-out;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const DialogContentWrapper = styled.div`
  position: relative;
  width: 100%;
  max-width: ${({ $maxWidth = '480px' }) => $maxWidth};
  max-height: 90vh;
  overflow-y: auto;
  background-color: #ffffff;
  background-image: ${THEME.gradients.marbleTextureUrl}, ${THEME.gradients.marbleSlab};
  background-size: cover;
  border: 1.5px solid #dcdfe4;
  border-radius: ${THEME.radius.xl};
  padding: 28px;
  box-shadow: 0 30px 70px rgba(9, 13, 22, 0.35), 0 0 25px rgba(197, 160, 89, 0.25);
  animation: ${zoomIn} 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  color: ${THEME.foreground};

  /* Double Hairline Brass Inlay */
  &::after {
    content: '';
    position: absolute;
    inset: 5px;
    border: 1px solid rgba(197, 160, 89, 0.5);
    border-radius: calc(${THEME.radius.xl} - 4px);
    pointer-events: none;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  right: 18px;
  top: 18px;
  background: transparent;
  border: none;
  color: ${THEME.mutedForeground};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: ${THEME.radius.sm};
  transition: all 0.15s;
  z-index: 10;

  &:hover {
    color: ${THEME.foreground};
    background-color: ${THEME.secondary};
  }
`;

export const DialogHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
  position: relative;
  z-index: 2;
`;

export const DialogTitle = styled.h2`
  font-family: ${THEME.font.serif};
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  margin: 0;
  color: ${THEME.foreground};
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const DialogDescription = styled.p`
  font-size: 0.875rem;
  color: ${THEME.mutedForeground};
  margin: 0;
  line-height: 1.45;
`;

export const DialogFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
  position: relative;
  z-index: 2;
`;

export function Dialog({ open, onClose, children, maxWidth = '480px' }) {
  if (!open) return null;
  return (
    <DialogOverlayWrapper onClick={onClose}>
      <DialogContentWrapper $maxWidth={maxWidth} onClick={(e) => e.stopPropagation()}>
        {onClose && (
          <CloseButton onClick={onClose} aria-label="Close">
            <X size={18} />
          </CloseButton>
        )}
        {children}
      </DialogContentWrapper>
    </DialogOverlayWrapper>
  );
}

// =========================================================================
// 4. Tabs
// =========================================================================

export const TabsList = styled.div`
  display: inline-flex;
  height: 44px;
  align-items: center;
  justify-content: flex-start;
  border-radius: ${THEME.radius.sm};
  background-color: #ffffff;
  border: 1px solid ${THEME.border};
  padding: 4px;
  gap: 4px;
  color: ${THEME.mutedForeground};
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.04);
`;

export const TabsTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
  border-radius: calc(${THEME.radius.sm} - 2px);
  padding: 6px 16px;
  font-family: ${THEME.font.serif};
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  flex: ${({ $fullWidth }) => ($fullWidth ? '1' : 'none')};

  background-color: ${({ $active }) => ($active ? THEME.primary : 'transparent')};
  color: ${({ $active }) => ($active ? '#ffffff' : THEME.mutedForeground)};
  box-shadow: ${({ $active }) => ($active ? '0 2px 8px rgba(9, 13, 22, 0.25)' : 'none')};

  &:hover {
    color: ${({ $active }) => ($active ? '#ffffff' : THEME.foreground)};
  }
`;

export const TabsContent = styled.div`
  margin-top: 16px;
  width: 100%;
`;

// =========================================================================
// 5. Side Drawer
// =========================================================================

const DrawerOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 900;
  background-color: rgba(9, 13, 22, 0.65);
  backdrop-filter: blur(6px);
  animation: ${fadeIn} 0.2s ease-out;
`;

const DrawerContainer = styled.div`
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  max-width: 360px;
  z-index: 910;
  background-color: #ffffff;
  background-image: ${THEME.gradients.marbleTextureUrl}, ${THEME.gradients.marbleSlab};
  background-size: cover;
  border-left: 1.5px solid ${THEME.gold};
  padding: 24px;
  display: flex;
  flex-direction: column;
  box-shadow: -10px 0 40px rgba(9, 13, 22, 0.2);
  animation: ${slideInRight} 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  color: ${THEME.foreground};
`;

const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(197, 160, 89, 0.3);
  margin-bottom: 18px;
`;

const DrawerTitle = styled.h3`
  font-family: ${THEME.font.serif};
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const DrawerBody = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export function SideDrawer({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <>
      <DrawerOverlay onClick={onClose} />
      <DrawerContainer onClick={(e) => e.stopPropagation()}>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <CloseButton onClick={onClose}>
            <X size={18} />
          </CloseButton>
        </DrawerHeader>
        <DrawerBody>{children}</DrawerBody>
      </DrawerContainer>
    </>
  );
}

// =========================================================================
// 6. Badge Component
// =========================================================================

const badgeVariants = {
  default: css`
    background-color: #ffffff;
    color: ${THEME.foreground};
    border: 1px solid ${THEME.border};
  `,
  emerald: css`
    background-color: rgba(4, 120, 87, 0.08);
    color: #047857;
    border: 1px solid rgba(4, 120, 87, 0.3);
  `,
  gold: css`
    background: linear-gradient(135deg, rgba(254, 240, 138, 0.95) 0%, rgba(197, 160, 89, 0.95) 100%);
    color: #090d16;
    font-weight: 800;
    border: 1px solid ${THEME.gold};
  `,
  rose: css`
    background-color: rgba(190, 18, 60, 0.08);
    color: #9f1239;
    border: 1px solid rgba(190, 18, 60, 0.3);
  `,
  burgundy: css`
    background: ${THEME.gradients.burgundySeal};
    color: #ffffff;
    border: 1px solid ${THEME.gold};
    font-family: ${THEME.font.serif};
    font-weight: 700;
  `,
  indigo: css`
    background-color: rgba(55, 48, 163, 0.08);
    color: #3730a3;
    border: 1px solid rgba(55, 48, 163, 0.3);
  `,
  outline: css`
    border: 1px solid ${THEME.border};
    color: ${THEME.foreground};
    background: #ffffff;
  `,
};

export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: ${THEME.radius.sm};
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;

  ${({ $variant = 'default' }) => badgeVariants[$variant] || badgeVariants.default}
`;

// =========================================================================
// 7. Affection Token Component (Heritage Burgundy Wax Seal)
// =========================================================================

const TokenSealWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: ${THEME.gradients.burgundySeal};
  border: 1.5px solid ${THEME.gold};
  border-radius: ${THEME.radius.full};
  padding: 1px 7px;
  box-shadow: 0 2px 6px rgba(99, 19, 38, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.3);
  color: #ffffff;
  font-size: ${({ $size }) => ($size === 'sm' ? '10px' : '11px')};
  font-weight: 800;
  user-select: none;
  white-space: nowrap;
`;

export function AffectionTokenBadge({ count = 0, target = 4, size = 'default' }) {
  return (
    <TokenSealWrapper $size={size} title={`호감 토큰: ${count}/${target}개`}>
      <span style={{ fontSize: size === 'sm' ? '10px' : '11px' }}>⚖</span>
      <span>{count}</span>
      {target && <span style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '9px' }}>/{target}</span>}
    </TokenSealWrapper>
  );
}

// =========================================================================
// 8. Input Component (Chiseled Stone Field with Hairline Inset)
// =========================================================================

export const Input = styled.input`
  width: 100%;
  height: 42px;
  border-radius: ${THEME.radius.sm};
  border: 1.5px solid ${THEME.input};
  background-color: #ffffff;
  padding: 0 14px;
  font-size: 14px;
  font-family: ${THEME.font.sans};
  font-weight: 600;
  color: ${THEME.foreground};
  outline: none;
  box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.05);
  transition: all 0.15s ease-in-out;

  &::placeholder {
    color: ${THEME.mutedForeground};
    font-weight: 400;
  }

  &:focus {
    border-color: ${THEME.gold};
    box-shadow: 0 0 0 3px rgba(197, 160, 89, 0.2), inset 0 1px 2px rgba(15, 23, 42, 0.03);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: ${THEME.secondary};
  }
`;

// =========================================================================
// 9. Toast / Notification Component
// =========================================================================

const ToastContainer = styled.div`
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  background-color: #ffffff;
  background-image: ${THEME.gradients.marbleTextureUrl}, ${THEME.gradients.marbleSlab};
  background-size: cover;
  border: 1.5px solid ${THEME.gold};
  border-radius: ${THEME.radius.md};
  padding: 12px 24px;
  color: ${THEME.foreground};
  font-family: ${THEME.font.sans};
  font-size: 13.5px;
  font-weight: 700;
  box-shadow: 0 12px 32px rgba(9, 13, 22, 0.2), 0 0 15px rgba(197, 160, 89, 0.25);
  animation: ${slideUp} 0.2s ease-out;
  display: flex;
  align-items: center;
  gap: 8px;
`;

export function Toast({ message, onClose }) {
  React.useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose && onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return <ToastContainer>{message}</ToastContainer>;
}

// =========================================================================
// 10. PauseOverlay Component
// =========================================================================

const PauseOverlayContainer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1500;
  background-color: rgba(9, 13, 22, 0.8);
  backdrop-filter: blur(14px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: ${fadeIn} 0.3s ease-out;
  color: ${THEME.foreground};
  user-select: none;
`;

const PauseCard = styled.div`
  max-width: 480px;
  width: 100%;
  background: #ffffff;
  background-image: ${THEME.gradients.marbleTextureUrl}, ${THEME.gradients.marbleSlab};
  background-size: cover;
  border: 2px solid ${THEME.gold};
  border-radius: ${THEME.radius.xl};
  padding: 36px 28px;
  box-shadow: 0 30px 70px rgba(9, 13, 22, 0.4), 0 0 40px rgba(197, 160, 89, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: 5px;
    border: 1px solid rgba(197, 160, 89, 0.5);
    border-radius: calc(${THEME.radius.xl} - 4px);
    pointer-events: none;
  }
`;

const PauseTimerText = styled.div`
  font-size: 42px;
  font-weight: 900;
  color: ${THEME.burgundy};
  font-family: ${THEME.font.mono};
  letter-spacing: 2px;
  margin: 8px 0;
  text-shadow: 0 2px 10px rgba(99, 19, 38, 0.2);
`;

export function PauseOverlay({
  open,
  pausedPlayerNickname = '플레이어',
  pauseExpiresAt,
  onForfeit,
}) {
  const [timeLeft, setTimeLeft] = React.useState(180);

  React.useEffect(() => {
    if (!open || !pauseExpiresAt) return;

    const updateTimer = () => {
      const remainingMs = new Date(pauseExpiresAt).getTime() - Date.now();
      const seconds = Math.max(0, Math.floor(remainingMs / 1000));
      setTimeLeft(seconds);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [open, pauseExpiresAt]);

  if (!open) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <PauseOverlayContainer>
      <PauseCard>
        <DialogTitle style={{ color: THEME.foreground, fontSize: '18px' }}>
          게임 일시정지 (재접속 대기)
        </DialogTitle>
        <div style={{ fontSize: '13.5px', color: THEME.mutedForeground, lineHeight: 1.5 }}>
          <strong style={{ color: THEME.burgundy }}>[{pausedPlayerNickname}]</strong> 님의 연결이 끊어졌습니다.
          <br />
          재접속을 위해 최대 3분간 게임이 일시정지됩니다.
        </div>

        <PauseTimerText>{formattedTime}</PauseTimerText>

        <div style={{ fontSize: '12px', color: THEME.mutedForeground }}>
          시간이 초과되면 해당 플레이어는 자동 기권 처리됩니다.
        </div>

        {onForfeit && (
          <Button
            $variant="outline"
            $size="sm"
            onClick={onForfeit}
            style={{ marginTop: '8px', borderColor: THEME.destructive, color: THEME.destructive }}
          >
            기다리지 않고 나가기 (기권)
          </Button>
        )}
      </PauseCard>
    </PauseOverlayContainer>
  );
}
