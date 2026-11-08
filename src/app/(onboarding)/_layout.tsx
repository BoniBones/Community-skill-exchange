import { Stack } from 'expo-router';

import { colors } from '../../ui/theme';

export default function OnboardingLayout() {
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
      <Stack.Screen name="eligibility" options={{ title: 'Paso 1 de 3 · Elegibilidad' }} />
      <Stack.Screen name="profile" options={{ title: 'Paso 2 de 3 · Tu perfil' }} />
      <Stack.Screen name="skills" options={{ title: 'Paso 3 de 3 · Tus habilidades' }} />
    </Stack>
  );
}
