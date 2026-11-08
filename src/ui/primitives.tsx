import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { initials } from '../lib/format';
import { colors, radius, shadow, spacing, typography, type TypographyVariant } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/* ───────────────────────────── Text ───────────────────────────── */

interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function Text({ variant = 'body', color = colors.text, align, style, ...rest }: TextProps) {
  return <RNText {...rest} style={[typography[variant], { color, textAlign: align }, style]} />;
}

/* ──────────────────────────── Button ──────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const buttonPalette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.textInverse, border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
};

export function Button({ title, variant = 'primary', icon, loading, fullWidth, disabled, style, ...rest }: ButtonProps) {
  const p = buttonPalette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          minHeight: 48,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.pill,
          backgroundColor: p.bg,
          borderWidth: 1.5,
          borderColor: p.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={p.fg} /> : null}
          <Text variant="bodyStrong" color={p.fg}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/* ───────────────────────────── Card ───────────────────────────── */

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const cardStyle: ViewStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  padding: spacing.lg,
  borderWidth: 1,
  borderColor: colors.border,
  ...shadow.card,
};

export function Card({ children, onPress, style, accessibilityLabel }: CardProps) {
  if (!onPress) return <View style={[cardStyle, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.9 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

/* ───────────────────────────── Chip ───────────────────────────── */

interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: IconName;
  onPress?: () => void;
  tone?: string;
}

export function Chip({ label, selected, icon, onPress, tone = colors.primary }: ChipProps) {
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.textInverse : tone} /> : null}
      <Text variant="caption" color={selected ? colors.textInverse : colors.text} style={{ fontWeight: '600' }}>
        {label}
      </Text>
    </>
  );
  const style: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: selected ? tone : colors.surface,
    borderWidth: 1,
    borderColor: selected ? tone : colors.border,
  };
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [style, { opacity: pressed ? 0.8 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

/* ───────────────────────────── Badge ──────────────────────────── */

export function Badge({ label, fg, bg, icon }: { label: string; fg: string; bg: string; icon?: IconName }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text variant="label" color={fg}>
        {label}
      </Text>
    </View>
  );
}

/* ──────────────────────────── Avatar ──────────────────────────── */

const avatarColors = ['#0F766E', '#C2410C', '#7C3AED', '#2563EB', '#B45309', '#15803D', '#BE185D'];

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = avatarColors[hash % avatarColors.length];
  return (
    <View
      accessibilityLabel={`Foto de ${name}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text color={colors.textInverse} style={{ fontSize: size * 0.38, fontWeight: '700' }}>
        {initials(name)}
      </Text>
    </View>
  );
}

/* ─────────────────────────── Icon dot ─────────────────────────── */

export function IconCircle({ icon, color, size = 40 }: { icon: IconName; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${color}1A`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

export { Ionicons };
