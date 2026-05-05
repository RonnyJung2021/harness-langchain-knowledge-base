import type { ReactElement, ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readStoredPreferOffline, writeStoredPreferOffline } from "./offlinePrefStorage.js";

export type OfflinePreferenceContextValue = {
  preferOffline: boolean;
  setPreferOffline: (v: boolean) => void;
  /** 已从 AsyncStorage / localStorage 恢复初值 */
  hydrated: boolean;
};

const OfflinePreferenceContext = createContext<OfflinePreferenceContextValue | null>(null);

export type OfflinePreferenceProviderProps = {
  children: ReactNode;
};

export function OfflinePreferenceProvider(props: OfflinePreferenceProviderProps): ReactElement {
  const { children } = props;
  const [preferOffline, setPreferState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void readStoredPreferOffline().then((v) => {
      if (!cancelled) {
        setPreferState(v);
        setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreferOffline = useCallback((v: boolean) => {
    setPreferState(v);
    void writeStoredPreferOffline(v);
  }, []);

  const value = useMemo<OfflinePreferenceContextValue>(
    () => ({ preferOffline, setPreferOffline, hydrated }),
    [preferOffline, setPreferOffline, hydrated],
  );

  return <OfflinePreferenceContext.Provider value={value}>{children}</OfflinePreferenceContext.Provider>;
}

export function useOfflinePreference(): OfflinePreferenceContextValue {
  const v = useContext(OfflinePreferenceContext);
  if (v === null) {
    throw new Error("useOfflinePreference 须在 OfflinePreferenceProvider 内使用");
  }
  return v;
}
