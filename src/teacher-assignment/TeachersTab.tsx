import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { UserProfile, userProfilesApi } from '../api/userProfiles';
import { Badge, BadgeTone, DashedEmpty, SearchInput } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { useSchools } from '../school-setup/hooks';
import { formatDate } from '../school-setup/dates';
import { useAuthStore } from '../stores/authStore';

const PAGE_SIZE = 50;

// "Permanent" reads as good news, anything probationary/temporary as a caution
const statusTone = (status: string): BadgeTone => {
  const s = status.toLowerCase();
  if (s.includes('permanent') || s.includes('regular') || s.includes('active')) return 'success';
  if (s.includes('probation') || s.includes('temporary') || s.includes('contract') || s.includes('casual')) return 'warning';
  if (s.includes('resign') || s.includes('terminat') || s.includes('retire') || s.includes('inactive')) return 'danger';
  return 'muted';
};

const nameOf = (p: UserProfile) => [p.lastName, p.firstName, p.middleName].filter(Boolean).join(', ') || p.email || '—';

export default function TeachersTab() {
  const t = useDashboardTheme();
  const authSchool = useAuthStore((s) => s.authSchool);
  const { data: schools } = useSchools();
  const schoolName = schools?.find((s) => s.schoolId === authSchool)?.name;

  const [query, setQuery] = useState('');
  const onSearch = useCallback((term: string) => setQuery(term), []);
  const [refreshing, setRefreshing] = useState(false);

  const result = useInfiniteQuery({
    queryKey: ['teachers-paged', query],
    queryFn: ({ pageParam }) => userProfilesApi.pagedTeachers(pageParam, query, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNextPage ? last.pageNumber + 1 : undefined),
  });

  const teachers = result.data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = result.data?.pages[0]?.totalCount ?? 0;
  const subtitle =
    totalCount > 0 ? `${totalCount} teaching staff${schoolName ? ` for ${schoolName}` : ''}` : 'Teaching staff';

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await result.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <FlatList
      data={teachers}
      keyExtractor={(p) => p.userProfileId}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      onEndReached={() => result.hasNextPage && !result.isFetchingNextPage && result.fetchNextPage()}
      onEndReachedThreshold={0.4}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.foreground }]}>Teacher Profiles</Text>
          <Text style={[styles.subtitle, { color: t.muted }]}>{subtitle}</Text>
          <View style={{ marginTop: 12 }}>
            <SearchInput placeholder="Search teachers" onSearch={onSearch} />
          </View>
        </View>
      }
      ListEmptyComponent={
        result.isLoading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={t.primary} />
        ) : (
          <DashedEmpty icon="id-card-outline" title="No teacher profiles found." />
        )
      }
      ListFooterComponent={
        result.isFetchingNextPage ? (
          <ActivityIndicator style={{ margin: 16 }} color={t.primary} />
        ) : teachers.length > 0 && !result.hasNextPage ? (
          <Text style={[styles.end, { color: t.muted }]}>End of list</Text>
        ) : undefined
      }
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => <TeacherCard teacher={item} />}
    />
  );
}

function TeacherCard({ teacher }: { teacher: UserProfile }) {
  const t = useDashboardTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[styles.name, { color: t.foreground }]} numberOfLines={1}>
        {nameOf(teacher)}
      </Text>
      <Text style={[styles.email, { color: t.muted }]} numberOfLines={1}>
        {teacher.email || '—'}
      </Text>

      <View style={styles.facts}>
        <Fact label="Employee No." value={teacher.employeeNumber || '—'} />
        <Fact label="Position" value={teacher.positionName || '—'} />
      </View>
      <View style={styles.facts}>
        <View style={styles.fact}>
          <Text style={[styles.factLabel, { color: t.muted }]}>Status</Text>
          {teacher.employmentStatus ? (
            <View style={{ alignSelf: 'flex-start', marginTop: 3 }}>
              <Badge label={teacher.employmentStatus} tone={statusTone(teacher.employmentStatus)} outline />
            </View>
          ) : (
            <Text style={[styles.factValue, { color: t.foreground }]}>—</Text>
          )}
        </View>
        <Fact label="Hired" value={teacher.hireDate ? formatDate(teacher.hireDate) : '—'} />
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const t = useDashboardTheme();
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: t.foreground }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 14 },
  title: { fontSize: 19, fontWeight: '800' },
  subtitle: { marginTop: 2, fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  name: { fontSize: 16, fontWeight: '700' },
  email: { marginTop: 2, fontSize: 12.5 },
  facts: { flexDirection: 'row', gap: 12, marginTop: 12 },
  fact: { flex: 1 },
  factLabel: { fontSize: 11, fontWeight: '600' },
  factValue: { fontSize: 13.5, fontWeight: '600', marginTop: 2 },
  end: { textAlign: 'center', fontSize: 12.5, paddingVertical: 16 },
});
