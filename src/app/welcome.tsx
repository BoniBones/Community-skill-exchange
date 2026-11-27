import { router } from 'expo-router';
import { View } from 'react-native';

import { useAuth } from '../features/auth/authContext';
import { useI18n } from '../lib/i18n';
import { DemoBanner, Screen } from '../ui/layout';
import { Button, Card, IconCircle, Ionicons, Text, type IconName } from '../ui/primitives';
import { FadeInView, radius, spacing, useTheme } from '../ui/theme';

export default function Welcome() {
  const { resetToNewOnboarding } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();

  const pillars: { icon: IconName; color: string; title: string; body: string }[] = [
    {
      icon: 'bulb-outline',
      color: colors.primary,
      title: t('welcomePillarLearnTitle'),
      body: t('welcomePillarLearnBody'),
    },
    {
      icon: 'swap-horizontal',
      color: colors.credit,
      title: t('welcomePillarExchangeTitle'),
      body: t('welcomePillarExchangeBody'),
    },
    {
      icon: 'people-outline',
      color: colors.accent,
      title: t('welcomePillarConnectTitle'),
      body: t('welcomePillarConnectBody'),
    },
  ];

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ gap: spacing.xl, paddingTop: spacing.xl }}>
      <FadeInView style={{ gap: spacing.md }}>
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: radius.lg,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="people" size={30} color={colors.onPrimary} />
        </View>
        <Text variant="label" color={colors.accent}>
          {t('welcomeBrand')}
        </Text>
        <Text variant="display">{t('welcomeHeroTitle')}</Text>
        <Text color={colors.textMuted}>{t('welcomeHeroSubtitle')}</Text>
      </FadeInView>

      <FadeInView delay={80} style={{ gap: spacing.md }}>
        {pillars.map((p) => (
          <Card key={p.title} variant="flat" style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <IconCircle icon={p.icon} color={p.color} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">{p.title}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {p.body}
              </Text>
            </View>
          </Card>
        ))}
      </FadeInView>

      <FadeInView delay={140} style={{ gap: spacing.sm }}>
        <DemoBanner />
        <Button
          title={t('welcomeCreateAccount')}
          icon="person-add-outline"
          fullWidth
          onPress={() => {
            resetToNewOnboarding();
            router.push({ pathname: '/sign-in', params: { mode: 'register' } });
          }}
        />
        <Button
          title={t('welcomeAlreadyAccount')}
          variant="secondary"
          icon="mail-outline"
          fullWidth
          onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'login' } })}
        />
        <Button
          title={t('welcomeExploreDemo')}
          variant="ghost"
          icon="compass-outline"
          fullWidth
          onPress={() => router.replace('/(tabs)')}
        />
      </FadeInView>
    </Screen>
  );
}
