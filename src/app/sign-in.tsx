import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useAuth } from '../features/auth/authContext';
import { DemoBanner, Screen } from '../ui/layout';
import { Badge, Button, Card, Chip, Text } from '../ui/primitives';
import { colors, radius, spacing } from '../ui/theme';

export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: 'register' | 'login' }>();
  const { email: savedEmail, sendOtp } = useAuth();
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
      setError(e instanceof Error ? e.message : 'No pudimos enviar el código.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip
          label="Crear cuenta nueva"
          icon="person-add-outline"
          selected={mode === 'register'}
          onPress={() => setMode('register')}
        />
        <Chip
          label="Ya tengo cuenta"
          icon="log-in-outline"
          selected={mode === 'login'}
          onPress={() => setMode('login')}
        />
      </View>

      <View style={{ gap: 4 }}>
        <Text variant="title">{mode === 'register' ? 'Sumate a la comunidad' : 'Ingresá con tu email'}</Text>
        <Text color={colors.textMuted}>
          {mode === 'register'
            ? 'Te enviamos un código de 6 dígitos por email. Luego verificamos tu elegibilidad (+18) y armamos tu perfil de habilidades.'
            : 'Te enviamos un código de 6 dígitos a tu correo para ingresar sin contraseñas.'}
        </Text>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color={colors.textMuted}>
          CORREO ELECTRÓNICO
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

      <Card style={{ backgroundColor: colors.surfaceAlt, gap: spacing.xs }}>
        <Badge label="SEGURIDAD Y PRIVACIDAD" fg={colors.primary} bg={colors.primarySoft} icon="shield-checkmark-outline" />
        <Text variant="caption" color={colors.textMuted}>
          • Tu correo y teléfono nunca son públicos.{'\n'}• El piloto inicial está habilitado para mayores de 18 años.
          {'\n'}• Los créditos iniciales comienzan en 0 y recibís el incentivo al publicar tu primera actividad.
        </Text>
      </Card>

      <Button
        title="Enviar código de 6 dígitos"
        icon="paper-plane-outline"
        loading={loading}
        fullWidth
        onPress={handleSubmit}
      />
    </Screen>
  );
}
