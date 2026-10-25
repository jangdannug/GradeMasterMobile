import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { gradingDescriptorsApi } from '../api/gradingDescriptors';
import { transmutationApi } from '../api/transmutation';
import { useDashboardTheme } from '../dashboard/theme';
import { useAcademicSetup } from './AcademicSetupContext';
import DescriptorsTab from './DescriptorsTab';
import { academicKeys } from './keys';
import SchemesTab from './SchemesTab';
import TransmutationsTab from './TransmutationsTab';

type TabId = 'transmutations' | 'descriptors' | 'schemes';

/** Step 2: the "Grading System" card with Transmutations, Descriptors and Grading Schemes tabs */
export default function GradingSchemesStep() {
  const t = useDashboardTheme();
  const { schemes } = useAcademicSetup();
  const [tab, setTab] = useState<TabId>('schemes');

  const tables = useQuery({ queryKey: academicKeys.transmutationTables, queryFn: transmutationApi.list });
  const descriptors = useQuery({ queryKey: academicKeys.descriptorSets, queryFn: gradingDescriptorsApi.list });

  const tabs: { id: TabId; label: string; count: number | undefined }[] = [
    { id: 'transmutations', label: 'Transmutations', count: tables.data?.length },
    { id: 'descriptors', label: 'Descriptors', count: descriptors.data?.length },
    { id: 'schemes', label: 'Grading Schemes', count: schemes.length },
  ];

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.title, { color: t.foreground }]}>Grading System</Text>

      <View style={[styles.tabs, { backgroundColor: t.secondaryTint }]}>
        {tabs.map((x) => {
          const selected = x.id === tab;
          return (
            <TouchableOpacity
              key={x.id}
              style={[styles.tab, selected && { backgroundColor: t.card }]}
              onPress={() => setTab(x.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.tabLabel, { color: selected ? t.primary : t.muted }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {x.label}
              </Text>
              {x.count !== undefined && (
                <View style={[styles.count, { backgroundColor: selected ? t.primaryTint : t.card }]}>
                  <Text style={[styles.countText, { color: selected ? t.primary : t.muted }]}>{x.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'transmutations' && <TransmutationsTab />}
      {tab === 'descriptors' && <DescriptorsTab />}
      {tab === 'schemes' && <SchemesTab />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  tabs: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 16, gap: 4 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 9,
  },
  tabLabel: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  count: { minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, alignItems: 'center' },
  countText: { fontSize: 10.5, fontWeight: '700' },
});
