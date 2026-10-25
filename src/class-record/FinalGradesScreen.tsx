import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DashedEmpty } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';

/** The web page only shows hard-coded sample rows, so this stays a placeholder until there is a real feature */
export default function FinalGradesScreen() {
  const t = useDashboardTheme();
  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={styles.body}>
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.title, { color: t.foreground }]}>Final Grades</Text>
        <Text style={[styles.desc, { color: t.muted }]}>Final grades of learners per subject and grading period.</Text>
      </View>
      <DashedEmpty icon="ribbon-outline" title="Coming soon" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  title: { fontSize: 20, fontWeight: '800' },
  desc: { fontSize: 13.5, lineHeight: 20, marginTop: 6 },
});
