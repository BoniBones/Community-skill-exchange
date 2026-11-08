import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { PaymentPill } from '../components/activity';
import { SKILLS } from '../domain/catalog';
import type { Activity, ActivityFormat, ID, PaymentMode } from '../domain/types';
import { useActivity, useCurrentUserId, useUpsertActivity } from '../services/queries';
import { DemoBanner, LoadingState, Screen, SectionHeader } from '../ui/layout';
import { Badge, Button, Card, Chip, Text } from '../ui/primitives';
import { colors, radius, spacing } from '../ui/theme';

const durations = [45, 60, 90, 120];
const creditPresets = [0.5, 1, 1.5, 2];
const formatOptions: { id: ActivityFormat; label: string }[] = [
  { id: 'in_person', label: 'Presencial' },
  { id: 'online', label: 'Online' },
  { id: 'either', label: 'Presencial u online' },
];

export default function ActivityFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: userId } = useCurrentUserId();
  const existing = useActivity(id);
  const upsert = useUpsertActivity(userId);

  if (id && existing.isLoading) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label="Cargando actividad…" />
      </Screen>
    );
  }

  return (
    <ActivityFormInner
      key={existing.data?.id ?? 'new'}
      initial={existing.data ?? null}
      onSubmit={upsert.mutateAsync}
      isSubmitting={upsert.isPending}
    />
  );
}

