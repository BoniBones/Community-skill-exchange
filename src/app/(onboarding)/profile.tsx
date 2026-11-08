import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { NEIGHBORHOODS } from '../../domain/catalog';
import { useAuth } from '../../features/auth/authContext';
import { DemoBanner, Screen } from '../../ui/layout';
import { Badge, Button, Card, Chip, Text } from '../../ui/primitives';
import { colors, radius, spacing } from '../../ui/theme';

export default function OnboardingProfileScreen() {
  const { draft, updateDraft } = useAuth();
  const [displayName, setDisplayName] = useState(draft.displayName);
  const [neighborhoodId, setNeighborhoodId] = useState(draft.neighborhoodId);
  const [bio, setBio] = useState(draft.bio);
  const [availabilitySummary, setAvailabilitySummary] = useState(draft.availabilitySummary);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (displayName.trim().length < 2) {
      setError('Ingresá tu nombre o cómo querés que te conozcan en la comunidad.');
      return;
    }
    if (bio.trim().length < 10) {
      setError('Escribí una breve presentación personal (al menos 10 caracteres).');
      return;
    }
    updateDraft({
      displayName: displayName.trim(),
      neighborhoodId,
      bio: bio.trim(),
      availabilitySummary: availabilitySummary.trim() || 'A coordinar',
    });
    router.push('/(onboarding)/skills');
  };

  return (
    <Screen edges={['bottom']}>
      <DemoBanner compact />

      <View style={{ gap: 4 }}>
        <Badge label="PASO 2 DE 3 · IDENTIDAD EN LA COMUNIDAD" fg={colors.primary} bg={colors.primarySoft} icon="person-outline" />
        <Text variant="title">Contanos quién sos</Text>
        <Text color={colors.textMuted}>
          En la comunidad todos podemos enseñar y aprender. Tu perfil muestra solo tu zona general (nunca tu domicilio).
        </Text>
      </View>

      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: 4 }}>
          <Text variant="label" color={colors.textMuted}>
            TU NOMBRE EN LA COMUNIDAD
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ej: Sofía Romero"
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

        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color={colors.textMuted}>
            BARRIO O ZONA GENERAL
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
            placeholder="Contá qué te gusta compartir, tu experiencia y qué te interesa aprender…"
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
              minHeight: 90,
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
            placeholder="Ej: Martes y jueves por la tarde / Sábados por la mañana"
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
      </Card>

      {error ? (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      ) : null}

      <Button title="Continuar a tus habilidades (Paso 3)" icon="arrow-forward-outline" fullWidth onPress={handleNext} />
    </Screen>
  );
}
