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
  from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

export const slideInRight = keyframes`
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
`;

export const slideUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const pulseRing = keyframes`
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.7); }
  70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(5, 150, 105, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(5, 150, 105, 0); }
`;

export const goldGlow = keyframes`
  0% { box-shadow: 0 0 5px rgba(212, 175, 55, 0.4); }
  50% { box-shadow: 0 0 18px rgba(212, 175, 55, 0.85); }
  100% { box-shadow: 0 0 5px rgba(212, 175, 55, 0.4); }
`;

// =========================================================================
// 1. Button Component (Marble & Metal Touch)
// =========================================================================

const buttonVariants = {
  default: css`
    background-color: ${THEME.primary};
    color: ${THEME.primaryForeground};
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.2);
    &:hover {
      background-color: #1e293b;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.3);
    }
  `,
  secondary: css`
    background-color: ${THEME.secondary};
    color: ${THEME.secondaryForeground};
    border: 1px solid ${THEME.border};
    &:hover {
      background-color: #e2e8f0;
    }
  `,
  outline: css`
    border: 1px solid ${THEME.border};
    background-color: #ffffff;
    color: ${THEME.foreground};
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
    &:hover {
      background-color: ${THEME.secondary};
      border-color: #cbd5e1;
    }
  `,
  ghost: css`
    background-color: transparent;
    color: ${THEME.foreground};
    &:hover {
      background-color: ${THEME.secondary};
    }
  `,
  destructive: css`
    background-color: ${THEME.destructive};
    color: ${THEME.destructiveForeground};
    &:hover {
      background-color: #9f1239;
    }
  `,
  emerald: css`
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #ffffff;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
    &:hover {
      filter: brightness(1.08);
      box-shadow: 0 4px 14px rgba(5, 150, 105, 0.45);
    }
  `,
  burgundy: css`
    background: ${THEME.gradients.burgundySeal};
    color: #ffffff;
    border: 1px solid ${THEME.gold};
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(123, 24, 54, 0.35);
    &:hover {
      filter: brightness(1.1);
      box-shadow: 0 4px 14px rgba(123, 24, 54, 0.55);
    }
  `,
  gold: css`
    background: ${THEME.gradients.goldShimmer};
    color: #0f172a;
    font-weight: 800;
    box-shadow: 0 2px 10px rgba(212, 175, 55, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.4);
    &:hover {
      filter: brightness(1.08);
      box-shadow: 0 4px 16px rgba(212, 175, 55, 0.6);
    }
  `,
};

const buttonSizes = {
  default: css`
    height: 38px;
    padding: 0 16px;
    font-size: 14px;
  `,
  sm: css`
    height: 30px;
    padding: 0 10px;
    font-size: 12px;
    border-radius: ${THEME.radius.sm};
  `,
  lg: css`
    height: 44px;
    padding: 0 24px;
    font-size: 15px;
    border-radius: ${THEME.radius.md};
  `,
  icon: css`
    height: 36px;
    width: 36px;
    padding: 0;
    border-radius: ${THEME.radius.md};
  `,
};

export const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
  border-radius: ${THEME.radius.md};
  font-family: ${THEME.font.sans};
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
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
    transform: scale(0.98);
  }

  ${({ $variant = 'default' }) => buttonVariants[$variant] || buttonVariants.default}
  ${({ $size = 'default' }) => buttonSizes[$size] || buttonSizes.default}
  ${({ $fullWidth }) => $fullWidth && css`width: 100%;`}
`;

// =========================================================================
// 2. Card Components (Marble Slab)
// =========================================================================

export const Card = styled.div`
  border-radius: ${THEME.radius.xl};
  border: 1px solid ${THEME.border};
  background-color: #ffffff;
  background-image: ${THEME.gradients.marbleSlab};
  color: ${THEME.foreground};
  box-shadow: ${THEME.shadows.marbleSlab};
  overflow: hidden;
  position: relative;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;

  ${({ $hoverable }) =>
    $hoverable &&
    css`
      cursor: pointer;
      &:hover {
        border-color: ${THEME.gold};
        box-shadow: ${THEME.shadows.marbleCardHover};
        transform: translateY(-2px);
      }
    `}

  ${({ $active }) =>
    $active &&
    css`
      border-color: ${THEME.gold};
      box-shadow: ${THEME.shadows.goldNeon};
    `}
