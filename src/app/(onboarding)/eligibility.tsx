import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useCurrentUserId, useSubmitEligibility } from '../../services/queries';
import { DemoBanner, Screen } from '../../ui/layout';
import { Badge, Button, Card, Ionicons, Text } from '../../ui/primitives';
import { colors, radius, spacing } from '../../ui/theme';

export default function EligibilityScreen() {
  const { data: userId } = useCurrentUserId();
  const submitEligibility = useSubmitEligibility(userId);

  const [day, setDay] = useState('14');
  const [month, setMonth] = useState('05');
  const [year, setYear] = useState('1996');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [acceptedSafety, setAcceptedSafety] = useState(true);
  const [feedback, setFeedback] = useState<{ eligible: boolean; message: string } | null>(null);

  const parsedYear = Number(year);
  const isMinorPreview = parsedYear >= 2009 && parsedYear <= 2013;

  const handleContinue = async () => {
    setFeedback(null);
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    if (!d || !m || !y || d < 1 || d > 31 || m < 1 || m > 12 || y < 1920 || y > 2026) {
      setFeedback({ eligible: false, message: 'Ingresá una fecha de nacimiento válida (DD / MM / AAAA).' });
      return;
    }

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

    router.push('/(onboarding)/profile');
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Badge label="PASO 1 DE 3 · SEGURIDAD Y CONFIANZA" fg={colors.primary} bg={colors.primarySoft} icon="shield-checkmark-outline" />
        <Text variant="title">Elegibilidad y convivencia segura</Text>
        <Text color={colors.textMuted}>
          Tu fecha de nacimiento se guarda en tu perfil privado (nunca es pública) para proteger a la comunidad y
          auditar los requisitos de edad.
        </Text>
      </View>

      {/* Birth date inputs */}
      <Card style={{ gap: spacing.md }}>
        <Text variant="label" color={colors.textMuted}>
          FECHA DE NACIMIENTO (PRIVADA)
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="caption" color={colors.textMuted}>
              Día
            </Text>
            <TextInput
              value={day}
              onChangeText={(t) => setDay(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="DD"
              style={{
                backgroundColor: colors.bg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                minHeight: 46,
                fontSize: 16,
                fontWeight: '600',
                color: colors.text,
                textAlign: 'center',
              }}
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="caption" color={colors.textMuted}>
              Mes
            </Text>
            <TextInput
              value={month}
              onChangeText={(t) => setMonth(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="MM"
              style={{
                backgroundColor: colors.bg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                minHeight: 46,
                fontSize: 16,
                fontWeight: '600',
                color: colors.text,
                textAlign: 'center',
              }}
            />
          </View>
          <View style={{ flex: 1.4, gap: 4 }}>
            <Text variant="caption" color={colors.textMuted}>
              Año
            </Text>
            <TextInput
              value={year}
              onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="AAAA"
              style={{
                backgroundColor: colors.bg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                minHeight: 46,
                fontSize: 16,
                fontWeight: '600',
                color: colors.text,
                textAlign: 'center',
              }}
            />
          </View>
        </View>

        {isMinorPreview ? (
          <View style={{ gap: spacing.xs, backgroundColor: colors.warningSoft, padding: spacing.md, borderRadius: radius.md }}>
            <Text variant="bodyStrong" color={colors.warning}>
              Menores de 18 años: consentimiento parental requerido
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              El piloto inicial está habilitado para mayores de 18 años. Podés dejar el correo de tu madre, padre o
              tutor legal para cuando se habiliten cuentas adolescentes supervisadas:
            </Text>
            <TextInput
              value={guardianEmail}
              onChangeText={setGuardianEmail}
              placeholder="email.tutor@ejemplo.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                backgroundColor: colors.surface,
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
        <Text variant="heading">Acuerdo de seguridad comunitaria</Text>
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" color={colors.textMuted}>
            1. <Text variant="bodyStrong">Puntos de encuentro públicos:</Text> Nunca publiques tu dirección particular;
            los encuentros presenciales se realizan en espacios públicos o comunitarios de Santo Tomás, Pilar o Derqui.
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            2. <Text variant="bodyStrong">Verificación transparente:</Text> Confirmá la asistencia al inicio y cierre
            con el código QR para cuidar la integridad de los créditos comunitarios.
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            3. <Text variant="bodyStrong">Respeto y reciprocidad:</Text> Cualquier conducta inapropiada puede ser
            reportada o bloqueada desde cualquier perfil o sesión.
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
            Tengo 18 años o más y acepto las normas de seguridad comunitaria.
          </Text>
        </Pressable>
      </Card>

      {feedback ? (
        <Card
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
        title="Verificar y continuar al paso 2"
        icon="arrow-forward-outline"
        loading={submitEligibility.isPending}
        fullWidth
        onPress={handleContinue}
      />
    </Screen>
  );
}
