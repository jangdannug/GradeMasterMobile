import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Submission } from '../dashboard-data';
import { useDashboardTheme } from '../theme';
import StatusBadge from './StatusBadge';

export default function SubmissionCard({ submission }: { submission: Submission }) {
  const t = useDashboardTheme();
  return (
    <View style={[styles.card, { borderColor: t.border, backgroundColor: t.background }]}>
      <View style={styles.main}>
        <Text style={[styles.student, { color: t.foreground }]} numberOfLines={1}>
          {submission.student}
        </Text>
        <Text style={[styles.subject, { color: t.muted }]} numberOfLines={1}>
          {submission.subject}
        </Text>
        <Text style={[styles.meta, { color: t.muted }]}>
          {submission.date} · {submission.id}
        </Text>
      </View>
      <View style={styles.side}>
        <Text style={[styles.grade, { color: t.foreground }]}>{submission.grade}</Text>
        <StatusBadge status={submission.status} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
  main: { flex: 1 },
  student: { fontSize: 15, fontWeight: '700' },
  subject: { marginTop: 1, fontSize: 13 },
  meta: { marginTop: 4, fontSize: 11.5 },
  side: { alignItems: 'flex-end', gap: 6 },
  grade: { fontSize: 20, fontWeight: '800' },
});
