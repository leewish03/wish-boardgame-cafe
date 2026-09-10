import { useEffect, useState } from 'react';

export interface VisualViewportRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readViewport(): VisualViewportRect {
  if (typeof window === 'undefined') return { top: 0, left: 0, width: 0, height: 0 };
  const viewport = window.visualViewport;
  return {
    top: viewport?.offsetTop || 0,
    left: viewport?.offsetLeft || 0,
    width: viewport?.width || window.innerWidth,
    height: viewport?.height || window.innerHeight,
  };
}

/** The visual viewport shrinks above mobile soft keyboards while the layout viewport may not. */
export function useVisualViewportRect(enabled: boolean): VisualViewportRect {
  const [rect, setRect] = useState<VisualViewportRect>(readViewport);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRect(readViewport()));
    };
    const viewport = window.visualViewport;
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [enabled]);

  return rect;
}
