import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton, DashedEmpty } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { findForm } from './forms';

/** One reusable "Coming soon" screen for SF1..SF10 (the route param is the form code) */
export default function FormPlaceholderScreen({ route }: { route: { params?: { code?: string } } }) {
  const t = useDashboardTheme();
  const form = findForm(route.params?.code);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={[]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.code, { color: t.primary }]}>{form?.code ?? 'School form'}</Text>
          <Text style={[styles.title, { color: t.foreground }]}>{form?.title ?? 'Unknown form'}</Text>
          <Text style={[styles.desc, { color: t.muted }]}>{form?.description}</Text>
        </View>
        <DashedEmpty icon="document-text-outline" title="Coming soon" />
        {/* Mirrors the web's inert "PDF Mapper" button: shown, disabled */}
        <PrimaryButton title="PDF Mapper" onPress={() => {}} disabled />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 16, gap: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  code: { fontSize: 13, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  desc: { fontSize: 13.5, lineHeight: 20, marginTop: 8 },
});