`;

export const CardHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: ${({ $padding = '20px' }) => $padding};
`;

export const CardTitle = styled.h3`
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
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
  line-height: 1.4;
`;

export const CardContent = styled.div`
  padding: ${({ $padding = '0 20px 20px 20px' }) => $padding};
`;

export const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px 20px 20px;
  gap: 10px;
`;

// =========================================================================
// 3. Dialog / Modal (Polished Marble Modal)
// =========================================================================

const DialogOverlayWrapper = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(8px);
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
  background-image: ${THEME.gradients.marbleSlab};
  border: 1.5px solid ${THEME.border};
  border-radius: ${THEME.radius.xl};
  padding: 24px;
  box-shadow: 0 25px 50px rgba(15, 23, 42, 0.25), 0 0 20px rgba(212, 175, 55, 0.2);
  animation: ${zoomIn} 0.2s ease-out;
  color: ${THEME.foreground};
`;

const CloseButton = styled.button`
  position: absolute;
  right: 16px;
  top: 16px;
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
`;

export const DialogTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 800;
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
  line-height: 1.4;
`;

export const DialogFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
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
  height: 42px;
  align-items: center;
  justify-content: flex-start;
  border-radius: ${THEME.radius.lg};
  background-color: ${THEME.muted};
  border: 1px solid ${THEME.border};
  padding: 4px;
  gap: 4px;
  color: ${THEME.mutedForeground};
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
`;

export const TabsTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
  border-radius: ${THEME.radius.md};
  padding: 6px 14px;
  font-size: 0.875rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  flex: ${({ $fullWidth }) => ($fullWidth ? '1' : 'none')};

  background-color: ${({ $active }) => ($active ? '#ffffff' : 'transparent')};
  color: ${({ $active }) => ($active ? THEME.foreground : THEME.mutedForeground)};
  box-shadow: ${({ $active }) => ($active ? '0 2px 6px rgba(15, 23, 42, 0.1)' : 'none')};

  &:hover {
    color: ${THEME.foreground};
  }
`;

export const TabsContent = styled.div`
  margin-top: 16px;
  width: 100%;
`;

// =========================================================================
// 5. Side Drawer (Marble Slide-in)
// =========================================================================

const DrawerOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 900;
  background-color: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
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
  background-color: rgba(255, 255, 255, 0.98);
  background-image: ${THEME.gradients.marbleSlab};
  border-left: 1.5px solid ${THEME.border};
  backdrop-filter: blur(16px);
  padding: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: -10px 0 30px rgba(15, 23, 42, 0.15);
  animation: ${slideInRight} 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  color: ${THEME.foreground};
`;

const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid ${THEME.border};
  margin-bottom: 16px;
`;

const DrawerTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 700;
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
    background-color: ${THEME.secondary};
    color: ${THEME.foreground};
    border: 1px solid ${THEME.border};
  `,
  emerald: css`
    background-color: rgba(5, 150, 105, 0.12);
    color: #047857;
    border: 1px solid rgba(5, 150, 105, 0.3);
  `,
  gold: css`
    background: linear-gradient(135deg, rgba(254, 240, 138, 0.9) 0%, rgba(212, 175, 55, 0.9) 100%);
    color: #0f172a;
    font-weight: 800;
    border: 1px solid ${THEME.gold};
    box-shadow: 0 1px 3px rgba(212, 175, 55, 0.3);
  `,
  rose: css`
    background-color: rgba(225, 29, 72, 0.12);
    color: #be123c;
    border: 1px solid rgba(225, 29, 72, 0.3);
  `,
  burgundy: css`
    background: ${THEME.gradients.burgundySeal};
    color: #ffffff;
    border: 1px solid ${THEME.gold};
    font-weight: 700;
  `,
  indigo: css`
    background-color: rgba(79, 70, 229, 0.12);
    color: #4338ca;
    border: 1px solid rgba(79, 70, 229, 0.3);
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
  border-radius: ${THEME.radius.full};
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: 0.02em;
  white-space: nowrap;

  ${({ $variant = 'default' }) => badgeVariants[$variant] || badgeVariants.default}
`;

