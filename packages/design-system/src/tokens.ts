/**
 * 设计令牌：语义色、neutral 阶梯、4px 间距网格、圆角与字号阶梯。
 * 移动端可读性：正文档最小字号 ≥14（{@link fontSize.body} 起）。
 */

/** 亮色 neutral 阶梯（简化 50–900，与常见 UI 库刻度对齐）。 */
export const neutralLight = {
  50: "#f9fafb",
  100: "#f3f4f6",
  200: "#e5e7eb",
  300: "#d1d5db",
  400: "#9ca3af",
  500: "#6b7280",
  600: "#4b5563",
  700: "#374151",
  800: "#1f2937",
  900: "#111827",
} as const;

/** 暗色 stub：背景与表面加深，正文浅灰（后续可逐 token 精调）。 */
export const neutralDark = {
  50: "#111827",
  100: "#1f2937",
  200: "#374151",
  300: "#4b5563",
  400: "#6b7280",
  500: "#9ca3af",
  600: "#d1d5db",
  700: "#e5e7eb",
  800: "#f3f4f6",
  900: "#f9fafb",
} as const;

/** 4px 网格：数值均为 4 的倍数。 */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
} as const;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

/**
 * 字号阶梯：最小用于正文/按钮的档位 ≥14。
 * `caption` 仅用于辅助说明；若需满足无障碍可读，请在业务侧勿将小字号用于长正文。
 */
export const fontSize = {
  /** 最小「可读」正文档（≥14） */
  body: 14,
  bodyLarge: 16,
  /** 次要一行说明，仍 ≥14 */
  secondary: 14,
  /** 标题级 */
  subtitle: 18,
  title: 20,
  /** 辅助（尽量短文案） */
  caption: 12,
} as const;

export type ColorSchemeName = "light" | "dark";

/** 4px 网格 + 语义别名（xs…xl），供业务组件沿用。 */
export const spaceScale = {
  ...spacing,
  xs: spacing[1],
  sm: spacing[2],
  md: spacing[3],
  lg: spacing[4],
  xl: spacing[6],
} as const;

/** 字号 + 与旧版 sm/md/lg/xs 档位对齐的别名。 */
export const fontScale = {
  ...fontSize,
  xs: fontSize.caption,
  sm: fontSize.body,
  md: fontSize.bodyLarge,
  lg: fontSize.subtitle,
} as const;

export type ThemeTokens = {
  scheme: ColorSchemeName;
  neutral: typeof neutralLight | typeof neutralDark;
  colors: {
    background: string;
    surface: string;
    surfaceElevated: string;
    text: string;
    textMuted: string;
    textInverse: string;
    border: string;
    borderStrong: string;
    primary: string;
    primaryPressed: string;
    primaryContrast: string;
    successBg: string;
    successBorder: string;
    successText: string;
    errorBg: string;
    errorBorder: string;
    errorText: string;
    assistantBubble: string;
    userBubble: string;
  };
  space: typeof spaceScale;
  radius: typeof radius;
  fontSize: typeof fontScale;
  /** 最小触控高度（pt/dp） */
  touchTargetMin: number;
};

function semanticLight(): ThemeTokens["colors"] {
  const n = neutralLight;
  return {
    background: n[100],
    surface: "#ffffff",
    surfaceElevated: "#ffffff",
    text: n[900],
    textMuted: n[600],
    textInverse: "#ffffff",
    border: n[200],
    borderStrong: n[300],
    primary: "#1a5fb4",
    primaryPressed: "#154a8f",
    primaryContrast: "#ffffff",
    successBg: "#e8f8ec",
    successBorder: "#8cba8c",
    successText: "#1e4620",
    errorBg: "#ffecec",
    errorBorder: "#e0a0a0",
    errorText: "#6b1c1c",
    assistantBubble: "#eef3fb",
    userBubble: "#e8f6ef",
  };
}

function semanticDark(): ThemeTokens["colors"] {
  const n = neutralDark;
  return {
    background: n[50],
    surface: n[100],
    surfaceElevated: n[200],
    text: n[900],
    textMuted: n[600],
    textInverse: n[50],
    border: n[200],
    borderStrong: n[300],
    primary: "#5b9fd4",
    primaryPressed: "#3d87c7",
    primaryContrast: n[50],
    successBg: "#143524",
    successBorder: "#2d6b45",
    successText: "#b8e6c8",
    errorBg: "#3d1818",
    errorBorder: "#8b4040",
    errorText: "#f5c4c4",
    assistantBubble: n[200],
    userBubble: "#1e3d2f",
  };
}

export function createTokens(scheme: ColorSchemeName): ThemeTokens {
  const isDark = scheme === "dark";
  return {
    scheme,
    neutral: isDark ? neutralDark : neutralLight,
    colors: isDark ? semanticDark() : semanticLight(),
    space: spaceScale,
    radius,
    fontSize: fontScale,
    touchTargetMin: 44,
  };
}

/** 默认亮色 tokens（无 Context 时的兜底）。 */
export const tokens = createTokens("light");
