import { View } from 'react-native';

import { ActivityCard } from '../components/activity';
import {
  useCurrentUserId,
  useInstructorActivities,
  useProfile,
} from '../services/queries';
import { DemoBanner, LoadingState, Screen, SectionHeader } from '../ui/layout';
import { Badge, Button, Card, Text } from '../ui/primitives';
import { colors, spacing } from '../ui/theme';

export default function MyActivitiesScreen() {
  const { data: userId } = useCurrentUserId();
  const me = useProfile(userId);
  const activities = useInstructorActivities(userId);

  if (activities.isLoading || me.isLoading) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label="Cargando tus actividades…" />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Text variant="title">Gestión de mis actividades</Text>
        <Text variant="caption" color={colors.textMuted}>
          Vos elegís cómo recibir el intercambio en cada actividad: solo créditos, solo dinero o pago mixto.
        </Text>
      </View>

      {/* Payment model explanation */}
      <Card style={{ gap: spacing.sm, backgroundColor: colors.surfaceAlt }}>
        <Badge label="MODELO ECONÓMICO FLEXIBLE" fg={colors.primary} bg={colors.primarySoft} icon="options-outline" />
        <Text variant="bodyStrong">Tres modalidades posibles por actividad</Text>
        <Text variant="caption" color={colors.textMuted}>
          • Solo créditos: p. ej. 1 hora de guitarra = 1 crédito comunitario.{'\n'}• Solo dinero: p. ej. 1 hora de
          fotografía = $ 8.000 ARS.{'\n'}• Pago mixto: p. ej. 1 hora de piano = 1 crédito + $ 2.000 ARS.{'\n'}La
          plataforma no impone un valor fijo universal en dinero para 1 crédito.
        </Text>
      </Card>

      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title="Publicadas actualmente"
          subtitle="Tocá una actividad para inspeccionar su vista pública"
        />
        {(activities.data ?? []).map((a) => (
          <ActivityCard key={a.id} activity={a} instructor={me.data} />
        ))}
      </View>

      <Card style={{ gap: spacing.sm }}>
        <Badge label="PRÓXIMAMENTE · ETAPA 3" fg={colors.info} bg={colors.infoSoft} icon="construct-outline" />
        <Text variant="bodyStrong">Publicar o editar actividades</Text>
        <Text variant="caption" color={colors.textMuted}>
          El formulario de creación y edición conectará directamente con las tablas «activities» y
          «payment_arrangements» en Supabase durante la Etapa 3.
        </Text>
        <Button title="Nueva actividad (disponible en Etapa 3)" icon="add-circle-outline" disabled fullWidth />
      </Card>
    </Screen>
  );
}
