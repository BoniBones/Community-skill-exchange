import { router } from 'expo-router';
import { View } from 'react-native';

import { DemoBanner, Screen } from '../ui/layout';
import { Button, IconCircle, Text, type IconName } from '../ui/primitives';
import { colors, radius, spacing } from '../ui/theme';

const pillars: { icon: IconName; color: string; title: string; body: string }[] = [
  {
    icon: 'bulb-outline',
    color: colors.primary,
    title: 'Aprendé',
    body: 'Todos tenemos algo para enseñar y algo para aprender. Descubrí lo que saben tus vecinos.',
  },
  {
    icon: 'swap-horizontal',
    color: colors.credit,
    title: 'Intercambiá',
    body: 'Una hora enseñando puede darte un crédito para aprender otra cosa. También podés usar dinero, o combinar ambos.',
  },
  {
    icon: 'people-outline',
    color: colors.accent,
    title: 'Conectá',
    body: 'Conocé gente de Santo Tomás, Pilar y Derqui con intereses como los tuyos.',
  },
];

export default function Welcome() {
  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ gap: spacing.xl, paddingTop: spacing.xl }}>
      <View style={{ gap: spacing.md }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.lg,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 30 }} accessibilityElementsHidden>
            🤝
          </Text>
        </View>
        <Text variant="label" color={colors.accent}>
          COMMUNITY SKILL EXCHANGE
        </Text>
        <Text variant="display">Compartí lo que sabés. Aprendé lo que te apasiona.</Text>
        <Text color={colors.textMuted}>
          Una comunidad para intercambiar conocimientos, habilidades y experiencias, sin que el dinero sea una barrera.
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        {pillars.map((p) => (
          <View
            key={p.title}
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              backgroundColor: colors.surface,
              padding: spacing.lg,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <IconCircle icon={p.icon} color={p.color} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">{p.title}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {p.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.md }}>
        <DemoBanner />
        <Button title="Explorar la comunidad (demo)" icon="compass-outline" fullWidth onPress={() => router.replace('/(tabs)')} />
        <Button title="Crear cuenta o ingresar" variant="secondary" fullWidth onPress={() => router.push('/sign-in')} />
      </View>
    </Screen>
  );
}
