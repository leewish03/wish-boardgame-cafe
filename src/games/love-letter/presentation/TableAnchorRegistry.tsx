import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';

export type TableAnchorKind = 'identity' | 'hand' | 'discard';

interface RegistryValue {
  register: (playerId: string, kind: TableAnchorKind, element: HTMLElement | null) => void;
  get: (playerId: string, kind: TableAnchorKind) => HTMLElement | null;
}

const TableAnchorContext = createContext<RegistryValue | null>(null);

export const TableAnchorProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const anchors = useRef(new Map<string, HTMLElement>());
  const register = useCallback((playerId: string, kind: TableAnchorKind, element: HTMLElement | null) => {
    const key = `${playerId}:${kind}`;
    if (element) anchors.current.set(key, element);
    else anchors.current.delete(key);
  }, []);
  const get = useCallback((playerId: string, kind: TableAnchorKind) => anchors.current.get(`${playerId}:${kind}`) || null, []);
  const value = useMemo(() => ({ register, get }), [register, get]);
  return <TableAnchorContext.Provider value={value}>{children}</TableAnchorContext.Provider>;
};

export function useTableAnchor(playerId: string, kind: TableAnchorKind) {
  const registry = useContext(TableAnchorContext);
  return useCallback((element: HTMLElement | null) => registry?.register(playerId, kind, element), [registry, playerId, kind]);
}

export function useTableAnchorRegistry() {
  const registry = useContext(TableAnchorContext);
  if (!registry) throw new Error('TableAnchorProvider is required');
  return registry;
}