function ActivityFormInner({
  initial,
  onSubmit,
  isSubmitting,
}: {
  initial: Activity | null;
  onSubmit: ReturnType<typeof useUpsertActivity>['mutateAsync'];
  isSubmitting: boolean;
}) {
  const [skillId, setSkillId] = useState<ID>(initial?.skillId ?? 's-piano');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [durationMin, setDurationMin] = useState<number>(initial?.durationMin ?? 60);
  const [format, setFormat] = useState<ActivityFormat>(initial?.format ?? 'in_person');
  const [meetingArea, setMeetingArea] = useState(initial?.meetingArea ?? 'Centro cultural de Santo Tomás');
  const [requirements, setRequirements] = useState(initial?.requirements ?? 'Ninguno');
  const [availabilitySummary, setAvailabilitySummary] = useState(
    initial?.availabilitySummary ?? 'Martes y jueves 17–20 h',
  );
  const [status, setStatus] = useState<'published' | 'paused'>(
    initial?.status === 'paused' ? 'paused' : 'published',
  );

  // Payment arrangement state
  const [mode, setMode] = useState<PaymentMode>(initial?.payment.mode ?? 'credits');
  const [creditAmount, setCreditAmount] = useState<number>(initial?.payment.creditAmount ?? 1);
  const [arsInput, setArsInput] = useState<string>(
    initial?.payment.moneyAmountCents ? String(Math.round(initial.payment.moneyAmountCents / 100)) : '2000',
  );
  const [error, setError] = useState<string | null>(null);

  const moneyCents = Math.max(0, Math.round(Number(arsInput.replace(/\D/g, '') || '0') * 100));

  const previewPayment = {
    mode,
    creditAmount: mode !== 'money' ? creditAmount : undefined,
    moneyAmountCents: mode !== 'credits' ? moneyCents : undefined,
    currency: 'ARS' as const,
  };

  const handleSave = async () => {
    setError(null);
    try {
      const { activity } = await onSubmit({
        id: initial?.id,
        skillId,
        title,
        description,
        durationMin,
        format,
        meetingArea,
        requirements,
        availabilitySummary,
        payment: previewPayment,
        status,
      });
      router.replace({ pathname: '/activity/[id]', params: { id: activity.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar la actividad.');
    }
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Badge
          label={initial ? 'EDITAR ACTIVIDAD' : 'NUEVA ACTIVIDAD COMUNITARIA'}
          fg={colors.primary}
          bg={colors.primarySoft}
          icon="easel-outline"
        />
        <Text variant="title">{initial ? 'Editar actividad y modalidad' : 'Publicar una actividad'}</Text>
        <Text variant="caption" color={colors.textMuted}>
          Definí qué enseñás, en qué lugar público o virtual se realiza y cómo querés recibir el intercambio.
        </Text>
      </View>

      {/* Skill & Title */}
      <Card style={{ gap: spacing.md }}>
        <SectionHeader title="1. Habilidad y descripción" subtitle="Elegí la habilidad del catálogo comunitario" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SKILLS.map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              selected={skillId === s.id}
              tone={colors.primary}
              onPress={() => setSkillId(s.id)}
            />
          ))}
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            TÍTULO DE LA ACTIVIDAD
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Guitarra criolla desde cero / Conversación en inglés"
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              minHeight: 46,
              fontSize: 16,
              color: colors.text,
            }}
          />
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            DESCRIPCIÓN
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Contá qué van a practicar en el encuentro y a quién está dirigido…"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              minHeight: 84,
              fontSize: 15,
              color: colors.text,
              textAlignVertical: 'top',
            }}
          />
        </View>
      </Card>

      {/* Flexible Payment Arrangement */}
      <Card style={{ gap: spacing.md }}>
        <SectionHeader
          title="2. Modalidad de intercambio"
          subtitle="Vos decidís cómo recibir el pago. No existe una conversión fija entre créditos y pesos."
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Chip
            label="A. Solo créditos"
            icon="time-outline"
            selected={mode === 'credits'}
            tone={colors.credit}
            onPress={() => setMode('credits')}
          />
          <Chip
            label="B. Solo dinero (ARS)"
            icon="cash-outline"
            selected={mode === 'money'}
            tone={colors.money}
            onPress={() => setMode('money')}
          />
          <Chip
            label="C. Pago mixto"
            icon="options-outline"
            selected={mode === 'mixed'}
            tone={colors.primary}
            onPress={() => setMode('mixed')}
          />
        </View>

        {mode !== 'money' ? (
          <View style={{ gap: spacing.xs }}>
            <Text variant="label" color={colors.textMuted}>
              CANTIDAD DE CRÉDITOS COMUNITARIOS (ESTÁNDAR: 1 H = 1 CRÉDITO)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {creditPresets.map((c) => (
                <Chip
                  key={c}
                  label={`${String(c).replace('.', ',')} ${c === 1 ? 'crédito' : 'créditos'}`}
                  selected={creditAmount === c}
                  tone={colors.credit}
                  onPress={() => setCreditAmount(c)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {mode !== 'credits' ? (
          <View style={{ gap: 4 }}>
            <Text variant="label" color={colors.textMuted}>
              MONTO EN PESOS ARGENTINOS (ARS)
            </Text>
            <TextInput
              value={arsInput}
              onChangeText={(t) => setArsInput(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder="Ej: 8000"
              placeholderTextColor={colors.textMuted}
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
              }}
            />
          </View>
        ) : null}

        <View
          style={{
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            padding: spacing.md,
            gap: spacing.xs,
          }}
        >
          <Text variant="caption" color={colors.textMuted}>
            Vista previa del acuerdo de pago:
          </Text>
          <PaymentPill payment={previewPayment} />
        </View>
      </Card>

      {/* Logistics & Public Meeting Place */}
      <Card style={{ gap: spacing.md }}>
        <SectionHeader
          title="3. Duración, formato y punto de encuentro"
          subtitle="Por seguridad, nunca publiques direcciones particulares"
        />

        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color={colors.textMuted}>
            DURACIÓN POR SESIÓN
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {durations.map((d) => (
              <Chip key={d} label={`${d} min`} selected={durationMin === d} onPress={() => setDurationMin(d)} />
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color={colors.textMuted}>
            FORMATO
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {formatOptions.map((f) => (
              <Chip key={f.id} label={f.label} selected={format === f.id} onPress={() => setFormat(f.id)} />
            ))}
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            PUNTO DE ENCUENTRO PÚBLICO O MODALIDAD
          </Text>
          <TextInput
            value={meetingArea}
            onChangeText={setMeetingArea}
            placeholder="Ej: Plaza de Santo Tomás / Biblioteca de Pilar / Videollamada"
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              minHeight: 46,
              fontSize: 15,
              color: colors.text,
            }}
          />
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            DISPONIBILIDAD PARA ESTA ACTIVIDAD
          </Text>
          <TextInput
            value={availabilitySummary}
            onChangeText={setAvailabilitySummary}
            placeholder="Ej: Martes y jueves 17–20 h"
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              minHeight: 46,
              fontSize: 15,
              color: colors.text,
            }}
          />
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            REQUISITOS PARA EL APRENDIZ
          </Text>
          <TextInput
            value={requirements}
            onChangeText={setRequirements}
            placeholder="Ej: Ninguno / Traer cuaderno / Nivel intermedio"
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              minHeight: 46,
              fontSize: 15,
              color: colors.text,
            }}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color={colors.textMuted}>
            ESTADO DE LA PUBLICACIÓN
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip
              label="Publicada (visible)"
              icon="eye-outline"
              selected={status === 'published'}
              onPress={() => setStatus('published')}
            />
            <Chip
              label="Pausada"
              icon="pause-circle-outline"
              selected={status === 'paused'}
              tone={colors.textMuted}
              onPress={() => setStatus('paused')}
            />
          </View>
        </View>
      </Card>

      {error ? (
        <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.danger }}>
          <Text variant="caption" color={colors.danger} style={{ fontWeight: '600' }}>
            {error}
          </Text>
        </Card>
      ) : null}

      <Button
        title={initial ? 'Guardar cambios en la actividad' : 'Publicar actividad en la comunidad'}
        icon="checkmark-circle-outline"
        loading={isSubmitting}
        fullWidth
        onPress={handleSave}
      />
    </Screen>
  );
}
