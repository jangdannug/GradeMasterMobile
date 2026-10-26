import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDashboardTheme, type DashboardTheme } from '../dashboard/theme';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ListHeader } from '../components/forms';
import { apiErrorMessage } from '../api';
import { SchoolYear, schoolYearsApi } from '../api/schoolYears';

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function SchoolYearScreen() {
  const t = useDashboardTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const [items, setItems] = useState<SchoolYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await schoolYearsApi.list());
    } catch (e) {
      Alert.alert('Could not load school years', apiErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ListHeader subtitle={`${items.length} school year${items.length === 1 ? '' : 's'}`} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.schoolYearId}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={<EmptyState icon="calendar-outline" text="No school years yet" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.name}</Text>
                {item.isActive && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={styles.detail}>
                {fmt(item.startDate)} – {fmt(item.endDate)}
              </Text>
              <Text style={styles.muted}>
                Enrollment: {fmt(item.enrollmentStartDate)} – {fmt(item.enrollmentEndDate)}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (t: DashboardTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    list: { padding: 20, paddingTop: 4, gap: 12 },
    card: {
      backgroundColor: t.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    name: { fontSize: 18, fontWeight: '700', color: t.foreground },
    detail: { marginTop: 6, fontSize: 14, color: t.foreground },
    muted: { marginTop: 2, fontSize: 12.5, color: t.muted },
    badge: { backgroundColor: t.successTint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
    badgeText: { fontSize: 12, fontWeight: '700', color: t.success },
  });
