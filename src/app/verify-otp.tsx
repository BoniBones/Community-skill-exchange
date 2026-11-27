import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useAuth } from '../features/auth/authContext';
import { useI18n } from '../lib/i18n';
import { isDemoData } from '../services/queries';
import { DemoBanner, Screen } from '../ui/layout';
import { Badge, Button, Card, Text } from '../ui/primitives';
import { radius, spacing, useTheme } from '../ui/theme';

export default function VerifyOtpScreen() {
  const { email, isNewRegistration, verifyOtp } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();

  const [code, setCode] = useState(isDemoData ? '123456' : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setError(null);
    setLoading(true);
    try {
      const { nextRoute } = await verifyOtp(code);
      router.replace(nextRoute);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('otpErrFallback'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Text variant="title">{t('otpTitle')}</Text>
        <Text color={colors.textMuted}>
          {t('otpSubtitlePrefix')} <Text variant="bodyStrong">{email}</Text>.
        </Text>
      </View>

      {isDemoData ? (
        <Card variant="flat" style={{ backgroundColor: colors.warningSoft, borderColor: colors.warningBorder, gap: spacing.xs }}>
          <Badge label={t('otpDemoBadge')} fg={colors.warning} bg={colors.surface} icon="flask-outline" />
          <Text variant="caption" color={colors.warning}>
            {t('otpDemoBody')}
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color={colors.textMuted}>
          {t('otpCodeLabel')}
        </Text>
        <TextInput
          value={code}
          onChangeText={(txt) => setCode(txt.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={6}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            minHeight: 54,
            fontSize: 22,
            fontWeight: '700',
            letterSpacing: 6,
            color: colors.text,
            textAlign: 'center',
          }}
        />
        {error ? (
          <Text variant="caption" color={colors.danger}>
            {error}
          </Text>
        ) : null}
      </View>

      <Button
        title={isNewRegistration ? t('otpVerifyContinue') : t('otpVerifyEnter')}
        icon="checkmark-circle-outline"
        loading={loading}
        disabled={code.length !== 6}
        fullWidth
        onPress={handleVerify}
      />

      {isDemoData && code !== '123456' ? (
        <Button title={t('otpFillDemo')} variant="ghost" onPress={() => setCode('123456')} />
      ) : null}
    </Screen>
  );
}
