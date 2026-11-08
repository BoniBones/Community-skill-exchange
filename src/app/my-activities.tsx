import { router } from 'expo-router';
import { View } from 'react-native';

import { PaymentPill } from '../components/activity';
import { skillName } from '../domain/catalog';
import { formatDuration } from '../lib/format';
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

      {/* Quick actions */}
      <View style={{ gap: spacing.sm }}>
        <Button
          title="Publicar nueva actividad"
          icon="add-circle-outline"
          fullWidth
          onPress={() => router.push('/activity-form')}
        />
        <Button
          title="Configurar mi disponibilidad horaria"
          variant="secondary"
          icon="calendar-outline"
          fullWidth
          onPress={() => router.push('/availability')}
        />
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
          title={`Mis actividades (${(activities.data ?? []).length})`}
          subtitle="Podés editar el acuerdo de pago, pausar o abrir la vista pública"
        />
        {(activities.data ?? []).map((a) => (
          <Card key={a.id} style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Badge
                label={a.status === 'published' ? 'PUBLICADA' : 'PAUSADA'}
                fg={a.status === 'published' ? colors.money : colors.textMuted}
                bg={a.status === 'published' ? colors.moneySoft : colors.surfaceAlt}
              />
              <Text variant="caption" color={colors.textMuted}>
                {skillName(a.skillId)} · {formatDuration(a.durationMin)}
              </Text>
            </View>
            <View style={{ gap: 2 }}>
              <Text variant="heading">{a.title}</Text>
              <Text variant="caption" color={colors.textMuted}>
                📍 {a.meetingArea} · 🗓️ {a.availabilitySummary}
              </Text>
            </View>
            <PaymentPill payment={a.payment} size="sm" />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                title="Editar"
                variant="secondary"
                icon="create-outline"
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: '/activity-form', params: { id: a.id } })}
              />
              <Button
                title="Vista pública"
                variant="ghost"
                icon="open-outline"
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: '/activity/[id]', params: { id: a.id } })}
              />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
