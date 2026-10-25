import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TopStudent } from '../dashboard-data';
import { useDashboardTheme } from '../theme';

export default function TopStudentRow({ student, last }: { student: TopStudent; last?: boolean }) {
  const t = useDashboardTheme();
  const rankColors =
    student.rank === 1
      ? { bg: t.warningTint, fg: t.warning }
      : student.rank === 2
        ? { bg: t.secondaryTint, fg: t.muted }
        : student.rank === 3
          ? { bg: t.destructiveTint, fg: t.destructive }
          : { bg: t.primaryTint, fg: t.primary };

  return (
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: t.border }]}>
      <View style={[styles.rank, { backgroundColor: rankColors.bg }]}>
        <Text style={[styles.rankText, { color: rankColors.fg }]}>{student.rank}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: t.foreground }]} numberOfLines={1}>
          {student.name}
        </Text>
        <Text style={[styles.sub, { color: t.muted }]}>
          {student.grade} - {student.section}
        </Text>
      </View>
      <View style={styles.score}>
        <Text style={[styles.avg, { color: t.foreground }]}>{student.average.toFixed(1)}</Text>
        <Text style={[styles.gwa, { color: t.muted }]}>GWA</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rank: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 14, fontWeight: '800' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { marginTop: 1, fontSize: 12.5 },
  score: { alignItems: 'flex-end' },
  avg: { fontSize: 17, fontWeight: '800' },
  gwa: { fontSize: 10.5, fontWeight: '600' },
});
