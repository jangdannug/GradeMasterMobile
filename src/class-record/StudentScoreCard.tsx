import React, { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SheetComponent } from '../api/gradeSubmission';
import { useDashboardTheme } from '../dashboard/theme';
import {
  compScores,
  descriptorColor,
  DescriptorRow,
  formatGrade,
  HighestScoreMap,
  initialGrade,
  isScoreOverMax,
  lookupDescriptor,
  lookupFinalGrade,
  NameSegment,
  splitNameByTokens,
  StudentValidation,
  TransmutationRow,
} from './logic';
import ScoreEntry from './ScoreEntry';

interface Props {
  enrollmentId: string;
  /** "Last, First" */
  name: string;
  tokens: string[];
  components: SheetComponent[];
  highest: HighestScoreMap;
  itemWeights: Record<string, number>;
  /** This student's draft scores (a new object whenever one of them changes) */
  scores: Record<string, number> | undefined;
  transmutationRows: TransmutationRow[];
  descriptorRows: DescriptorRow[];
  validation: StudentValidation | undefined;
  canEnter: boolean;
  /** Changes whenever the draft is reset, remounting the uncontrolled inputs */
  version: number;
  registerRef: (key: string, input: React.ComponentRef<typeof TextInput> | null) => void;
  onScore: (enrollmentId: string, itemId: string, text: string) => void;
  onNext: (enrollmentId: string, itemId: string) => void;
}

function StudentScoreCard(p: Props) {
  const t = useDashboardTheme();
  const own = useMemo(() => ({ [p.enrollmentId]: p.scores ?? {} }), [p.enrollmentId, p.scores]);

  const segments: NameSegment[] = useMemo(() => splitNameByTokens(p.name, p.tokens), [p.name, p.tokens]);
  const ig = initialGrade(p.enrollmentId, p.components, own, p.highest);
  // Computed from the live Initial Grade, so it updates while typing, before saving
  const finalGrade = lookupFinalGrade(ig, p.transmutationRows);
  const descriptor = finalGrade !== null ? lookupDescriptor(finalGrade, p.descriptorRows) : null;
  const descriptorTint = descriptor ? descriptorColor(descriptor.color, t.isDark) : null;

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: p.validation?.hasOverMax ? t.destructive : t.border }]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: t.primaryTint }]}>
          <Text style={[styles.avatarText, { color: t.primary }]}>{p.name.trim().charAt(0).toUpperCase() || '?'}</Text>
        </View>
        <Text style={[styles.name, { color: t.foreground }]} numberOfLines={2}>
          {segments.map((seg, i) => (
            <Text key={i} style={seg.match ? { backgroundColor: t.warningTint, color: t.warning } : undefined}>
              {seg.text}
            </Text>
          ))}
        </Text>
      </View>

      {p.components.map((comp) => {
        const summary = compScores(p.enrollmentId, comp, own, p.highest);
        const columns = comp.items.length === 0 ? [{ id: comp.id, name: comp.name }] : comp.items;
        return (
          <View key={comp.id} style={[styles.component, { backgroundColor: t.surfaceMuted, borderColor: t.border }]}>
            <View style={styles.componentHeader}>
              <Text style={[styles.componentName, { color: t.primary }]} numberOfLines={1}>
                {comp.name}
              </Text>
              <View style={[styles.weightPill, { backgroundColor: t.primaryTint }]}>
                <Text style={[styles.weightText, { color: t.primary }]}>{Math.round(comp.weightPercent * 100) / 100}%</Text>
              </View>
            </View>
            <View style={styles.grid}>
              {columns.map((col) => {
                const max = p.highest[col.id] ?? 0;
                const score = p.scores?.[col.id];
                return (
                  <ScoreEntry
                    key={`${col.id}:${p.version}`}
                    label={col.name}
                    max={max}
                    weight={p.itemWeights[col.id]}
                    initial={score}
                    disabled={!p.canEnter}
                    over={isScoreOverMax(p.enrollmentId, col.id, own, p.highest)}
                    blank={max > 0 && score === undefined}
                    inputRef={(input) => p.registerRef(`${p.enrollmentId}:${col.id}`, input)}
                    onChange={(text) => p.onScore(p.enrollmentId, col.id, text)}
                    onNext={() => p.onNext(p.enrollmentId, col.id)}
                  />
                );
              })}
            </View>
            <View style={[styles.componentStats, { borderTopColor: t.border }]}>
              <MiniStat label="Total" value={formatGrade(summary.total, 1)} />
              <MiniStat label="PS" value={formatGrade(summary.ps)} />
              <MiniStat label="WS" value={formatGrade(summary.ws)} />
            </View>
          </View>
        );
      })}

      <View style={[styles.summary, { backgroundColor: t.background, borderColor: t.border }]}>
        <Stat label="Initial Grade" value={formatGrade(ig)} />
        <Stat label="Final Grade" value={formatGrade(finalGrade, 0)} strong />
        <View style={styles.descriptorStat}>
          <Text style={[styles.statLabel, { color: t.muted }]}>Descriptor</Text>
          <Text style={[styles.statValue, { color: descriptorTint ?? t.muted }]}>
            {descriptor?.label ?? '—'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const t = useDashboardTheme();
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.miniValue, { color: t.foreground }]}>{value}</Text>
    </View>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const t = useDashboardTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: strong ? t.primary : t.foreground }]}>{value}</Text>
    </View>
  );
}

export default React.memo(StudentScoreCard);

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: 16, padding: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800' },
  name: { flex: 1, fontSize: 14.5, fontWeight: '800' },
  component: { borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8 },
  componentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  componentName: { flex: 1, fontSize: 13, fontWeight: '800' },
  weightPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  weightText: { fontSize: 11.5, fontWeight: '800' },
  grid: { gap: 6 },
  componentStats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 6 },
  miniStat: { flex: 1, alignItems: 'center' },
  miniLabel: { fontSize: 11, fontWeight: '600' },
  miniValue: { fontSize: 14, fontWeight: '800', marginTop: 1 },
  summary: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 },
  stat: { flex: 1 },
  // Wider than the number stats, and the label wraps instead of truncating ("Did Not Meet Expectations")
  descriptorStat: { flex: 2 },
  statLabel: { fontSize: 11, fontWeight: '600' },
  statValue: { fontSize: 15, fontWeight: '800', marginTop: 1 },
});
