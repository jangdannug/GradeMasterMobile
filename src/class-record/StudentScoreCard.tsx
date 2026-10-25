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
  NameSegment,
  splitNameByTokens,
  StudentValidation,
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
  finalGrade: number | null;
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
  const descriptor = p.finalGrade !== null ? lookupDescriptor(p.finalGrade, p.descriptorRows) : null;
  const descriptorTint = descriptor ? descriptorColor(descriptor.color, t.isDark) : null;

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: p.validation?.hasOverMax ? t.destructive : t.border }]}>
      <Text style={[styles.name, { color: t.foreground }]} numberOfLines={2}>
        {segments.map((seg, i) => (
          <Text key={i} style={seg.match ? { backgroundColor: t.warningTint, color: t.warning } : undefined}>
            {seg.text}
          </Text>
        ))}
      </Text>

      {p.components.map((comp) => {
        const summary = compScores(p.enrollmentId, comp, own, p.highest);
        const columns = comp.items.length === 0 ? [{ id: comp.id, name: comp.name }] : comp.items;
        return (
          <View key={comp.id} style={styles.component}>
            <View style={styles.componentHeader}>
              <Text style={[styles.componentName, { color: t.primary }]} numberOfLines={1}>
                {comp.name} · {Math.round(comp.weightPercent * 100) / 100}%
              </Text>
              <Text style={[styles.componentStats, { color: t.muted }]}>
                Total {formatGrade(summary.total, 1)} · PS {formatGrade(summary.ps)} · WS {formatGrade(summary.ws)}
              </Text>
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
          </View>
        );
      })}

      <View style={[styles.summary, { backgroundColor: t.background, borderColor: t.border }]}>
        <Stat label="Initial Grade" value={formatGrade(ig)} />
        <Stat label="Final Grade" value={formatGrade(p.finalGrade, 0)} strong />
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: t.muted }]}>Descriptor</Text>
          <Text style={[styles.statValue, { color: descriptorTint ?? t.muted }]} numberOfLines={1}>
            {descriptor?.label ?? '—'}
          </Text>
        </View>
      </View>
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
  card: { borderWidth: 1.5, borderRadius: 16, padding: 14 },
  name: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  component: { marginBottom: 12 },
  componentHeader: { marginBottom: 8 },
  componentName: { fontSize: 13, fontWeight: '800' },
  componentStats: { fontSize: 11.5, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summary: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 4 },
  stat: { flex: 1 },
  statLabel: { fontSize: 11, fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },
});
