import { useWindowDimensions } from "react-native";

/** 小于此宽度视为紧凑布局（底部 Tab：对话 / 工具）。 */
export const WORKSPACE_BREAKPOINT_WIDE_PX = 768;

/** 桌面居中壳最大宽度（720～960px 区间取中）。 */
export const WORKSPACE_SHELL_MAX_WIDTH_PX = 880;

export type WorkspaceLayoutVariant = "wide" | "compact";

export function layoutVariantFromWidth(width: number): WorkspaceLayoutVariant {
  return width >= WORKSPACE_BREAKPOINT_WIDE_PX ? "wide" : "compact";
}

export function useWorkspaceLayout(): {
  width: number;
  variant: WorkspaceLayoutVariant;
} {
  const { width } = useWindowDimensions();
  return {
    width,
    variant: layoutVariantFromWidth(width),
  };
}
