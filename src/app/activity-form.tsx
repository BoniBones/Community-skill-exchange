import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { PaymentPill } from '../components/activity';
import { SkillCatalogPicker } from '../components/SkillCatalogPicker';
import { SKILLS } from '../domain/catalog';
import type { Activity, ActivityFormat, ID } from '../domain/types';
import { formatCredits, formatDuration } from '../lib/format';
import { useI18n } from '../lib/i18n';
import {
  useActivity,
  useCreateCustomSkill,
  useCurrentUserId,
  useSkills,
  useUpsertActivity,
} from '../services/queries';
import { DemoBanner, LoadingState, Screen, SectionHeader } from '../ui/layout';
import { Badge, Button, Card, Chip, Text } from '../ui/primitives';
import { radius, spacing, useTheme } from '../ui/theme';

const durations = [45, 60, 90, 120];
const creditPresets = [1, 2, 3, 4];

export default function ActivityFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: userId } = useCurrentUserId();
  const existing = useActivity(id);
  const skillsQuery = useSkills();
  const createCustomSkill = useCreateCustomSkill(userId);
  const upsert = useUpsertActivity(userId);
  const { t } = useI18n();

  if (id && existing.isLoading) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label={t('actFormLoading')} />
      </Screen>
    );
  }

  return (
    <ActivityFormInner
      key={existing.data?.id ?? 'new'}
      initial={existing.data ?? null}
      catalogSkills={skillsQuery.data ?? SKILLS}
      onCreateCustomSkill={(input) => createCustomSkill.mutateAsync(input)}
      isCreatingCustom={createCustomSkill.isPending}
      onSubmit={upsert.mutateAsync}
      isSubmitting={upsert.isPending}
    />
  );
}

