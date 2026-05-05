import { useState } from "react";
import { ActivityIndicator, Box, Pressable, ScrollView, Text } from "./primitives.js";
import { ThemeProvider, useTheme } from "./ThemeProvider.js";

function SmokeInner() {
  const { tokens, colorScheme } = useTheme();
  const [pressedDemo, setPressedDemo] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const n = tokens.neutral;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.colors.background }}
      contentContainerStyle={{
        padding: tokens.space[4],
        paddingBottom: tokens.space[10],
      }}
    >
      <Text
        style={{
          fontSize: tokens.fontSize.title,
          fontWeight: "700",
          color: tokens.colors.text,
          marginBottom: tokens.space[2],
        }}
      >
        DesignSystemSmoke
      </Text>
      <Text style={{ fontSize: tokens.fontSize.secondary, color: tokens.colors.textMuted, marginBottom: tokens.space[4] }}>
        scheme={colorScheme} · 字号 body 起 ≥14
      </Text>

      <Text style={{ fontSize: tokens.fontSize.body, fontWeight: "600", color: tokens.colors.text, marginBottom: tokens.space[2] }}>
        Neutral 阶梯
      </Text>
      <Box style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: tokens.space[4] }}>
        {([50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const).map((step) => (
          <Box
            key={step}
            style={{
              width: "18%",
              minWidth: 48,
              aspectRatio: 1,
              margin: tokens.space[1],
              borderRadius: tokens.radius.sm,
              backgroundColor: n[step],
              borderWidth: 1,
              borderColor: tokens.colors.border,
            }}
          />
        ))}
      </Box>

      <Text style={{ fontSize: tokens.fontSize.body, fontWeight: "600", color: tokens.colors.text, marginBottom: tokens.space[2] }}>
        Spacing（4px 网格）
      </Text>
      <Box style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: tokens.space[4] }}>
        {([1, 2, 3, 4, 6, 8] as const).map((k) => (
          <Box
            key={k}
            style={{
              width: tokens.space[k],
              height: 24,
              marginRight: tokens.space[2],
              backgroundColor: tokens.colors.primary,
              borderRadius: tokens.radius.sm,
            }}
          />
        ))}
      </Box>

      <Text style={{ fontSize: tokens.fontSize.body, fontWeight: "600", color: tokens.colors.text, marginBottom: tokens.space[2] }}>
        语义色样块
      </Text>
      <Box style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: tokens.space[4] }}>
        <Box
          style={{
            paddingHorizontal: tokens.space[3],
            paddingVertical: tokens.space[2],
            borderRadius: tokens.radius.md,
            backgroundColor: tokens.colors.primary,
            marginRight: tokens.space[2],
            marginBottom: tokens.space[2],
          }}
        >
          <Text style={{ color: tokens.colors.primaryContrast, fontSize: tokens.fontSize.body }}>primary</Text>
        </Box>
        <Box
          style={{
            paddingHorizontal: tokens.space[3],
            paddingVertical: tokens.space[2],
            borderRadius: tokens.radius.md,
            backgroundColor: tokens.colors.successBg,
            borderWidth: 1,
            borderColor: tokens.colors.successBorder,
            marginRight: tokens.space[2],
            marginBottom: tokens.space[2],
          }}
        >
          <Text style={{ color: tokens.colors.successText, fontSize: tokens.fontSize.body }}>success</Text>
        </Box>
        <Box
          style={{
            paddingHorizontal: tokens.space[3],
            paddingVertical: tokens.space[2],
            borderRadius: tokens.radius.md,
            backgroundColor: tokens.colors.errorBg,
            borderWidth: 1,
            borderColor: tokens.colors.errorBorder,
            marginBottom: tokens.space[2],
          }}
        >
          <Text style={{ color: tokens.colors.errorText, fontSize: tokens.fontSize.body }}>error</Text>
        </Box>
      </Box>

      <Text style={{ fontSize: tokens.fontSize.body, fontWeight: "600", color: tokens.colors.text, marginBottom: tokens.space[2] }}>
        按下反馈（Pressable）
      </Text>
      <Pressable
        onPressIn={() => {
          setPressedDemo("primary-in");
        }}
        onPressOut={() => {
          setPressedDemo(null);
        }}
        onPress={() => {
          setSpinning((s) => !s);
        }}
        style={({ pressed }) => ({
          minHeight: tokens.touchTargetMin,
          paddingHorizontal: tokens.space[4],
          justifyContent: "center",
          alignItems: "center",
          alignSelf: "flex-start",
          borderRadius: tokens.radius.md,
          backgroundColor: pressed ? tokens.colors.primaryPressed : tokens.colors.primary,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <Text style={{ color: tokens.colors.primaryContrast, fontSize: tokens.fontSize.bodyLarge, fontWeight: "700" }}>
          点按切换 ActivityIndicator
        </Text>
      </Pressable>
      <Text style={{ fontSize: tokens.fontSize.caption, color: tokens.colors.textMuted, marginTop: tokens.space[2] }}>
        pressed: {pressedDemo ?? "—"}
      </Text>

      <Box style={{ marginTop: tokens.space[4], flexDirection: "row", alignItems: "center" }}>
        {spinning ? <ActivityIndicator color={tokens.colors.primary} /> : null}
        <Text style={{ marginLeft: tokens.space[2], fontSize: tokens.fontSize.secondary, color: tokens.colors.textMuted }}>
          {spinning ? "loading…" : "idle"}
        </Text>
      </Box>

      <Box
        style={{
          marginTop: tokens.space[6],
          padding: tokens.space[3],
          borderRadius: tokens.radius.lg,
          backgroundColor: tokens.colors.surface,
          borderWidth: 1,
          borderColor: tokens.colors.border,
        }}
      >
        <Text style={{ fontSize: tokens.fontSize.body, color: tokens.colors.text }}>
          body {tokens.fontSize.body}px · bodyLarge {tokens.fontSize.bodyLarge}px · caption {tokens.fontSize.caption}px（短文案）
        </Text>
      </Box>
    </ScrollView>
  );
}

/** 验收屏：内含 ThemeProvider，可直接挂载于 App 根。 */
export function DesignSystemSmoke(props: { colorScheme?: "light" | "dark" }) {
  return (
    <ThemeProvider colorScheme={props.colorScheme ?? "light"}>
      <SmokeInner />
    </ThemeProvider>
  );
}
