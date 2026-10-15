import React, { useEffect, useId } from 'react';
import styled from 'styled-components';
import { Button } from './components';
import { THEME } from './theme';
import { useDialogFocus } from './useDialogFocus';

/** @type {import('styled-components').IStyledComponent<'web', React.ComponentPropsWithRef<'button'> & {
 * $variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'emerald' | 'burgundy' | 'gold',
 * $size?: 'default' | 'sm' | 'lg' | 'icon', $fullWidth?: boolean
 * }>} */
export const GameAction = styled(Button).attrs({ type: 'button' })`
  min-width: ${THEME.interaction.touchTarget};
  min-height: ${THEME.interaction.touchTarget};
  height: auto;
  padding: 8px 12px;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: keep-all;
  font: 700 ${THEME.interaction.body} ${THEME.font.sans};
  letter-spacing: normal;
  transition: background-color 150ms, color 150ms, box-shadow 150ms;
  &[aria-pressed='true'] { background: ${THEME.burgundy}; color: ${THEME.primaryForeground}; }
  &[aria-busy='true'] { cursor: wait; }
  @media (prefers-reduced-motion: reduce) {
    transition: none;
    &:active { transform: none; }
  }
`;

const Shell = styled.section`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100%;
  min-height: 0;
  min-width: 0;
  > * { min-width: 0; }
`;
const ScrollBody = styled.div`
  min-height: 0;
  min-width: 0;
  overflow: auto;
  overscroll-behavior: contain;
`;

/**
 * Parent owns the viewport; this shell owns only the middle region's scrolling.
 * @param {React.HTMLAttributes<HTMLElement> & {header?: React.ReactNode, actions?: React.ReactNode}} props
 */
export function GameShell({ header, children, actions, ...props }) {
  return <Shell {...props}><header>{header}</header><ScrollBody>{children}</ScrollBody><footer>{actions}</footer></Shell>;
}

/**
 * Slots are public presentation only; the game adapter owns authority and pending state.
 * @param {{open: boolean, title: React.ReactNode, eyebrow?: React.ReactNode, description?: React.ReactNode,
 * children?: React.ReactNode, actions?: React.ReactNode, error?: React.ReactNode, onClose?: () => void}} props
 */
export function ResultDialog({ open, title, eyebrow, description, children, actions, error, onClose }) {
  const titleId = useId();
  const dialog = useDialogFocus(open);
  useEffect(() => {
    const panel = dialog.current;
    if (open && !panel.open) panel.showModal();
    if (!open && panel.open) panel.close();
    return () => { if (panel.open) panel.close(); };
  }, [open, dialog]);
  return <ResultPanel ref={dialog} aria-labelledby={titleId} tabIndex={-1}
    onCancel={event => {
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      onClose?.();
    }}>
    <ResultHeader>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 id={titleId}>{title}</h2>
      {description && <p>{description}</p>}
    </ResultHeader>
    <ResultBody tabIndex={0} role="region" aria-label="결과 상세">{children}</ResultBody>
    <ResultFooter>
      {error && <ErrorText role="alert">{error}</ErrorText>}
      <ActionGroup>{actions}</ActionGroup>
      {onClose && <GameAction $variant="ghost" onClick={onClose}>결과 닫기</GameAction>}
    </ResultFooter>
  </ResultPanel>;
}

const ResultPanel = styled.dialog`
  box-sizing: border-box;
  width: min(680px, calc(100% - 24px));
  max-height: calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  margin: auto;
  padding: 0;
  overflow: hidden;
  border: 1px solid ${THEME.gold};
  border-radius: ${THEME.radius.xl};
  background: ${THEME.surfaceCard};
  background-image: ${THEME.gradients.marbleSlab};
  color: ${THEME.foreground};
  box-shadow: ${THEME.shadows.marbleSlab};
  font: ${THEME.interaction.body}/1.5 ${THEME.font.sans};
  overflow-wrap: anywhere;
  word-break: keep-all;
  &[open] { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
  &::backdrop { background: rgba(9, 13, 22, .58); }
  @media (max-height: 320px) {
    &[open] { display: block; overflow: auto; }
  }
`;
const ResultHeader = styled.header`
  padding: ${THEME.interaction.padding};
  border-bottom: 1px solid ${THEME.border};
  h2 { margin: 0; font: 700 20px/1.4 ${THEME.font.serif}; }
  p { margin: 8px 0 0; color: ${THEME.mutedForeground}; }
`;
const Eyebrow = styled.p`
  && { margin: 0 0 4px; font-size: ${THEME.interaction.caption}; color: ${THEME.burgundy}; }
`;
const ResultBody = styled(ScrollBody)`
  padding: ${THEME.interaction.padding};
  &:focus-visible { outline: 2px solid ${THEME.burgundy}; outline-offset: -2px; }
  @media (max-height: 320px) { overflow: visible; }
`;
const ResultFooter = styled.footer`
  display: grid;
  gap: ${THEME.interaction.gap};
  padding: ${THEME.interaction.padding};
  border-top: 1px solid ${THEME.border};
  background: ${THEME.surfaceCard};
  p { margin: 0; }
`;
const ActionGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${THEME.interaction.gap};
  align-items: center;
  > * { flex: 1 1 180px; min-width: 0; }
`;
const ErrorText = styled.p`color: ${THEME.destructive};`;
