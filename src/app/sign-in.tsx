import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Screen } from '../ui/layout';
import { Badge, Button, Text } from '../ui/primitives';
import { colors, radius, spacing } from '../ui/theme';

/**
 * PLACEHOLDER (Stage 2): the real flow is email + 6-digit OTP through Supabase Auth,
 * followed by the 18+ eligibility check and profile onboarding. Nothing here
 * authenticates or sends email yet.
 */
export default function SignIn() {
  const [email, setEmail] = useState('');
  return (
    <Screen edges={['bottom']}>
      <Badge label="PRÓXIMAMENTE · ETAPA 2" fg={colors.info} bg={colors.infoSoft} icon="construct-outline" />
      <Text variant="title">Ingresá con tu email</Text>
      <Text color={colors.textMuted}>
        Te vamos a enviar un código de 6 dígitos. Sin contraseñas. La comunidad es para mayores de 18 años durante el piloto.
      </Text>
      <View style={{ gap: spacing.sm }}>
        <Text variant="caption" color={colors.textMuted}>
          Email
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="tu@email.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            minHeight: 48,
            fontSize: 16,
            color: colors.text,
          }}
        />
      </View>
      <Button title="Enviar código" disabled fullWidth />
      <Text variant="caption" color={colors.textMuted} align="center">
        El inicio de sesión real todavía no está conectado. Mientras tanto podés recorrer la demo.
      </Text>
      <Button title="Volver a la demo" variant="ghost" onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}
