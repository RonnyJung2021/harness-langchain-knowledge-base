import type { ReactElement, ReactNode } from "react";
import { createContext, useContext } from "react";
import type { KbBundleStore } from "@kb-rag/client-offline-core";

const KbBundleStoreContext = createContext<KbBundleStore | null>(null);

export type KbBundleStoreProviderProps = {
  /** 由宿主（如 Expo）注入；Web 可不传，保持 `null`。 */
  value: KbBundleStore | null;
  children: ReactNode;
};

export function KbBundleStoreProvider(props: KbBundleStoreProviderProps): ReactElement {
  const { value, children } = props;
  return <KbBundleStoreContext.Provider value={value}>{children}</KbBundleStoreContext.Provider>;
}

export function useKbBundleStore(): KbBundleStore | null {
  return useContext(KbBundleStoreContext);
}
