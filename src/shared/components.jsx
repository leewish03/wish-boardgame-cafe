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
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
`;

export const goldGlow = keyframes`
  0% { box-shadow: 0 0 5px rgba(245, 158, 11, 0.4); }
  50% { box-shadow: 0 0 18px rgba(245, 158, 11, 0.85); }
  100% { box-shadow: 0 0 5px rgba(245, 158, 11, 0.4); }
`;

// =========================================================================
// 1. Button Component
// =========================================================================

const buttonVariants = {
  default: css`
    background-color: ${THEME.primary};
    color: ${THEME.primaryForeground};
    font-weight: 600;
    &:hover {
      background-color: #e4e4e7;
    }
  `,
  secondary: css`
    background-color: ${THEME.secondary};
    color: ${THEME.secondaryForeground};
    &:hover {
      background-color: #3f3f46;
    }
  `,
  outline: css`
    border: 1px solid ${THEME.border};
    background-color: transparent;
    color: ${THEME.foreground};
    &:hover {
      background-color: ${THEME.secondary};
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
      background-color: #991b1b;
    }
  `,
  gold: css`
    background: linear-gradient(135deg, ${THEME.goldLight} 0%, ${THEME.gold} 100%);
    color: #000;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
    &:hover {
      filter: brightness(1.1);
      box-shadow: 0 4px 14px rgba(245, 158, 11, 0.5);
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
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  outline: none;
  user-select: none;

  &:focus-visible {
    box-shadow: 0 0 0 2px ${THEME.background}, 0 0 0 4px ${THEME.ring};
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
// 2. Card Components
// =========================================================================

export const Card = styled.div`
  border-radius: ${THEME.radius.xl};
  border: 1px solid ${THEME.border};
  background-color: ${THEME.card};
  color: ${THEME.cardForeground};
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.2);
  overflow: hidden;
  position: relative;
  transition: border-color 0.2s, box-shadow 0.2s;

  ${({ $hoverable }) =>
    $hoverable &&
    css`
      cursor: pointer;
      &:hover {
        border-color: #3f3f46;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      }
    `}

  ${({ $active }) =>
    $active &&
    css`
      border-color: ${THEME.gold};
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.25);
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
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin: 0;
  color: ${THEME.cardForeground};
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
// 3. Dialog / Modal
// =========================================================================

const DialogOverlayWrapper = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(6px);
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
  background-color: ${THEME.background};
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radius.xl};
  padding: 24px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
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
  transition: color 0.15s;

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
  font-weight: 700;
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
  height: 40px;
  align-items: center;
  justify-content: flex-start;
  border-radius: ${THEME.radius.lg};
  background-color: ${THEME.muted};
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
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  flex: ${({ $fullWidth }) => ($fullWidth ? '1' : 'none')};

  background-color: ${({ $active }) => ($active ? THEME.background : 'transparent')};
  color: ${({ $active }) => ($active ? THEME.foreground : THEME.mutedForeground)};
  box-shadow: ${({ $active }) => ($active ? '0 1px 3px rgba(0,0,0,0.3)' : 'none')};

  &:hover {
    color: ${THEME.foreground};
  }
`;

export const TabsContent = styled.div`
  margin-top: 16px;
  width: 100%;
`;

// =========================================================================
// 5. Side Drawer (Transparent Slide-in)
// =========================================================================

const DrawerOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 900;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(3px);
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
  background-color: rgba(9, 9, 11, 0.95);
  border-left: 1px solid ${THEME.border};
  backdrop-filter: blur(16px);
  padding: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.7);
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
  font-weight: 600;
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
  `,
  emerald: css`
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  `,
  gold: css`
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  `,
  rose: css`
    background-color: rgba(244, 63, 94, 0.15);
    color: #fb7185;
    border: 1px solid rgba(244, 63, 94, 0.3);
  `,
  indigo: css`
    background-color: rgba(99, 102, 241, 0.15);
    color: #818cf8;
    border: 1px solid rgba(99, 102, 241, 0.3);
  `,
  outline: css`
    border: 1px solid ${THEME.border};
    color: ${THEME.mutedForeground};
    background: transparent;
  `,
};

export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: ${THEME.radius.full};
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: 0.02em;
  white-space: nowrap;

  ${({ $variant = 'default' }) => badgeVariants[$variant] || badgeVariants.default}
`;

// =========================================================================
// 7. Input Component
// =========================================================================

export const Input = styled.input`
  width: 100%;
  height: 38px;
  border-radius: ${THEME.radius.md};
  border: 1px solid ${THEME.input};
  background-color: rgba(9, 9, 11, 0.6);
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
    border-color: ${THEME.ring};
    box-shadow: 0 0 0 2px rgba(212, 212, 216, 0.2);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// =========================================================================
// 8. Toast / Notification Component
// =========================================================================

const ToastContainer = styled.div`
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  background-color: ${THEME.card};
  border: 1px solid ${THEME.border};
  border-radius: ${THEME.radius.lg};
  padding: 12px 20px;
  color: ${THEME.foreground};
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
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
