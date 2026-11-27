import { Stack } from 'expo-router';

import { useI18n } from '../../lib/i18n';
import { useTheme } from '../../ui/theme';

export default function OnboardingLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="eligibility" options={{ title: t('navOnboardStep1') }} />
      <Stack.Screen name="neighborhood" options={{ title: t('navOnboardStep2') }} />
      <Stack.Screen name="profile" options={{ title: t('navOnboardStep3') }} />
      <Stack.Screen name="skills" options={{ title: t('navOnboardStep4') }} />
    </Stack>
  );
}
