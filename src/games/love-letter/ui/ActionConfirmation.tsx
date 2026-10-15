import type { FC } from 'react';
import styled from 'styled-components';
import { THEME } from '../../../shared/theme';

interface ActionConfirmationProps {
  readonly cardName: string;
  readonly noEligibleTarget?: boolean;
  readonly targetName?: string;
  readonly guessName?: string | null;
  readonly submitting: boolean;
  readonly hasSelection: boolean;
  readonly canConfirm: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly onEditGuess?: () => void;
}

export const ActionConfirmation: FC<ActionConfirmationProps> = ({cardName,noEligibleTarget,targetName,guessName,submitting,hasSelection,canConfirm,onCancel,onConfirm,onEditGuess}) => (
  <Dock aria-label="선택한 카드 사용">
    <strong aria-live="polite">{cardName}{targetName && ` → ${targetName}`}{guessName && ` · ${guessName} 추측`}</strong>
    {hasSelection && noEligibleTarget && <strong role="status">선택할 수 있는 상대가 없어 카드 효과 없이 버립니다.</strong>}
    <div>
      <Choice type="button" disabled={submitting || !hasSelection} onClick={onCancel}>취소</Choice>
      {onEditGuess && <Choice type="button" disabled={submitting} onClick={onEditGuess}>{guessName ? '추측 변경' : '번호 추측'}</Choice>}
      <Confirm type="button" disabled={!canConfirm} onClick={onConfirm}>{submitting ? '전달 중…' : '이 카드 사용'}</Confirm>
    </div>
  </Dock>
);

const Dock=styled.div`position:sticky;bottom:0;z-index:5;width:min(480px,100%);justify-self:center;box-sizing:border-box;padding:6px 4px max(8px,env(safe-area-inset-bottom));display:grid;gap:5px;background:${THEME.surfaceCard};border-top:1px solid ${THEME.borderGold};strong{font:700 13px ${THEME.font.sans};text-align:center;line-height:1.4;} >div{display:flex;gap:6px;}`;
const Choice=styled.button`min-width:44px;min-height:44px;padding:8px 12px;border:1px solid ${THEME.border};border-radius:${THEME.radius.md};background:${THEME.surfaceCard};color:${THEME.foreground};font:700 13px ${THEME.font.sans};cursor:pointer;&:disabled{opacity:.45;cursor:default;}&:focus-visible{outline:3px solid ${THEME.burgundy};outline-offset:2px;}`;
const Confirm=styled(Choice)`flex:1;background:${THEME.gradients.obsidianButton};color:${THEME.primaryForeground};border-color:${THEME.goldAntique};`;
