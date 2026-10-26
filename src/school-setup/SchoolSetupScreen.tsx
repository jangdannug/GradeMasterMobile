import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDashboardTheme } from '../dashboard/theme';
import DistrictsTab from './DistrictsTab';
import { useDistricts, useSchools, useSchoolYears } from './hooks';
import SchoolsTab from './SchoolsTab';
import SchoolYearsTab from './SchoolYearsTab';

type TabId = 'districts' | 'schools' | 'school-years';

const TABS: { id: TabId; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { id: 'districts', label: 'Districts', icon: 'flag' },
  { id: 'schools', label: 'Schools', icon: 'school' },
  { id: 'school-years', label: 'School Years', icon: 'calendar' },
];

export default function SchoolSetupScreen() {
  const t = useDashboardTheme();
  const [active, setActive] = useState<TabId>('schools');

  const { data: districts } = useDistricts();
  const { data: schools } = useSchools();
  const { data: schoolYears } = useSchoolYears();

  // Counts show nothing until the lists have loaded
  const counts: Record<TabId, number | undefined> = {
    districts: districts?.length,
    schools: schools?.length,
    'school-years': schoolYears?.length,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={[]}>
      <View style={[styles.tabBar, { borderBottomColor: t.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TABS.map((tab) => {
            const selected = tab.id === active;
            const count = counts[tab.id];
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, selected && { borderBottomColor: t.primary }]}
                onPress={() => setActive(tab.id)}
                activeOpacity={0.7}
              >
                <Ionicons name={tab.icon} size={16} color={selected ? t.primary : t.muted} />
                <Text style={[styles.tabLabel, { color: selected ? t.primary : t.muted }]}>{tab.label}</Text>
                {count !== undefined && (
                  <View style={[styles.count, { backgroundColor: selected ? t.primaryTint : t.secondaryTint }]}>
                    <Text style={[styles.countText, { color: selected ? t.primary : t.muted }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.content}>
        {active === 'districts' && <DistrictsTab />}
        {active === 'schools' && <SchoolsTab />}
        {active === 'school-years' && <SchoolYearsTab />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 4, fontSize: 13.5, lineHeight: 19 },
  tabBar: { borderBottomWidth: 1 },
  tabBarContent: { paddingHorizontal: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 13, fontWeight: '700' },
  count: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, alignItems: 'center' },
  countText: { fontSize: 11.5, fontWeight: '700' },
  content: { flex: 1 },
});
