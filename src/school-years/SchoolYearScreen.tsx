import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, ListHeader, theme } from '../components/forms';
import { apiErrorMessage } from '../api';
import { SchoolYear, schoolYearsApi } from '../api/schoolYears';

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function SchoolYearScreen() {
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ListHeader title="School Year" subtitle={`${items.length} school year${items.length === 1 ? '' : 's'}`} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  list: { padding: 20, paddingTop: 4, gap: 12 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 18, fontWeight: '700', color: theme.text },
  detail: { marginTop: 6, fontSize: 14, color: theme.text },
  muted: { marginTop: 2, fontSize: 12.5, color: theme.muted },
  badge: { backgroundColor: '#D1FAE5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700', color: theme.success },
});
