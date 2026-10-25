import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SelectField } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { useSchoolYears } from '../school-setup/hooks';
import TeachersTab from './TeachersTab';
import TeachingAssignmentTab from './TeachingAssignmentTab';

type TabId = 'teachers' | 'assignment';

const TABS: { id: TabId; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { id: 'teachers', label: 'Teachers', icon: 'id-card' },
  { id: 'assignment', label: 'Teaching Assignment', icon: 'checkmark-done' },
];

export default function TeacherAssignmentScreen() {
  const t = useDashboardTheme();
  const { data: schoolYears = [] } = useSchoolYears();
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState<TabId>('teachers');

  // Auto-select the active school year (else the first one)
  useEffect(() => {
    if (selectedId || schoolYears.length === 0) return;
    setSelectedId((schoolYears.find((sy) => sy.isActive && !sy.isDraft) ?? schoolYears[0]).id);
  }, [schoolYears, selectedId]);

  const selected = schoolYears.find((sy) => sy.id === selectedId);
  const options = schoolYears.map((sy) => ({
    value: sy.id,
    label: `${sy.name}${sy.isActive && !sy.isDraft ? ' (Active)' : sy.isDraft ? ' (Draft)' : ''}`,
  }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.primary }]}>Teacher Assignment</Text>
        <Text style={[styles.subtitle, { color: t.muted }]}>
          Manage teacher assignments and adviser assignments per school year
        </Text>
      </View>

      <View style={styles.selector}>
        <SelectField
          label="School Year"
          value={selectedId}
          options={options}
          placeholder="Select a school year"
          onChange={setSelectedId}
        />
      </View>

      {selected ? (
        <>
          <View style={[styles.tabBar, { borderBottomColor: t.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
              {TABS.map((x) => {
                const active = x.id === tab;
                return (
                  <TouchableOpacity
                    key={x.id}
                    style={[styles.tab, active && { borderBottomColor: t.primary }]}
                    onPress={() => setTab(x.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={x.icon} size={17} color={active ? t.primary : t.muted} />
                    <Text style={[styles.tabLabel, { color: active ? t.primary : t.muted }]}>{x.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          <View style={styles.content}>
            {/* Keyed by school year so the assignment tab starts fresh when it changes */}
            {tab === 'teachers' ? <TeachersTab /> : <TeachingAssignmentTab key={selected.id} schoolYear={selected} />}
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="people-circle-outline" size={44} color={t.muted} />
          <Text style={[styles.emptyTitle, { color: t.foreground }]}>
            Select a school year above to manage its setup
          </Text>
          <Text style={[styles.emptyHint, { color: t.muted }]}>Configure teacher assignments and advisers.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  selector: { paddingHorizontal: 20, paddingTop: 6 },
  tabBar: { borderBottomWidth: 1 },
  tabBarContent: { paddingHorizontal: 12 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 13.5, fontWeight: '700' },
  content: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', textAlign: 'center' },
  emptyHint: { fontSize: 13, textAlign: 'center' },
});
