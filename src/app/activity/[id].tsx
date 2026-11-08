import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { PaymentPill, Rating } from '../../components/activity';
import { categoryOfSkill, getNeighborhood, skillName } from '../../domain/catalog';
import { formatDuration, formatPayment, paymentModeLabel } from '../../lib/format';
import { useActivity, useCurrentUserId, useProfile } from '../../services/queries';
import { DemoBanner, ErrorState, InfoRow, LoadingState, Screen } from '../../ui/layout';
import { Avatar, Badge, Button, Card, IconCircle, Text, type IconName } from '../../ui/primitives';
import { colors, spacing } from '../../ui/theme';

const formatLabel = {
  in_person: 'Presencial',
  online: 'Online (videollamada)',
  either: 'Presencial u online',
};

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: viewerId } = useCurrentUserId();
  const activity = useActivity(id);
  const instructor = useProfile(activity.data?.instructorId);
  const viewer = useProfile(viewerId);
  const [requestedDemo, setRequestedDemo] = useState(false);

  if (activity.isLoading || instructor.isLoading) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label="Cargando actividad…" />
      </Screen>
    );
  }

  if (!activity.data || !instructor.data) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState message="No encontramos esta actividad." onRetry={() => activity.refetch()} />
      </Screen>
    );
  }

  const a = activity.data;
  const inst = instructor.data;
  const category = categoryOfSkill(a.skillId);
  const isOwnActivity = a.instructorId === viewerId;

  // Check reciprocal match between viewer and instructor
  const viewerOffers = new Set((viewer.data?.skills ?? []).filter((s) => s.kind === 'offers').map((s) => s.skillId));
  const reciprocalSkill = inst.skills.find((s) => s.kind === 'wants' && viewerOffers.has(s.skillId));

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      {/* Title & category */}
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {category ? <IconCircle icon={category.icon as IconName} color={category.color} size={36} /> : null}
          <Badge
            label={(category?.name ?? 'Actividad').toUpperCase()}
            fg={category?.color ?? colors.primary}
            bg={colors.surfaceAlt}
          />
        </View>
        <Text variant="display">{a.title}</Text>
        <Text variant="caption" color={colors.textMuted}>
          Habilidad: {skillName(a.skillId)} · Duración: {formatDuration(a.durationMin)}
        </Text>
      </View>

      {/* Reciprocal callout */}
      {!isOwnActivity && reciprocalSkill ? (
        <Card style={{ backgroundColor: colors.accentSoft, borderColor: '#FED7AA', gap: spacing.xs }}>
          <Badge label="COINCIDENCIA RECÍPROCA" fg={colors.accent} bg="#FED7AA" icon="swap-horizontal" />
          <Text variant="bodyStrong" color={colors.accent}>
            {inst.displayName.split(' ')[0]} quiere aprender {skillName(reciprocalSkill.skillId)}, que vos enseñás.
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            Pueden intercambiar directamente o usar tus créditos acumulados.
          </Text>
        </Card>
      ) : null}

      {/* Payment arrangement card */}
      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="label" color={colors.textMuted}>
            MODALIDAD ELEGIDA POR EL INSTRUCTOR
          </Text>
          <Badge label={paymentModeLabel[a.payment.mode].toUpperCase()} fg={colors.primary} bg={colors.primarySoft} />
        </View>
        <PaymentPill payment={a.payment} />
        <Text variant="caption" color={colors.textMuted}>
          {a.payment.mode === 'credits'
            ? 'Se abona exclusivamente con créditos comunitarios (en custodia al reservar, se liberan al verificar el QR).'
            : a.payment.mode === 'money'
              ? 'El instructor ofrece esta actividad por un pago monetario acordado directamente entre las partes.'
              : 'Combina créditos comunitarios (en custodia) y un aporte en dinero acordado con el instructor.'}
        </Text>
      </Card>

      {/* Description & logistics */}
      <Card style={{ gap: spacing.md }}>
        <Text variant="heading">Sobre la actividad</Text>
        <Text color={colors.text}>{a.description}</Text>
        <InfoRow icon="time-outline" label="Duración por encuentro" value={formatDuration(a.durationMin)} />
        <InfoRow icon="calendar-outline" label="Disponibilidad habitual" value={a.availabilitySummary} />
        <InfoRow icon="videocam-outline" label="Formato" value={formatLabel[a.format]} />
        <InfoRow
          icon="location-outline"
          label="Punto de encuentro (nunca dirección privada)"
          value={a.meetingArea}
        />
        <InfoRow icon="checkmark-circle-outline" label="Requisitos" value={a.requirements} />
      </Card>

      {/* Instructor card */}
      <Card
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: inst.id } })}
        accessibilityLabel={`Ver perfil de ${inst.displayName}`}
        style={{ gap: spacing.md }}
      >
        <Text variant="label" color={colors.textMuted}>
          QUIÉN ENSEÑA
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={inst.displayName} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading">{inst.displayName}</Text>
            <Text variant="caption" color={colors.textMuted}>
              {getNeighborhood(inst.neighborhoodId)?.name ?? 'Comunidad'} · {inst.completedSessions} sesiones
            </Text>
            <Rating avg={inst.ratingAvg} count={inst.ratingCount} />
          </View>
        </View>
        <Text variant="caption" color={colors.textMuted} numberOfLines={2}>
          {inst.bio}
        </Text>
        <Text variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
          Ver perfil completo y reseñas →
        </Text>
      </Card>

      {/* Action */}
      {isOwnActivity ? (
        <Button
          title="Gestionar mis actividades"
          variant="secondary"
          icon="settings-outline"
          fullWidth
          onPress={() => router.push('/my-activities')}
        />
      ) : requestedDemo ? (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, gap: spacing.xs }}>
          <Badge label="SIMULACIÓN DE DEMO" fg={colors.primary} bg="#99F6E4" icon="flask-outline" />
          <Text variant="bodyStrong" color={colors.primary}>
            Vista previa de solicitud: {formatPayment(a.payment)}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            En la Etapa 3 (Supabase) esta acción creará la sesión en estado «requested» y pondrá los créditos en
            custodia de forma atómica. Ninguna reserva real fue creada ahora.
          </Text>
        </Card>
      ) : (
        <Button
          title={`Solicitar sesión (${formatPayment(a.payment)})`}
          icon="calendar-outline"
          fullWidth
          onPress={() => setRequestedDemo(true)}
        />
      )}
    </Screen>
  );
}
