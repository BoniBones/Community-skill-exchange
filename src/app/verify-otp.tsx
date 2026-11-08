import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useAuth } from '../features/auth/authContext';
import { isDemoData } from '../services/queries';
import { DemoBanner, Screen } from '../ui/layout';
import { Badge, Button, Card, Text } from '../ui/primitives';
import { colors, radius, spacing } from '../ui/theme';

export default function VerifyOtpScreen() {
  const { email, isNewRegistration, verifyOtp } = useAuth();
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
      setError(e instanceof Error ? e.message : 'Código inválido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Text variant="title">Ingresá el código de 6 dígitos</Text>
        <Text color={colors.textMuted}>
          Enviamos un código temporal a <Text variant="bodyStrong">{email}</Text>.
        </Text>
      </View>

      {isDemoData ? (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: '#FDE68A', gap: spacing.xs }}>
          <Badge label="MODO DEMOSTRACIÓN" fg={colors.warning} bg="#FDE68A" icon="flask-outline" />
          <Text variant="caption" color={colors.warning}>
            Como Supabase aún no está conectado, el código de prueba <Text variant="bodyStrong">123456</Text> ya está
            precompletado para que puedas avanzar de inmediato.
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color={colors.textMuted}>
          CÓDIGO DE VERIFICACIÓN
        </Text>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
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
        title={isNewRegistration ? 'Verificar y continuar al onboarding' : 'Verificar e ingresar'}
        icon="checkmark-circle-outline"
        loading={loading}
        disabled={code.length !== 6}
        fullWidth
        onPress={handleVerify}
      />

      {isDemoData && code !== '123456' ? (
        <Button title="Completar código de demo (123456)" variant="ghost" onPress={() => setCode('123456')} />
      ) : null}
    </Screen>
  );
}
