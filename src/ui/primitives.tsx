import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
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
import { useI18n } from '../lib/i18n';
import { getContrastTextColor, radius, spacing, typography, useTheme, type TypographyVariant } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/* ───────────────────────────── Text ───────────────────────────── */

interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function Text({ variant = 'body', color, align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[typography[variant], { color: color ?? colors.text, textAlign: align }, style]}
    />
  );
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

export function Button({ title, variant = 'primary', icon, loading, fullWidth, disabled, style, ...rest }: ButtonProps) {
  const { colors } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
  };

  const p = palette[variant];
  const isDisabled = disabled || loading;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }], alignSelf: fullWidth ? 'stretch' : 'auto' }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
        disabled={isDisabled}
        onPressIn={(e) => {
          if (!isDisabled) animateTo(0.985);
          rest.onPressIn?.(e);
        }}
        onPressOut={(e) => {
          animateTo(1);
          rest.onPressOut?.(e);
        }}
        style={({ pressed }) => ({
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
          opacity: isDisabled ? 0.5 : pressed ? 0.88 : 1,
        })}
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
    </Animated.View>
  );
}

/* ───────────────────────────── Card ───────────────────────────── */

export type CardVariant = 'elevated' | 'flat' | 'tinted';

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Card({ children, variant = 'elevated', onPress, style, accessibilityLabel }: CardProps) {
  const { colors, shadow } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));

  const baseStyle: ViewStyle = {
    backgroundColor: variant === 'tinted' ? colors.surfaceAlt : colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...(variant === 'elevated' ? shadow : {}),
  };

  if (!onPress) return <View style={[baseStyle, style]}>{children}</View>;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onPressIn={() => animateTo(0.985)}
        onPressOut={() => animateTo(1)}
        style={({ pressed }) => [baseStyle, { opacity: pressed ? 0.92 : 1 }, style]}
      >
        {children}
      </Pressable>
    </Animated.View>
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

export function Chip({ label, selected, icon, onPress, tone }: ChipProps) {
  const { colors } = useTheme();
  const resolvedTone = tone ?? colors.primary;
  const selectedFg = resolvedTone === colors.primary ? colors.onPrimary : getContrastTextColor(resolvedTone);

  const content = (
    <>
      {icon ? <Ionicons name={icon} size={14} color={selected ? selectedFg : resolvedTone} /> : null}
      <Text variant="caption" color={selected ? selectedFg : colors.text} style={{ fontWeight: '600' }}>
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
    backgroundColor: selected ? resolvedTone : colors.surface,
    borderWidth: 1,
    borderColor: selected ? resolvedTone : colors.border,
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

export function Avatar({ name, uri, size = 44 }: { name: string; uri?: string; size?: number }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [failedUri, setFailedUri] = useState<string | null>(null);

  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = avatarColors[hash % avatarColors.length];
  const label = t('avatarPhotoA11y', { name });

  if (uri && failedUri !== uri) {
    return (
      <Image
        source={{ uri }}
        resizeMode="cover"
        accessibilityLabel={label}
        onError={() => setFailedUri(uri)}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceAlt,
        }}
      />
    );
  }

  return (
    <View
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text color={getContrastTextColor(bg)} style={{ fontSize: size * 0.38, fontWeight: '700' }}>
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
