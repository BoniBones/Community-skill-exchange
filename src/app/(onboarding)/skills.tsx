import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SkillCatalogPicker } from '../../components/SkillCatalogPicker';
import { SKILLS } from '../../domain/catalog';
import type { ID, SkillLevel, UserSkill } from '../../domain/types';
import { useAuth } from '../../features/auth/authContext';
import { useI18n } from '../../lib/i18n';
import { useCreateCustomSkill, useCurrentUserId, useSkills, useUpdateProfile } from '../../services/queries';
import { DemoBanner, Screen, SectionHeader } from '../../ui/layout';
import { Badge, Button, Card, Chip, Text } from '../../ui/primitives';
import { spacing, useTheme } from '../../ui/theme';

const levels: SkillLevel[] = ['intermediate', 'advanced', 'expert'];

export default function OnboardingSkillsScreen() {
  const { draft, updateDraft, markOnboardingCompleted } = useAuth();
  const { data: userId } = useCurrentUserId();
  const skillsQuery = useSkills();
  const createCustomSkill = useCreateCustomSkill(userId);
  const updateProfile = useUpdateProfile(userId);
  const { colors } = useTheme();
  const { t } = useI18n();

  const levelLabels: Record<SkillLevel, string> = {
    beginner: t('levelBeginner'),
    intermediate: t('levelIntermediate'),
    advanced: t('levelAdvanced'),
    expert: t('levelExpert'),
  };

  const [offers, setOffers] = useState<ID[]>(
    draft.skills.filter((s) => s.kind === 'offers').map((s) => s.skillId),
  );
  const [wants, setWants] = useState<ID[]>(
    draft.skills.filter((s) => s.kind === 'wants').map((s) => s.skillId),
  );
  const [defaultLevel, setDefaultLevel] = useState<SkillLevel>('advanced');
  const [error, setError] = useState<string | null>(null);

  if (!draft.neighborhoodVerifiedAt) {
    return <Redirect href="/(onboarding)/neighborhood" />;
  }

  const catalogSkills = skillsQuery.data ?? SKILLS;

  const handleFinish = async () => {
    setError(null);
    if (offers.length === 0) {
      setError(t('onbSkillsErrOffer'));
      return;
    }
    if (wants.length === 0) {
      setError(t('onbSkillsErrWant'));
      return;
    }

    const skills: UserSkill[] = [
      ...offers.map((skillId) => ({ skillId, kind: 'offers' as const, level: defaultLevel })),
      ...wants.map((skillId) => ({ skillId, kind: 'wants' as const })),
    ];

    try {
      updateDraft({ skills });
      await updateProfile.mutateAsync({
        displayName: draft.displayName,
        neighborhoodId: draft.neighborhoodId,
        neighborhoodVerifiedAt: draft.neighborhoodVerifiedAt,
        avatarUrl: draft.avatarUrl ?? null,
        bio: draft.bio,
        availabilitySummary: draft.availabilitySummary,
        skills,
      });
      markOnboardingCompleted();
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorDefault'));
    }
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Badge label={t('onbSkillsStepBadge')} fg={colors.accent} bg={colors.accentSoft} icon="swap-horizontal" />
        <Text variant="title">{t('onbSkillsTitle')}</Text>
        <Text color={colors.textMuted}>{t('onbSkillsSubtitle')}</Text>
      </View>

      {/* Skills I can teach */}
      <Card style={{ gap: spacing.md }}>
        <SectionHeader title={t('onbSkillsTeachTitle')} subtitle={t('onbSkillsTeachSubtitle')} />
        <SkillCatalogPicker
          mode="multi"
          skills={catalogSkills}
          selectedIds={offers}
          onChange={setOffers}
          tone={colors.primary}
          allowCustomCreate
          isCreatingCustom={createCustomSkill.isPending}
          onCreateCustomSkill={(input) => createCustomSkill.mutateAsync(input)}
        />
        <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
          <Text variant="label" color={colors.textMuted}>
            {t('onbSkillsLevelLabel')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {levels.map((lvl) => (
              <Chip
                key={lvl}
                label={levelLabels[lvl]}
                selected={defaultLevel === lvl}
                onPress={() => setDefaultLevel(lvl)}
              />
            ))}
          </View>
        </View>
      </Card>

      {/* Skills I want to learn */}
      <Card style={{ gap: spacing.md }}>
        <SectionHeader title={t('onbSkillsLearnTitle')} subtitle={t('onbSkillsLearnSubtitle')} />
        <SkillCatalogPicker
          mode="multi"
          skills={catalogSkills}
          selectedIds={wants}
          onChange={setWants}
          tone={colors.accent}
          allowCustomCreate
          isCreatingCustom={createCustomSkill.isPending}
          onCreateCustomSkill={(input) => createCustomSkill.mutateAsync(input)}
        />
      </Card>

      {/* Initial credit allocation rule */}
      <Card
        variant="flat"
        style={{ backgroundColor: colors.creditSoft, borderColor: colors.creditBorder, gap: spacing.xs }}
      >
        <Badge label={t('onbSkillsCreditBadge')} fg={colors.credit} bg={colors.surface} icon="sparkles-outline" />
        <Text variant="bodyStrong" color={colors.credit}>
          {t('onbSkillsCreditTitle')}
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          {t('onbSkillsCreditBody')}
        </Text>
      </Card>

      {error ? (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      ) : null}

      <Button
        title={t('onbSkillsFinish')}
        icon="checkmark-done-outline"
        loading={updateProfile.isPending}
        fullWidth
        onPress={handleFinish}
      />
    </Screen>
  );
}
