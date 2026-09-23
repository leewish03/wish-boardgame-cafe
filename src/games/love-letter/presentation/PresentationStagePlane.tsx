import React, { RefObject, useLayoutEffect, useState } from 'react';
import styled from 'styled-components';
import { useTableAnchor } from './TableAnchorRegistry';
import { THEME } from '../../../shared/theme';

type Rect = { left:number; top:number; width:number; height:number };

const Anchor: React.FC<{kind:'comparison-left'|'comparison-right'|'priest-review'|`round-result:${number}`}> = ({kind}) => {
  const ref = useTableAnchor('table', kind);
  return <span ref={ref} aria-hidden="true"/>;
};

/**
 * The presentation plane is deliberately outside the scrolling table content.
 * A moving card and its destination now share one fixed viewport coordinate
 * space, so text, chat, or a scrollbar cannot pull a central animation aside.
 */
export const PresentationStagePlane: React.FC<{viewportRef: RefObject<HTMLElement | null>; showComparison?: boolean}> = ({ viewportRef, showComparison = false }) => {
  const [rect, setRect] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const element = viewportRef.current;
      if (!element) return;
      const next = element.getBoundingClientRect();
      setRect(previous => previous && previous.left === next.left && previous.top === next.top && previous.width === next.width && previous.height === next.height
        ? previous : { left: next.left, top: next.top, width: next.width, height: next.height });
    };
    measure();
    const observer = new window.ResizeObserver(measure);
    if (viewportRef.current) observer.observe(viewportRef.current);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [viewportRef]);

  if (!rect) return null;
  return <Plane style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} aria-hidden="true">
    <ComparisonSlots $visible={showComparison}><Anchor kind="comparison-left"/><span>VS</span><Anchor kind="comparison-right"/></ComparisonSlots>
    <PriestSlot><Anchor kind="priest-review"/></PriestSlot>
    <RoundSlots>{Array.from({ length: 6 }, (_, index) => <Anchor key={index} kind={`round-result:${index}`}/>)}</RoundSlots>
  </Plane>;
};

const Plane = styled.div`position:fixed;z-index:590;pointer-events:none;`;
const ComparisonSlots = styled.div<{$visible:boolean}>`
  position:absolute;left:50%;top:50%;width:min(304px,78vw);height:clamp(151px,43vw,206px);transform:translate(-50%,-50%);
  display:grid;grid-template-columns:1fr 30px 1fr;align-items:center;gap:8px;
  >span:not(:nth-child(2)){display:block;width:100%;height:100%;}
  >span:nth-child(2){font:900 17px ${THEME.font.serif};color:${THEME.goldAntique};text-align:center;opacity:${p=>p.$visible ? 1 : 0};}
`;
const PriestSlot = styled.div`
  position:absolute;left:50%;top:50%;width:clamp(106px,30vw,144px);aspect-ratio:154 / 220;transform:translate(-50%,-50%);
  >span{display:block;width:100%;height:100%;}
`;
const RoundSlots = styled.div`
  position:absolute;left:50%;top:50%;width:min(420px,86vw);transform:translate(-50%,-50%);display:grid;grid-template-columns:repeat(3,1fr);gap:7px;
  >span{display:block;aspect-ratio:154 / 220;} @media(min-width:700px){grid-template-columns:repeat(6,1fr);}
`;
