import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { createTokens, type ColorSchemeName, type ThemeTokens } from "./tokens.js";

export type ThemeContextValue = {
  tokens: ThemeTokens;
  colorScheme: ColorSchemeName;
  /** 预留：切换主题（stub dark 可先不接交互） */
  setColorScheme?: (scheme: ColorSchemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export type ThemeProviderProps = {
  children: ReactNode;
  /** 初始配色；dark 为 stub，后续可替换为逐 token 精调暗色板 */
  colorScheme?: ColorSchemeName;
};

export function ThemeProvider(props: ThemeProviderProps) {
  const { children, colorScheme = "light" } = props;
  const value = useMemo((): ThemeContextValue => {
    const themeTokens = createTokens(colorScheme);
    return {
      tokens: themeTokens,
      colorScheme,
    };
  }, [colorScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    return {
      tokens: createTokens("light"),
      colorScheme: "light",
    };
  }
  return ctx;
}
