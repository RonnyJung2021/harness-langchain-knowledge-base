import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { tokens, type ThemeTokens } from "./tokens.js";

type ThemeContextValue = {
  tokens: ThemeTokens;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider(props: { children: ReactNode }) {
  const value = useMemo(() => ({ tokens }), []);
  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    return { tokens };
  }
  return ctx;
}
