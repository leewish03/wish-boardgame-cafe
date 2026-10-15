import { useEffect, useRef } from 'react';

const openDialogs: HTMLElement[] = [];

export function useDialogFocus<T extends HTMLElement>(open: boolean, onClose?: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const panel = ref.current;
    if (!open || !panel) return;
    const previous = document.activeElement;
    openDialogs.push(panel);
    const controls = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
    const focusFrame = requestAnimationFrame(() => {
      if (openDialogs[openDialogs.length - 1] === panel) (controls()[0] || panel).focus();
    });
    const handleKey = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== panel) return;
      const nativeModal = document.activeElement?.closest('dialog:modal');
      // Native top-layer dialogs own their keyboard handling, even above a custom panel.
      if (nativeModal && (nativeModal === panel || !nativeModal.contains(panel))) return;
      if (event.key === 'Escape' && close.current) {
        event.preventDefault();
        close.current();
      }
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) { event.preventDefault(); panel.focus(); return; }
      if (!panel.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKey);
      const wasTop = openDialogs[openDialogs.length - 1] === panel;
      const index = openDialogs.indexOf(panel);
      if (index !== -1) openDialogs.splice(index, 1);
      if (wasTop && previous instanceof window.HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);
  return ref;
}
