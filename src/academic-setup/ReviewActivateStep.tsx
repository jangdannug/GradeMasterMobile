import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GradingScheme, gradingSchemesApi } from '../api/gradingSchemes';
import { Badge, DashedEmpty } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { useAcademicSetup } from './AcademicSetupContext';
import { academicKeys } from './keys';

const READ_ONLY_MESSAGE = 'School year must be an active, unlocked draft to activate a grading scheme';

interface ActivationError {
  message: string;
  details: string[];
  remediation: string;
}

/**
 * Reads the server's validation failure verbatim: `message`, `details` (a string, or a
 * field -> messages[] map) and `remediation`. Also understands ASP.NET problem details.
 */
function parseActivationError(error: any): ActivationError {
  const data = error?.response?.data;
  const first = data?.errors?.[0];
  const toLines = (details: unknown): string[] => {
    if (!details) return [];
    if (typeof details === 'string') return [details];
    if (typeof details === 'object') {
      return Object.entries(details as Record<string, unknown>).flatMap(([field, messages]) =>
        (Array.isArray(messages) ? messages : [messages]).map((m) => `${field}: ${String(m)}`)
      );
    }
    return [];
  };

  if (first) {
    return {
      message: first.message ?? 'The grading scheme could not be updated.',
      details: toLines(first.details),
      remediation: first.remediation ?? '',
    };
  }
  if (data?.errors && typeof data.errors === 'object') {
    return { message: data.title ?? 'Validation failed.', details: toLines(data.errors), remediation: '' };
  }
  return { message: error?.message ?? 'The grading scheme could not be updated.', details: [], remediation: '' };
}

