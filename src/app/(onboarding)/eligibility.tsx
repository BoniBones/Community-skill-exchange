import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { isValidBirthDate } from '../../lib/dates';
import { useI18n } from '../../lib/i18n';
import { useCurrentUserId, useSubmitEligibility } from '../../services/queries';
import { DemoBanner, Screen } from '../../ui/layout';
import { Badge, Button, Card, Ionicons, Text } from '../../ui/primitives';
import { radius, spacing, useTheme } from '../../ui/theme';

export default function EligibilityScreen() {
  const { data: userId } = useCurrentUserId();
  const submitEligibility = useSubmitEligibility(userId);
  const { colors } = useTheme();
  const { t } = useI18n();

  const [day, setDay] = useState('14');
  const [month, setMonth] = useState('05');
  const [year, setYear] = useState('1996');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [acceptedSafety, setAcceptedSafety] = useState(true);
  const [feedback, setFeedback] = useState<{ eligible: boolean; message: string } | null>(null);

  const currentYear = new Date().getUTCFullYear();
  const parsedYear = Number(year);
  const isMinorPreview = parsedYear >= currentYear - 17 && parsedYear <= currentYear - 13;

  const handleContinue = async () => {
    setFeedback(null);
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    if (!isValidBirthDate(y, m, d, { minYear: 1920 })) {
      setFeedback({ eligible: false, message: t('eligInvalidDate') });
      return;
    }

    try {
      const res = await submitEligibility.mutateAsync({
        birthDay: d,
        birthMonth: m,
        birthYear: y,
        acceptedSafetyRules: acceptedSafety,
        guardianEmail: guardianEmail.trim() || undefined,
      });

      if (!res.eligible) {
        setFeedback({ eligible: false, message: res.message });
        return;
      }

      router.push('/(onboarding)/neighborhood');
    } catch (err) {
      setFeedback({ eligible: false, message: err instanceof Error ? err.message : t('errorDefault') });
    }
  };

  const dateInputStyle = {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    textAlign: 'center' as const,
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Badge label={t('eligStepBadge')} fg={colors.primary} bg={colors.primarySoft} icon="shield-checkmark-outline" />
        <Text variant="title">{t('eligTitle')}</Text>
        <Text color={colors.textMuted}>{t('eligSubtitle')}</Text>
      </View>

      {/* Birth date inputs */}
      <Card style={{ gap: spacing.md }}>
        <Text variant="label" color={colors.textMuted}>
          {t('eligBirthLabel')}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="caption" color={colors.textMuted}>
              {t('eligDay')}
            </Text>
            <TextInput
              value={day}
              onChangeText={(txt) => setDay(txt.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="DD"
              placeholderTextColor={colors.textMuted}
              style={dateInputStyle}
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="caption" color={colors.textMuted}>
              {t('eligMonth')}
            </Text>
            <TextInput
              value={month}
              onChangeText={(txt) => setMonth(txt.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="MM"
              placeholderTextColor={colors.textMuted}
              style={dateInputStyle}
            />
          </View>
          <View style={{ flex: 1.4, gap: 4 }}>
            <Text variant="caption" color={colors.textMuted}>
              {t('eligYear')}
            </Text>
            <TextInput
              value={year}
              onChangeText={(txt) => setYear(txt.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder={t('eligYearPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={dateInputStyle}
            />
          </View>
        </View>

        {isMinorPreview ? (
          <View
            style={{
              gap: spacing.xs,
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Text variant="bodyStrong" color={colors.warning}>
              {t('eligMinorTitle')}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              {t('eligMinorBody')}
            </Text>
            <TextInput
              value={guardianEmail}
              onChangeText={setGuardianEmail}
              placeholder={t('eligGuardianPlaceholder')}
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                backgroundColor: colors.bg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                minHeight: 44,
                fontSize: 14,
                color: colors.text,
              }}
            />
          </View>
        ) : null}
      </Card>

      {/* Safety rules */}
      <Card style={{ gap: spacing.md }}>
        <Text variant="heading">{t('eligSafetyTitle')}</Text>
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" color={colors.textMuted}>
            1. <Text variant="bodyStrong">{t('eligRule1Title')}</Text> {t('eligRule1Body')}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            2. <Text variant="bodyStrong">{t('eligRule2Title')}</Text> {t('eligRule2Body')}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            3. <Text variant="bodyStrong">{t('eligRule3Title')}</Text> {t('eligRule3Body')}
          </Text>
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acceptedSafety }}
          onPress={() => setAcceptedSafety((v) => !v)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Ionicons
            name={acceptedSafety ? 'checkbox' : 'square-outline'}
            size={24}
            color={acceptedSafety ? colors.primary : colors.textMuted}
          />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {t('eligAcceptLabel')}
          </Text>
        </Pressable>
      </Card>

      {feedback ? (
        <Card
          variant="flat"
          style={{
            backgroundColor: feedback.eligible ? colors.primarySoft : colors.dangerSoft,
            borderColor: feedback.eligible ? colors.primary : colors.danger,
          }}
        >
          <Text variant="caption" color={feedback.eligible ? colors.primary : colors.danger} style={{ fontWeight: '600' }}>
            {feedback.message}
          </Text>
        </Card>
      ) : null}

      <Button
        title={t('eligContinue')}
        icon="arrow-forward-outline"
        loading={submitEligibility.isPending}
        fullWidth
        onPress={handleContinue}
      />
    </Screen>
  );
}
