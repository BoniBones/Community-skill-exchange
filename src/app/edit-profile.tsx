import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { NEIGHBORHOODS, SKILLS } from '../domain/catalog';
import type { ID, UserSkill } from '../domain/types';
import { useCurrentUserId, useProfile, useUpdateProfile } from '../services/queries';
import { DemoBanner, LoadingState, Screen, SectionHeader } from '../ui/layout';
import { Button, Card, Chip, Text } from '../ui/primitives';
import { colors, radius, spacing } from '../ui/theme';

export default function EditProfileScreen() {
  const { data: userId } = useCurrentUserId();
  const me = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);

  if (me.isLoading || !me.data) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState label="Cargando perfil…" />
      </Screen>
    );
  }

  return <EditProfileForm initialProfile={me.data} onSave={updateProfile.mutateAsync} isSaving={updateProfile.isPending} />;
}

function EditProfileForm({
  initialProfile,
  onSave,
  isSaving,
}: {
  initialProfile: NonNullable<ReturnType<typeof useProfile>['data']>;
  onSave: ReturnType<typeof useUpdateProfile>['mutateAsync'];
  isSaving: boolean;
}) {
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [neighborhoodId, setNeighborhoodId] = useState<ID>(initialProfile.neighborhoodId);
  const [bio, setBio] = useState(initialProfile.bio);
  const [availabilitySummary, setAvailabilitySummary] = useState(initialProfile.availabilitySummary);
  const [offers, setOffers] = useState<ID[]>(
    initialProfile.skills.filter((s) => s.kind === 'offers').map((s) => s.skillId),
  );
  const [wants, setWants] = useState<ID[]>(
    initialProfile.skills.filter((s) => s.kind === 'wants').map((s) => s.skillId),
  );
  const [error, setError] = useState<string | null>(null);

  const toggleSkill = (list: ID[], setList: (next: ID[]) => void, id: ID) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const handleSave = async () => {
    setError(null);
    if (displayName.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (offers.length === 0 || wants.length === 0) {
      setError('Seleccioná al menos una habilidad para enseñar y una para aprender.');
      return;
    }
    const skills: UserSkill[] = [
      ...offers.map((skillId) => ({ skillId, kind: 'offers' as const, level: 'advanced' as const })),
      ...wants.map((skillId) => ({ skillId, kind: 'wants' as const })),
    ];
    await onSave({
      displayName: displayName.trim(),
      neighborhoodId,
      bio: bio.trim(),
      availabilitySummary: availabilitySummary.trim(),
      skills,
    });
    router.back();
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            NOMBRE EN LA COMUNIDAD
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
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

        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color={colors.textMuted}>
            BARRIO O ZONA
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {NEIGHBORHOODS.map((n) => (
              <Chip
                key={n.id}
                label={n.name}
                icon="location-outline"
                selected={neighborhoodId === n.id}
                onPress={() => setNeighborhoodId(n.id)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            PRESENTACIÓN PERSONAL
          </Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
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

        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            DISPONIBILIDAD HABITUAL
          </Text>
          <TextInput
            value={availabilitySummary}
            onChangeText={setAvailabilitySummary}
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
      </Card>

      <Card style={{ gap: spacing.md }}>
        <SectionHeader
          title="Habilidades que puedo enseñar"
          subtitle="Impacta en las coincidencias recíprocas de tu inicio"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SKILLS.map((s) => (
            <Chip
              key={`edit-offer-${s.id}`}
              label={s.name}
              selected={offers.includes(s.id)}
              tone={colors.primary}
              onPress={() => toggleSkill(offers, setOffers, s.id)}
            />
          ))}
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <SectionHeader title="Habilidades que quiero aprender" subtitle="Personaliza tus recomendaciones" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SKILLS.map((s) => (
            <Chip
              key={`edit-want-${s.id}`}
              label={s.name}
              selected={wants.includes(s.id)}
              tone={colors.accent}
              onPress={() => toggleSkill(wants, setWants, s.id)}
            />
          ))}
        </View>
      </Card>

      {error ? (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      ) : null}

      <Button title="Guardar cambios" icon="save-outline" loading={isSaving} fullWidth onPress={handleSave} />
    </Screen>
  );
}