export default function ReviewActivateStep() {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { schemes, byScheme, schoolYear, levels, groups, subjectCount, unassignedCount, incompleteSchemeIds, isReadOnly, isLoading } =
    useAcademicSetup();
  const [error, setError] = useState<ActivationError | null>(null);

  const customSchemes = schemes.filter((s) => !s.isSystemDefined);
  const activeScheme = customSchemes.find((s) => s.isActive);
  const levelsWithSubjects = groups.filter((g) => g.subjects.length > 0).length;

  const toggle = useMutation({
    mutationFn: async (scheme: GradingScheme) => {
      if (scheme.isActive) await gradingSchemesApi.deactivate(schoolYear.id, scheme.id);
      else await gradingSchemesApi.activate(schoolYear.id, scheme.id);
      return scheme;
    },
    onMutate: () => setError(null),
    onSuccess: (scheme) => {
      queryClient.invalidateQueries({ queryKey: academicKeys.schemes(schoolYear.id) });
      Alert.alert(
        scheme.isActive ? 'Deactivated' : 'Activated',
        `"${scheme.name}" ${scheme.isActive ? 'deactivated' : 'activated'} for ${schoolYear.name}`
      );
    },
    onError: (e) => setError(parseActivationError(e)),
  });

  const pendingId = toggle.isPending ? toggle.variables?.id : undefined;

  const act = (scheme: GradingScheme) => {
    if (isReadOnly) {
      Alert.alert('View only', READ_ONLY_MESSAGE);
      return;
    }
    toggle.mutate(scheme);
  };

  if (isLoading && schemes.length === 0) return <ActivityIndicator style={styles.loading} color={t.primary} />;

  return (
    <View>
      <Text style={[styles.intro, { color: t.muted }]}>
        Check the setup below, then activate the grading scheme that applies to S.Y. {schoolYear.name}.
      </Text>

      {/* Stat tiles */}
      <View style={styles.tiles}>
        <Tile
          icon="clipboard"
          label="Grading schemes"
          value={String(customSchemes.length)}
          hint={activeScheme ? `Active: ${activeScheme.name}` : 'None active'}
        />
        <Tile
          icon="school"
          label="Grade levels & subjects"
          value={String(subjectCount)}
          hint={`${levelsWithSubjects} grade level(s) with subjects`}
        />
        <Tile
          icon={unassignedCount === 0 ? 'checkmark-circle' : 'alert-circle'}
          label="Unassigned subjects"
          value={String(unassignedCount)}
          hint={unassignedCount === 0 ? 'Every subject has a scheme' : 'Assign them in Step 3'}
          tone={unassignedCount === 0 ? 'success' : 'warning'}
        />
      </View>

      {/* Activation */}
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>Activation</Text>

        {error && (
          <View style={[styles.banner, { backgroundColor: t.destructiveTint, borderColor: t.destructive }]}>
            <Ionicons name="alert-circle" size={18} color={t.destructive} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: t.destructive }]}>{error.message}</Text>
              {error.details.map((line) => (
                <Text key={line} style={[styles.bannerLine, { color: t.destructive }]}>
                  • {line}
                </Text>
              ))}
              {!!error.remediation && <Text style={[styles.bannerHint, { color: t.muted }]}>{error.remediation}</Text>}
            </View>
          </View>
        )}

        {customSchemes.length === 0 ? (
          <DashedEmpty
            icon="clipboard-outline"
            title="No grading schemes to review yet."
            subtitle={
              schemes.length > 0
                ? 'Only system-defined grading schemes exist for this school year — they are not shown here.'
                : 'Finish the previous steps before activating.'
            }
          />
        ) : (
          customSchemes.map((scheme) => {
            const busy = pendingId === scheme.id;
            return (
              <View
                key={scheme.id}
                style={[
                  styles.row,
                  {
                    borderColor: scheme.isActive ? t.primary : t.border,
                    backgroundColor: scheme.isActive ? t.primaryTint : t.background,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: t.foreground }]}>{scheme.name}</Text>
                    {scheme.isActive && <Badge label="Active" tone="success" />}
                    {incompleteSchemeIds.has(scheme.id) && <Badge label="Incomplete" tone="warning" />}
                  </View>
                  <Text style={[styles.meta, { color: t.muted }]}>
                    {scheme.code} · {(byScheme.get(scheme.id) ?? []).length} subject(s) assigned
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.action,
                    { backgroundColor: scheme.isActive ? t.card : t.primary, borderColor: scheme.isActive ? t.border : t.primary },
                    (isReadOnly || toggle.isPending) && { opacity: 0.45 },
                  ]}
                  disabled={toggle.isPending}
                  onPress={() => act(scheme)}
                  activeOpacity={0.85}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={scheme.isActive ? t.foreground : '#fff'} />
                  ) : (
                    <Text style={[styles.actionText, { color: scheme.isActive ? t.foreground : '#fff' }]}>
                      {scheme.isActive ? 'Deactivate' : 'Activate'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

function Tile({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  hint: string;
  tone?: 'success' | 'warning';
}) {
  const t = useDashboardTheme();
  const accent = tone === 'success' ? t.success : tone === 'warning' ? t.warning : t.primary;
  const tint = tone === 'success' ? t.successTint : tone === 'warning' ? t.warningTint : t.primaryTint;
  return (
    <View style={[styles.tile, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={[styles.tileIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.tileLabel, { color: t.muted }]}>{label}</Text>
        <Text style={[styles.tileValue, { color: tone ? accent : t.foreground }]}>{value}</Text>
        <Text style={[styles.tileHint, { color: t.muted }]} numberOfLines={2}>
          {hint}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 40 },
  intro: { fontSize: 13.5, lineHeight: 19, marginBottom: 14 },
  tiles: { gap: 10, marginBottom: 14 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  tileIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 12, fontWeight: '600' },
  tileValue: { fontSize: 24, fontWeight: '800', marginTop: 1 },
  tileHint: { fontSize: 12, marginTop: 1 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  banner: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  bannerTitle: { fontSize: 13.5, fontWeight: '700' },
  bannerLine: { fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  bannerHint: { fontSize: 12.5, marginTop: 6, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12.5, marginTop: 3 },
  action: { minWidth: 104, height: 40, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  actionText: { fontSize: 13.5, fontWeight: '700' },
});
