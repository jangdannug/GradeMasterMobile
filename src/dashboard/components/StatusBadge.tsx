import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SubmissionStatus } from '../dashboard-data';
import { useDashboardTheme } from '../theme';

export default function StatusBadge({ status }: { status: SubmissionStatus }) {
  const t = useDashboardTheme();
  const colors: Record<SubmissionStatus, { bg: string; fg: string }> = {
    Posted: { bg: t.successTint, fg: t.success },
    Pending: { bg: t.warningTint, fg: t.warning },
    Draft: { bg: t.secondaryTint, fg: t.muted },
  };
  const c = colors[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontSize: 11.5, fontWeight: '700' },
});
