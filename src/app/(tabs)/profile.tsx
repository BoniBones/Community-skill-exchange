import { router } from 'expo-router';
import { View } from 'react-native';

import { ActivityCard, Rating, Stars } from '../../components/activity';
import { getNeighborhood, skillName } from '../../domain/catalog';
import { useAuth } from '../../features/auth/authContext';
import { formatShortDate } from '../../lib/dates';
import { useI18n } from '../../lib/i18n';
import { profiles } from '../../mocks/data';
import {
  useCurrentUserId,
  useInstructorActivities,
  useProfile,
  useReviewsAbout,
} from '../../services/queries';
import { DemoBanner, ErrorState, LoadingState, Screen, SectionHeader } from '../../ui/layout';
import { Avatar, Badge, Button, Card, Chip, Text } from '../../ui/primitives';
import { colors, spacing } from '../../ui/theme';

const profileMap = new Map(profiles.map((p) => [p.id, p]));

export default function ProfileScreen() {
  const { locale, setLocale, t } = useI18n();
  const { resetToNewOnboarding, signOut } = useAuth();
  const { data: userId } = useCurrentUserId();
  const me = useProfile(userId);
  const myActivities = useInstructorActivities(userId);
  const reviews = useReviewsAbout(userId);

  if (me.isLoading) {
    return (
      <Screen>
        <LoadingState label="Cargando tu perfil…" />
      </Screen>
    );
  }

  if (me.isError || !me.data) {
    return (
      <Screen>
        <ErrorState onRetry={() => me.refetch()} />
      </Screen>
    );
  }

  const p = me.data;
  const offers = p.skills.filter((s) => s.kind === 'offers');
  const wants = p.skills.filter((s) => s.kind === 'wants');

  return (
    <Screen
      refreshing={me.isRefetching}
      onRefresh={() => {
        me.refetch();
        myActivities.refetch();
        reviews.refetch();
      }}
    >
      <DemoBanner compact />

      {/* Identity card */}
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Avatar name={p.displayName} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title">{p.displayName}</Text>
            <Text variant="caption" color={colors.textMuted}>
              {getNeighborhood(p.neighborhoodId)?.name ?? 'Comunidad'} · Miembro desde {formatShortDate(p.memberSince)}
            </Text>
            <Rating avg={p.ratingAvg} count={p.ratingCount} />
          </View>
        </View>
        <Text color={colors.text}>{p.bio}</Text>

        {/* Community stats */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="heading" color={colors.primary}>
              {p.completedSessions}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              Sesiones completadas
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading" color={colors.accent}>
              {p.communityContributions}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              Aportes a la comunidad
            </Text>
          </View>
        </View>

        <Button
          title="Editar perfil y habilidades"
          variant="secondary"
          icon="create-outline"
          fullWidth
          onPress={() => router.push('/edit-profile')}
        />
      </Card>

      {/* Skills offered & wanted */}
      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.sm }}>
          <Badge label="PUEDO ENSEÑAR" fg={colors.primary} bg={colors.primarySoft} icon="easel-outline" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {offers.map((s) => (
              <Chip key={s.skillId} label={skillName(s.skillId)} selected tone={colors.primary} />
            ))}
          </View>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Badge label="QUIERO APRENDER" fg={colors.accent} bg={colors.accentSoft} icon="bulb-outline" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {wants.map((s) => (
              <Chip key={s.skillId} label={skillName(s.skillId)} selected tone={colors.accent} />
            ))}
          </View>
        </View>
        <Text variant="caption" color={colors.textMuted}>
          Disponibilidad habitual: {p.availabilitySummary}
        </Text>
      </Card>

      {/* Published activities */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title="Actividades que ofrezco"
          subtitle="Configurá si aceptás créditos, dinero o pago mixto en cada una"
          action={
            <Button
              title="Gestionar"
              variant="secondary"
              icon="settings-outline"
              onPress={() => router.push('/my-activities')}
            />
          }
        />
        {(myActivities.data ?? []).map((a) => (
          <ActivityCard key={a.id} activity={a} instructor={p} />
        ))}
      </View>

      {/* Reviews */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title="Reseñas verificadas"
          subtitle="Solo quienes completaron una sesión verificada pueden dejar reseña"
        />
        {(reviews.data ?? []).map((r) => {
          const author = profileMap.get(r.authorId);
          return (
            <Card key={r.id} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="bodyStrong">{author?.displayName ?? 'Miembro'}</Text>
                <Stars value={r.rating} />
              </View>
              <Text color={colors.text}>{r.comment}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {formatShortDate(r.createdAt)}
              </Text>
            </Card>
          );
        })}
      </View>

      {/* Onboarding, Trust & Diagnostics shortcuts */}
      <Card style={{ backgroundColor: colors.surfaceAlt, gap: spacing.sm }}>
        <Text variant="bodyStrong">Comunidad, Moderación y Diagnóstico</Text>
        <Text variant="caption" color={colors.textMuted}>
          Accedé a tus notificaciones, al panel de moderación y resolución de disputas, al flujo de bienvenida (+18)
          o al diagnóstico técnico de Expo Go y Supabase.
        </Text>
        <View style={{ gap: spacing.xs, paddingBottom: spacing.xs }}>
          <Text variant="caption" color={colors.textMuted}>
            {t('languageLabel')}:
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Chip
              label={`🇦🇷 ${t('localeEsAr')}`}
              selected={locale === 'es-AR'}
              onPress={() => setLocale('es-AR')}
            />
            <Chip
              label={`🌐 ${t('localeEn')}`}
              selected={locale === 'en'}
              onPress={() => setLocale('en')}
            />
          </View>
        </View>
        <Button
          title="Notificaciones de la comunidad"
          variant="secondary"
          icon="notifications-outline"
          fullWidth
          onPress={() => router.push('/notifications')}
        />
        <Button
          title="Panel de Moderación y Disputas"
          variant="secondary"
          icon="shield-checkmark-outline"
          fullWidth
          onPress={() => router.push('/admin')}
        />
        <Button
          title="Probar flujo de Onboarding (3 pasos)"
          variant="secondary"
          icon="sparkles-outline"
          fullWidth
          onPress={() => {
            resetToNewOnboarding();
            router.push('/(onboarding)/eligibility');
          }}
        />
        <Button
          title="Abrir diagnóstico técnico"
          variant="secondary"
          icon="pulse-outline"
          fullWidth
          onPress={() => router.push('/dev')}
        />
        <Button
          title="Volver a pantalla de bienvenida"
          variant="ghost"
          icon="log-out-outline"
          fullWidth
          onPress={() => {
            signOut();
            router.replace('/welcome');
          }}
        />
      </Card>
    </Screen>
  );
}
