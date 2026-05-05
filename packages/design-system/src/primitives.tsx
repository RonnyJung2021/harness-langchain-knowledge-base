import type { ComponentProps } from "react";
import {
  ActivityIndicator as RNActivityIndicator,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  Text as RNText,
  TextInput as RNTextInput,
  View,
} from "react-native";

export const Box = View;
export const Text = RNText;
export const Pressable = RNPressable;
export const TextInput = RNTextInput;
export const ScrollView = RNScrollView;
export const ActivityIndicator = RNActivityIndicator;

export type BoxProps = ComponentProps<typeof View>;
export type TextProps = ComponentProps<typeof RNText>;
export type PressableProps = ComponentProps<typeof RNPressable>;
export type TextInputProps = ComponentProps<typeof RNTextInput>;
export type ScrollViewProps = ComponentProps<typeof RNScrollView>;
