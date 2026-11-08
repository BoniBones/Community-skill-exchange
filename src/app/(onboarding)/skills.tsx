import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SKILLS } from '../../domain/catalog';
import type { ID, SkillLevel, UserSkill } from '../../domain/types';
import { useAuth } from '../../features/auth/authContext';
import { useCurrentUserId, useUpdateProfile } from '../../services/queries';
import { DemoBanner, Screen, SectionHeader } from '../../ui/layout';
import { Badge, Button, Card, Chip, Text } from '../../ui/primitives';
import { colors, spacing } from '../../ui/theme';

const levelLabels: Record<SkillLevel, string> = {
  beginner: 'Inicial',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
  expert: 'Experto',
};
const levels: SkillLevel[] = ['intermediate', 'advanced', 'expert'];

export default function OnboardingSkillsScreen() {
  const { draft, updateDraft, markOnboardingCompleted } = useAuth();
  const { data: userId } = useCurrentUserId();
  const updateProfile = useUpdateProfile(userId);

  const [offers, setOffers] = useState<ID[]>(
    draft.skills.filter((s) => s.kind === 'offers').map((s) => s.skillId),
  );
  const [wants, setWants] = useState<ID[]>(
    draft.skills.filter((s) => s.kind === 'wants').map((s) => s.skillId),
  );
  const [defaultLevel, setDefaultLevel] = useState<SkillLevel>('advanced');
  const [error, setError] = useState<string | null>(null);

  const toggleSkill = (list: ID[], setList: (next: ID[]) => void, id: ID) => {
    if (list.includes(id)) {
      setList(list.filter((x) => x !== id));
    } else {
      setList([...list, id]);
    }
  };

  const handleFinish = async () => {
    setError(null);
    if (offers.length === 0) {
      setError('Elegí al menos una habilidad que puedas compartir con la comunidad.');
      return;
    }
    if (wants.length === 0) {
      setError('Elegí al menos una habilidad que te gustaría aprender.');
      return;
    }

    const skills: UserSkill[] = [
      ...offers.map((skillId) => ({ skillId, kind: 'offers' as const, level: defaultLevel })),
      ...wants.map((skillId) => ({ skillId, kind: 'wants' as const })),
    ];

    updateDraft({ skills });
    await updateProfile.mutateAsync({
      displayName: draft.displayName,
      neighborhoodId: draft.neighborhoodId,
      bio: draft.bio,
      availabilitySummary: draft.availabilitySummary,
      skills,
    });
    markOnboardingCompleted();
    router.replace('/(tabs)');
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Badge label="PASO 3 DE 3 · RECIPROCIDAD" fg={colors.accent} bg={colors.accentSoft} icon="swap-horizontal" />
        <Text variant="title">¿Qué enseñás y qué querés aprender?</Text>
        <Text color={colors.textMuted}>
          Con esto encontramos coincidencias recíprocas (vecinos que enseñan lo que buscás y quieren aprender lo que vos
          ofrecés) e intercambios con créditos comunitarios.
        </Text>
      </View>

      {/* Skills I can teach */}
      <Card style={{ gap: spacing.md }}>
        <SectionHeader
          title="1. Habilidades que puedo enseñar"
          subtitle="Tocá las habilidades que te gustaría compartir"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SKILLS.map((s) => (
            <Chip
              key={`offer-${s.id}`}
              label={s.name}
              selected={offers.includes(s.id)}
              tone={colors.primary}
              onPress={() => toggleSkill(offers, setOffers, s.id)}
            />
          ))}
        </View>
        <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
          <Text variant="label" color={colors.textMuted}>
            NIVEL DE EXPERIENCIA EN LO QUE ENSEÑÁS
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
        <SectionHeader
          title="2. Habilidades que quiero aprender"
          subtitle="Te recomendaremos actividades y vecinos afines"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SKILLS.map((s) => (
            <Chip
              key={`want-${s.id}`}
              label={s.name}
              selected={wants.includes(s.id)}
              tone={colors.accent}
              onPress={() => toggleSkill(wants, setWants, s.id)}
            />
          ))}
        </View>
      </Card>

      {/* Initial credit allocation rule */}
      <Card style={{ backgroundColor: colors.creditSoft, borderColor: '#FDE68A', gap: spacing.xs }}>
        <Badge label="ASIGNACIÓN INICIAL DE CRÉDITOS" fg={colors.credit} bg="#FDE68A" icon="sparkles-outline" />
        <Text variant="bodyStrong" color={colors.credit}>
          Tu saldo inicial comienza en 0 créditos
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          Para fomentar que todos aporten a la comunidad, recibís un incentivo inicial de{' '}
          <Text variant="bodyStrong">2 créditos comunitarios</Text> una vez que completás tu perfil de instructor y
          publicás tu primera actividad.
        </Text>
      </Card>

      {error ? (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      ) : null}

      <Button
        title="Guardar y descubrir mi comunidad"
        icon="checkmark-done-outline"
        loading={updateProfile.isPending}
        fullWidth
        onPress={handleFinish}
      />
    </Screen>
  );
}
