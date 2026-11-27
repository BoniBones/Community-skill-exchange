import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useAuth } from '../features/auth/authContext';
import { useI18n } from '../lib/i18n';
import { DemoBanner, Screen } from '../ui/layout';
import { Badge, Button, Card, Chip, Text } from '../ui/primitives';
import { radius, spacing, useTheme } from '../ui/theme';

export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: 'register' | 'login' }>();
  const { email: savedEmail, sendOtp } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();

  const [mode, setMode] = useState<'register' | 'login'>(params.mode === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState(savedEmail || 'sofia.romero@comunidad.ar');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await sendOtp(email, mode === 'register');
      router.push('/verify-otp');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('signInErrFallback'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Chip
          label={t('signInTabRegister')}
          icon="person-add-outline"
          selected={mode === 'register'}
          onPress={() => setMode('register')}
        />
        <Chip
          label={t('signInTabLogin')}
          icon="log-in-outline"
          selected={mode === 'login'}
          onPress={() => setMode('login')}
        />
      </View>

      <View style={{ gap: 4 }}>
        <Text variant="title">{mode === 'register' ? t('signInTitleRegister') : t('signInTitleLogin')}</Text>
        <Text color={colors.textMuted}>
          {mode === 'register' ? t('signInSubtitleRegister') : t('signInSubtitleLogin')}
        </Text>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color={colors.textMuted}>
          {t('signInEmailLabel')}
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('signInEmailPlaceholder')}
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            minHeight: 48,
            fontSize: 16,
            color: colors.text,
          }}
        />
        {error ? (
          <Text variant="caption" color={colors.danger}>
            {error}
          </Text>
        ) : null}
      </View>

      <Card variant="tinted" style={{ gap: spacing.xs }}>
        <Badge label={t('signInSafetyBadge')} fg={colors.primary} bg={colors.primarySoft} icon="shield-checkmark-outline" />
        <Text variant="caption" color={colors.textMuted}>
          {t('signInSafetyBullets')}
        </Text>
      </Card>

      <Button
        title={t('signInSendCode')}
        icon="paper-plane-outline"
        loading={loading}
        fullWidth
        onPress={handleSubmit}
      />
    </Screen>
  );
}
