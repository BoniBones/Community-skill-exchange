import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { PaymentPill, Rating } from '../../components/activity';
import { categoryOfSkill, getNeighborhood, skillName } from '../../domain/catalog';
import { formatSessionDate } from '../../lib/dates';
import { formatCredits, formatDuration, formatPayment, paymentModeLabel } from '../../lib/format';
import {
  useActivity,
  useCurrentUserId,
  useProfile,
  useRequestSession,
  useWallet,
} from '../../services/queries';
import { DemoBanner, ErrorState, InfoRow, LoadingState, Screen } from '../../ui/layout';
import { Avatar, Badge, Button, Card, Chip, IconCircle, Text, type IconName } from '../../ui/primitives';
import { colors, radius, spacing } from '../../ui/theme';

const formatLabel = {
  in_person: 'Presencial',
  online: 'Online (videollamada)',
  either: 'Presencial u online',
};

/** Generates 3 upcoming candidate UTC timestamps at 18:00 / 19:00 / 10:00 Buenos Aires time (UTC−3). */
function generateCandidateSlots(): string[] {
  const slots: string[] = [];
  const offsets = [
    { days: 2, hourBA: 18 },
    { days: 4, hourBA: 19 },
    { days: 5, hourBA: 10 },
  ];
  for (const o of offsets) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + o.days);
    d.setUTCHours(o.hourBA + 3, 0, 0, 0);
    slots.push(d.toISOString());
  }
  return slots;
}

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: viewerId } = useCurrentUserId();
  const activity = useActivity(id);
  const instructor = useProfile(activity.data?.instructorId);
  const viewer = useProfile(viewerId);
  const wallet = useWallet(viewerId);
  const requestSession = useRequestSession(viewerId);

  const candidateSlots = useMemo(() => generateCandidateSlots(), []);
  const [selectedSlot, setSelectedSlot] = useState<string>(candidateSlots[0]!);
  const [learnerNote, setLearnerNote] = useState('');
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

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

  const handleBook = async () => {
    setBookingError(null);
    try {
      const created = await requestSession.mutateAsync({
        activityId: a.id,
        startsAt: selectedSlot,
        learnerNote,
      });
      setCreatedSessionId(created.id);
    } catch (e) {
      setBookingError(e instanceof Error ? e.message : 'No se pudo solicitar la sesión.');
    }
  };

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
        {a.payment.mode !== 'money' && wallet.data ? (
          <Text variant="caption" color={colors.credit} style={{ fontWeight: '600' }}>
            Tu saldo disponible: {formatCredits(wallet.data.available)}
          </Text>
        ) : null}
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

      {/* Booking section */}
      {isOwnActivity ? (
        <Button
          title="Gestionar mis actividades"
          variant="secondary"
          icon="settings-outline"
          fullWidth
          onPress={() => router.push('/my-activities')}
        />
      ) : createdSessionId ? (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, gap: spacing.sm }}>
          <Badge label="SESIÓN SOLICITADA (DEMO)" fg={colors.primary} bg="#99F6E4" icon="checkmark-circle-outline" />
          <Text variant="bodyStrong" color={colors.primary}>
            ¡Solicitud enviada para el {formatSessionDate(selectedSlot)}!
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            {a.payment.mode !== 'money'
              ? `Se pusieron ${formatCredits(a.payment.creditAmount ?? 0)} en custodia (Escrow). Podés ver la sesión en la pestaña «Sesiones» y el movimiento en «Créditos».`
              : 'La sesión quedó en estado «SOLICITADA». Podés verla en la pestaña «Sesiones».'}
          </Text>
          <Button
            title="Abrir detalle de la sesión"
            icon="calendar-outline"
            fullWidth
            onPress={() => router.push({ pathname: '/session/[id]', params: { id: createdSessionId } })}
          />
        </Card>
      ) : (
        <Card style={{ gap: spacing.md }}>
          <Text variant="heading">Coordinar fecha y horario</Text>
          <Text variant="caption" color={colors.textMuted}>
            Elegí un turno disponible (hora de Buenos Aires):
          </Text>
          <View style={{ gap: spacing.xs }}>
            {candidateSlots.map((slot) => (
              <Chip
                key={slot}
                label={formatSessionDate(slot)}
                icon="calendar-outline"
                selected={selectedSlot === slot}
                onPress={() => setSelectedSlot(slot)}
              />
            ))}
          </View>

          <View style={{ gap: 4 }}>
            <Text variant="label" color={colors.textMuted}>
              MENSAJE OPCIONAL PARA {inst.displayName.split(' ')[0].toUpperCase()}
            </Text>
            <TextInput
              value={learnerNote}
              onChangeText={setLearnerNote}
              placeholder="Contale tu nivel actual o qué te gustaría practicar…"
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.bg,
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

          {bookingError ? (
            <Text variant="caption" color={colors.danger}>
              {bookingError}
            </Text>
          ) : null}

          <Button
            title={`Solicitar sesión (${formatPayment(a.payment)})`}
            icon="calendar-outline"
            loading={requestSession.isPending}
            fullWidth
            onPress={handleBook}
          />
        </Card>
      )}
    </Screen>
  );
}