function ActivityFormInner({
  initial,
  catalogSkills,
  onCreateCustomSkill,
  isCreatingCustom,
  onSubmit,
  isSubmitting,
}: {
  initial: Activity | null;
  catalogSkills: typeof SKILLS;
  onCreateCustomSkill: ReturnType<typeof useCreateCustomSkill>['mutateAsync'];
  isCreatingCustom: boolean;
  onSubmit: ReturnType<typeof useUpsertActivity>['mutateAsync'];
  isSubmitting: boolean;
}) {
  const { colors } = useTheme();
  const { locale, t } = useI18n();

  const [skillId, setSkillId] = useState<ID>(initial?.skillId ?? 's-piano');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [durationMin, setDurationMin] = useState<number>(initial?.durationMin ?? 60);
  const [format, setFormat] = useState<ActivityFormat>(initial?.format ?? 'in_person');
  const [meetingArea, setMeetingArea] = useState(initial?.meetingArea ?? t('actFormDefaultArea'));
  const [requirements, setRequirements] = useState(initial?.requirements ?? t('commonNone'));
  const [availabilitySummary, setAvailabilitySummary] = useState(
    initial?.availabilitySummary ?? t('actFormDefaultAvail'),
  );
  const [status, setStatus] = useState<'published' | 'paused'>(
    initial?.status === 'paused' ? 'paused' : 'published',
  );

  // Integer time-credit state (1h = 1 credit, non-cashable)
  const [creditAmount, setCreditAmount] = useState<number>(Math.max(1, Math.round(initial?.creditAmount ?? 1)));
  const [error, setError] = useState<string | null>(null);

  const formatOptions: { id: ActivityFormat; label: string }[] = [
    { id: 'in_person', label: t('exploreInPerson') },
    { id: 'online', label: t('exploreOnline') },
    { id: 'either', label: t('exploreEither') },
  ];

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
        creditAmount,
        status,
      });
      router.replace({ pathname: '/activity/[id]', params: { id: activity.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('actFormSaveErr'));
    }
  };

  const inputStyle = {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    fontSize: 15,
    color: colors.text,
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Badge
          label={initial ? t('actFormEditBadge') : t('actFormNewBadge')}
          fg={colors.primary}
          bg={colors.primarySoft}
          icon="easel-outline"
        />
        <Text variant="title">{initial ? t('actFormEditTitle') : t('actFormNewTitle')}</Text>
        <Text variant="caption" color={colors.textMuted}>
          {t('actFormSubtitle')}
        </Text>
      </View>

      {/* Skill & Title */}
      <Card style={{ gap: spacing.md }}>
        <SectionHeader title={t('actFormSec1Title')} subtitle={t('actFormSec1Subtitle')} />
        <SkillCatalogPicker
          mode="single"
          skills={catalogSkills}
          selectedIds={[skillId]}
          onChange={(next) => {
            if (next[0]) setSkillId(next[0]);
          }}
          tone={colors.primary}
          allowCustomCreate
          isCreatingCustom={isCreatingCustom}
          onCreateCustomSkill={onCreateCustomSkill}
        />
        {catalogSkills.find((s) => s.id === skillId)?.description ? (
          <Text variant="caption" color={colors.textMuted}>
            {t('actFormSelectedSkillDesc', {
              desc: catalogSkills.find((s) => s.id === skillId)!.description!,
            })}
          </Text>
        ) : null}

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            {t('actFormTitleLabel')}
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('actFormTitlePlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={{ ...inputStyle, fontSize: 16 }}
          />
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            {t('actFormDescLabel')}
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('actFormDescPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            style={{
              ...inputStyle,
              paddingVertical: spacing.sm,
              minHeight: 84,
              textAlignVertical: 'top',
            }}
          />
        </View>
      </Card>

      {/* Integer Time-Credit Cost (flattened preview row) */}
      <Card style={{ gap: spacing.md }}>
        <SectionHeader title={t('actFormSec2Title')} subtitle={t('actFormSec2Subtitle')} />

        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color={colors.textMuted}>
            {t('actFormCreditsLabel')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {creditPresets.map((c) => (
              <Chip
                key={c}
                label={formatCredits(c, locale)}
                selected={creditAmount === c}
                tone={colors.credit}
                onPress={() => setCreditAmount(c)}
              />
            ))}
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text variant="caption" color={colors.textMuted}>
            {t('actFormCreditsPreview')}
          </Text>
          <PaymentPill creditAmount={creditAmount} />
        </View>
      </Card>

      {/* Logistics & Public Meeting Place */}
      <Card style={{ gap: spacing.md }}>
        <SectionHeader title={t('actFormSec3Title')} subtitle={t('actFormSec3Subtitle')} />

        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color={colors.textMuted}>
            {t('actFormDurationLabel')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {durations.map((d) => (
              <Chip
                key={d}
                label={formatDuration(d, locale)}
                selected={durationMin === d}
                onPress={() => setDurationMin(d)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color={colors.textMuted}>
            {t('actFormFormatLabel')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {formatOptions.map((f) => (
              <Chip key={f.id} label={f.label} selected={format === f.id} onPress={() => setFormat(f.id)} />
            ))}
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            {t('actFormMeetingLabel')}
          </Text>
          <TextInput
            value={meetingArea}
            onChangeText={setMeetingArea}
            placeholder={t('actFormMeetingPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
          />
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            {t('actFormAvailLabel')}
          </Text>
          <TextInput
            value={availabilitySummary}
            onChangeText={setAvailabilitySummary}
            placeholder={t('actFormAvailPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
          />
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            {t('actFormReqLabel')}
          </Text>
          <TextInput
            value={requirements}
            onChangeText={setRequirements}
            placeholder={t('actFormReqPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color={colors.textMuted}>
            {t('actFormStatusLabel')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip
              label={t('actFormStatusPublished')}
              icon="eye-outline"
              selected={status === 'published'}
              onPress={() => setStatus('published')}
            />
            <Chip
              label={t('actFormStatusPaused')}
              icon="pause-circle-outline"
              selected={status === 'paused'}
              tone={colors.textMuted}
              onPress={() => setStatus('paused')}
            />
          </View>
        </View>
      </Card>

      {error ? (
        <Card variant="flat" style={{ backgroundColor: colors.dangerSoft, borderColor: colors.danger }}>
          <Text variant="caption" color={colors.danger} style={{ fontWeight: '600' }}>
            {error}
          </Text>
        </Card>
      ) : null}

      <Button
        title={initial ? t('actFormSaveEdit') : t('actFormPublish')}
        icon="checkmark-circle-outline"
        loading={isSubmitting}
        fullWidth
        onPress={handleSave}
      />
    </Screen>
  );
}
