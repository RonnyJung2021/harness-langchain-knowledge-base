/** 语义色与排版刻度（跨 Web / RN 共用，具体渲染色差由平台承担）。 */
export const tokens = {
  colors: {
    background: "#f6f7f9",
    surface: "#ffffff",
    text: "#1e2128",
    textMuted: "#5c6370",
    border: "#d8dde6",
    primary: "#1a5fb4",
    primaryContrast: "#ffffff",
    successBg: "#e8f8ec",
    successBorder: "#8cba8c",
    errorBg: "#ffecec",
    errorBorder: "#e0a0a0",
    assistantBubble: "#eef3fb",
    userBubble: "#e8f6ef",
  },
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    title: 20,
  },
  touchTargetMin: 44,
} as const;

export type ThemeTokens = typeof tokens;