// =========================================================================
// 7. Affection Token Component (실물 딥 버건디 왁스 실 + 골드 천칭 ⚖️ 각인)
// =========================================================================

const TokenSealWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: ${THEME.gradients.burgundySeal};
  border: 1.5px solid ${THEME.gold};
  border-radius: ${THEME.radius.full};
  padding: 1px 7px;
  box-shadow: 0 2px 6px rgba(123, 24, 54, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.3);
  color: #ffffff;
  font-size: ${({ $size }) => ($size === 'sm' ? '10px' : '11px')};
  font-weight: 800;
  user-select: none;
  white-space: nowrap;
`;

export function AffectionTokenBadge({ count = 0, target = 4, size = 'default' }) {
  return (
    <TokenSealWrapper $size={size} title={`호감 토큰: ${count}/${target}개`}>
      <span style={{ fontSize: size === 'sm' ? '10px' : '12px' }}>⚖️</span>
      <span>{count}</span>
      {target && <span style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '9px' }}>/{target}</span>}
    </TokenSealWrapper>
  );
}

// =========================================================================
// 8. Input Component
// =========================================================================

export const Input = styled.input`
  width: 100%;
  height: 38px;
  border-radius: ${THEME.radius.md};
  border: 1.5px solid ${THEME.input};
  background-color: #ffffff;
  padding: 0 12px;
  font-size: 14px;
  font-family: ${THEME.font.sans};
  color: ${THEME.foreground};
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;

  &::placeholder {
    color: ${THEME.mutedForeground};
  }

  &:focus {
    border-color: ${THEME.gold};
    box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.2);
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
  background-image: ${THEME.gradients.marbleSlab};
  border: 1.5px solid ${THEME.gold};
  border-radius: ${THEME.radius.lg};
  padding: 12px 20px;
  color: ${THEME.foreground};
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18), 0 0 15px rgba(212, 175, 55, 0.3);
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
// 10. PauseOverlay Component (3-minute Grace Period Overlay)
// =========================================================================

const PauseOverlayContainer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1500;
  background-color: rgba(15, 23, 42, 0.75);
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
  background-image: ${THEME.gradients.marbleSlab};
  border: 2px solid ${THEME.gold};
  border-radius: ${THEME.radius.xl};
  padding: 32px 24px;
  box-shadow: 0 25px 60px rgba(15, 23, 42, 0.35), 0 0 40px rgba(212, 175, 55, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
`;

const PauseTimerText = styled.div`
  font-size: 40px;
  font-weight: 900;
  color: ${THEME.burgundy};
  font-family: ${THEME.font.mono};
  letter-spacing: 2px;
  margin: 8px 0;
  text-shadow: 0 2px 10px rgba(123, 24, 54, 0.2);
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
        <div style={{ fontSize: '32px' }}>⏳</div>
        <DialogTitle style={{ color: THEME.foreground, fontSize: '18px' }}>
          게임 일시정지 (재접속 대기 중)
        </DialogTitle>
        <div style={{ fontSize: '13px', color: THEME.mutedForeground, lineHeight: 1.5 }}>
          <strong style={{ color: THEME.burgundy }}>[{pausedPlayerNickname}]</strong> 님의 연결이 끊어졌습니다.
          <br />
          재접속을 위해 최대 3분간 게임이 일시정지됩니다.
        </div>

        <PauseTimerText>{formattedTime}</PauseTimerText>

        <div style={{ fontSize: '12px', color: THEME.mutedForeground }}>
          시간이 초과되면 해당 플레이어는 자동 기권(탈락) 처리됩니다.
        </div>

        {onForfeit && (
          <Button
            $variant="outline"
            $size="sm"
            onClick={onForfeit}
            style={{ marginTop: '8px', borderColor: THEME.destructive, color: THEME.destructive }}
          >
            기다리지 않고 나가기 (🚪 기권)
          </Button>
        )}
      </PauseCard>
    </PauseOverlayContainer>
  );
}
