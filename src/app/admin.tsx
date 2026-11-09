import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { formatShortDate } from '../lib/dates';
import { formatCredits } from '../lib/format';
import { profiles } from '../mocks/data';
import {
  useCurrentUserId,
  useDisputes,
  useResolveDispute,
  useResolveSafetyReport,
  useSafetyReports,
} from '../services/queries';
import { DemoBanner, EmptyState, LoadingState, Screen, SectionHeader } from '../ui/layout';
import { Badge, Button, Card, Text } from '../ui/primitives';
import { colors, radius, spacing } from '../ui/theme';

const profileMap = new Map(profiles.map((p) => [p.id, p]));

export default function AdminModerationScreen() {
  const { data: userId } = useCurrentUserId();
  const disputes = useDisputes();
  const reports = useSafetyReports();
  const resolveDispute = useResolveDispute(userId);
  const resolveReport = useResolveSafetyReport(userId);

  const [notesByDispute, setNotesByDispute] = useState<Record<string, string>>({});
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  if (disputes.isLoading || reports.isLoading) {
    return (
      <Screen>
        <LoadingState label="Cargando cola de moderación y disputas…" />
      </Screen>
    );
  }

  const disputeList = disputes.data ?? [];
  const reportList = reports.data ?? [];
  const openDisputes = disputeList.filter((d) => d.status === 'open').length;
  const openReports = reportList.filter((r) => r.status === 'open').length;

  return (
    <Screen
      refreshing={disputes.isRefetching || reports.isRefetching}
      onRefresh={() => {
        disputes.refetch();
        reports.refetch();
      }}
    >
      <DemoBanner compact />

      <Card style={{ backgroundColor: colors.surfaceAlt, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Badge
            label="PANEL DE MODERACIÓN Y CONFIANZA"
            fg={colors.primary}
            bg={colors.primarySoft}
            icon="shield-checkmark-outline"
          />
          <Text variant="caption" color={colors.textMuted}>
            Rol: Moderador comunitario
          </Text>
        </View>
        <Text variant="bodyStrong">Sin penalizaciones irreversibles automáticas</Text>
        <Text variant="caption" color={colors.textMuted}>
          Toda objeción por fuerza mayor dentro de las 48 h o sesión en disputa congela los créditos en custodia
          (escrow) hasta que un moderador revise el caso y registre una resolución auditada.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, paddingTop: spacing.xs }}>
          <Badge
            label={`${openDisputes} disputas abiertas`}
            fg={openDisputes > 0 ? colors.warning : colors.primary}
            bg={openDisputes > 0 ? colors.warningSoft : colors.primarySoft}
          />
          <Badge
            label={`${openReports} reportes de seguridad`}
            fg={openReports > 0 ? colors.danger : colors.textMuted}
            bg={openReports > 0 ? colors.dangerSoft : colors.surface}
          />
        </View>
      </Card>

      {bannerMsg ? (
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary }}>
          <Text variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
            ✓ {bannerMsg}
          </Text>
        </Card>
      ) : null}

      {/* Disputes section */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title="Disputas y objeciones de fuerza mayor"
          subtitle="Resolvé liberando al instructor, reembolsando al estudiante o dividiendo (50/50)"
        />
        {disputeList.length === 0 ? (
          <EmptyState
            icon="checkmark-done-circle-outline"
            title="Sin disputas registradas"
            message="Todas las sesiones y cancelaciones están al día."
          />
        ) : (
          disputeList.map((d) => {
            const learner = profileMap.get(d.learnerId);
            const instructor = profileMap.get(d.instructorId);
            const isOpen = d.status === 'open';
            const noteVal =
              notesByDispute[d.id] ??
              'Tras revisar el descargo y el historial comunitario, se aplica esta resolución equitativa.';

            return (
              <Card
                key={d.id}
                style={{
                  gap: spacing.sm,
                  borderColor: isOpen ? colors.warning : colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Badge
                    label={
                      d.status === 'open'
                        ? 'ABIERTA · CRÉDITOS RETENIDOS'
                        : d.status === 'resolved_refund'
                          ? 'RESUELTA · REEMBOLSO 100%'
                          : d.status === 'resolved_release'
                            ? 'RESUELTA · LIBERADO AL INSTRUCTOR'
                            : 'RESUELTA · DIVISIÓN EQUITATIVA'
                    }
                    fg={isOpen ? colors.warning : colors.primary}
                    bg={isOpen ? colors.warningSoft : colors.primarySoft}
                    icon={isOpen ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                  />
                  <Text variant="caption" color={colors.credit} style={{ fontWeight: '700' }}>
                    {formatCredits(d.creditAmount)} en custodia
                  </Text>
                </View>

                <Text variant="bodyStrong">{d.activityTitle}</Text>
                <Text variant="caption" color={colors.textMuted}>
                  Estudiante: {learner?.displayName ?? d.learnerId} · Instructor:{' '}
                  {instructor?.displayName ?? d.instructorId} · Abierta el {formatShortDate(d.createdAt)}
                </Text>

                <View
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderRadius: radius.md,
                    padding: spacing.sm,
                    gap: 4,
                  }}
                >
                  <Text variant="caption" color={colors.textMuted}>
                    Motivo / descargo presentado:
                  </Text>
                  <Text variant="caption" color={colors.text}>
                    “{d.reason}”
                  </Text>
                </View>

                {isOpen ? (
                  <View style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
                    <Text variant="caption" color={colors.textMuted}>
                      Nota de resolución administrativa (visible para ambas partes):
                    </Text>
                    <TextInput
                      value={noteVal}
                      onChangeText={(txt) => setNotesByDispute((prev) => ({ ...prev, [d.id]: txt }))}
                      multiline
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        padding: spacing.sm,
                        backgroundColor: colors.bg,
                        color: colors.text,
                        minHeight: 54,
                      }}
                    />
                    <View style={{ gap: spacing.xs }}>
                      <Button
                        title="Reembolsar 100% al estudiante (fuerza mayor)"
                        variant="primary"
                        icon="arrow-undo-outline"
                        fullWidth
                        disabled={resolveDispute.isPending}
                        onPress={() =>
                          resolveDispute.mutate(
                            {
                              disputeId: d.id,
                              resolution: 'resolved_refund',
                              resolutionNote: noteVal,
                            },
                            {
                              onSuccess: () =>
                                setBannerMsg(`Disputa de "${d.activityTitle}" resuelta con reembolso al estudiante.`),
                            },
                          )
                        }
                      />
                      <Button
                        title="Liberar 100% al instructor"
                        variant="secondary"
                        icon="checkmark-done-outline"
                        fullWidth
                        disabled={resolveDispute.isPending}
                        onPress={() =>
                          resolveDispute.mutate(
                            {
                              disputeId: d.id,
                              resolution: 'resolved_release',
                              resolutionNote: noteVal,
                            },
                            {
                              onSuccess: () =>
                                setBannerMsg(`Disputa de "${d.activityTitle}" resuelta liberando al instructor.`),
                            },
                          )
                        }
                      />
                      <Button
                        title="Dividir créditos (50% instructor / 50% reembolso)"
                        variant="secondary"
                        icon="git-branch-outline"
                        fullWidth
                        disabled={resolveDispute.isPending}
                        onPress={() =>
                          resolveDispute.mutate(
                            {
                              disputeId: d.id,
                              resolution: 'resolved_split',
                              resolutionNote: noteVal,
                            },
                            {
                              onSuccess: () =>
                                setBannerMsg(`Disputa de "${d.activityTitle}" resuelta con división equitativa.`),
                            },
                          )
                        }
                      />
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 4 }}>
                    <Text variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
                      Resolución: {d.resolutionNote}
                    </Text>
                  </View>
                )}

                <Button
                  title="Ver detalle de la sesión"
                  variant="ghost"
                  icon="open-outline"
                  onPress={() => router.push({ pathname: '/session/[id]', params: { id: d.sessionId } })}
                />
              </Card>
            );
          })
        )}
      </View>

      {/* Safety reports section */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title="Reportes de convivencia y seguridad"
          subtitle="Reportes enviados desde perfiles de usuarios o sesiones"
        />
        {reportList.map((r) => {
          const reporter = profileMap.get(r.reporterId);
          const target = profileMap.get(r.targetUserId);
          const isOpen = r.status === 'open';
          return (
            <Card key={r.id} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Badge
                  label={
                    r.status === 'open'
                      ? 'PENDIENTE DE REVISIÓN'
                      : r.status === 'reviewed'
                        ? 'REVISADO · MEDIDA APLICADA'
                        : 'DESCARTADO'
                  }
                  fg={isOpen ? colors.danger : colors.textMuted}
                  bg={isOpen ? colors.dangerSoft : colors.surfaceAlt}
                  icon="flag-outline"
                />
                <Text variant="caption" color={colors.textMuted}>
                  {formatShortDate(r.createdAt)}
                </Text>
              </View>
              <Text variant="bodyStrong">
                Perfil reportado: {target?.displayName ?? r.targetUserId}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                Reportado por: {reporter?.displayName ?? r.reporterId}
              </Text>
              <Text color={colors.text}>Motivo: “{r.reason}”</Text>
              {isOpen ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                  <Button
                    title="Marcar revisado"
                    variant="primary"
                    icon="checkmark-outline"
                    disabled={resolveReport.isPending}
                    onPress={() =>
                      resolveReport.mutate(
                        { reportId: r.id, status: 'reviewed' },
                        { onSuccess: () => setBannerMsg('Reporte de seguridad marcado como revisado.') },
                      )
                    }
                  />
                  <Button
                    title="Descartar"
                    variant="secondary"
                    icon="close-outline"
                    disabled={resolveReport.isPending}
                    onPress={() =>
                      resolveReport.mutate(
                        { reportId: r.id, status: 'dismissed' },
                        { onSuccess: () => setBannerMsg('Reporte de seguridad descartado.') },
                      )
                    }
                  />
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
