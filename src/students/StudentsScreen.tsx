import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiErrorMessage } from '../api';
import { formatStudentName, StudentRecord, studentsApi } from '../api/students';
import { confirmDestructive, DashedEmpty, showRowMenu } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { formatDate } from '../school-setup/dates';
import { MoreButton } from '../school-setup/SetupParts';
import { useAuthStore } from '../stores/authStore';
import StudentDetailSheet from './StudentDetailSheet';
import StudentFormSheet, { StudentFormTarget } from './StudentFormSheet';

const PAGE_SIZE = 20;

/** Only school heads and admins manage students; teachers can list and view */
export const useCanManageStudents = () => useAuthStore((s) => s.user?.role !== 'Teacher');

/** Teacher tab: the same list, view only */
export default function StudentsScreen() {
  const t = useDashboardTheme();
  const canManage = useCanManageStudents();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.background }]} edges={[]}>
      <StudentRegistration canManage={canManage} />
    </SafeAreaView>
  );
}

export function StudentRegistration({
  canManage,
}: {
  canManage: boolean;
}) {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();

  // The search is applied on submit, so typing costs no requests
  const [term, setTerm] = useState('');
  const typed = useRef('');
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [hasText, setHasText] = useState(false);

  const [detail, setDetail] = useState<StudentRecord | null>(null);
  const [formTarget, setFormTarget] = useState<StudentFormTarget | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const result = useInfiniteQuery({
    queryKey: ['students', term],
    queryFn: async ({ pageParam }) => {
      const page = await studentsApi.paged(pageParam, term, PAGE_SIZE);
      // The server search only matches one field at a time ("Ramon Abad" finds nothing), so an
      // empty server result falls back to matching every word on the client
      if (pageParam === 1 && term && page.items.length === 0) {
        const matches = await studentsApi.searchAll(term);
        return {
          items: matches,
          pageNumber: 1,
          pageSize: matches.length,
          totalCount: matches.length,
          totalPages: 1,
          hasNextPage: false,
        };
      }
      return page;
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNextPage ? last.pageNumber + 1 : undefined),
  });

  const students = result.data?.pages.flatMap((p) => p.items) ?? [];
  const total = result.data?.pages[0]?.totalCount ?? 0;

  const remove = useMutation({
    mutationFn: (student: StudentRecord) => studentsApi.remove(student.studentId),
    onSuccess: () => {
      Alert.alert('Removed', 'Student removed');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students-all'] });
    },
    onError: (e) => Alert.alert('Could not remove student', apiErrorMessage(e)),
  });

  const submitSearch = () => setTerm(typed.current.trim());

  const clearSearch = () => {
    inputRef.current?.clear();
    typed.current = '';
    setHasText(false);
    setTerm('');
  };

  const askRemove = (student: StudentRecord) =>
    confirmDestructive(
      'Remove student',
      `${formatStudentName(student)} (${student.lrn || 'no LRN'}) will be permanently removed.`,
      () => remove.mutate(student),
      'Remove'
    );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await result.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={students}
        keyExtractor={(s) => s.studentId}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => result.hasNextPage && !result.isFetchingNextPage && result.fetchNextPage()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.titleRow, !canManage && { display: 'none' }]}>
              <View style={{ flex: 1 }} />
              {canManage && (
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: t.primary }]}
                  onPress={() => setFormTarget({ kind: 'create' })}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.addText}>Register</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.search, { backgroundColor: t.card, borderColor: t.border }]}>
              <Ionicons name="search" size={18} color={t.muted} />
              {/* Uncontrolled on purpose (a controlled field re-rendered with the list crashes Fabric) */}
              <TextInput
                ref={inputRef}
                style={[styles.searchInput, { color: t.foreground }]}
                placeholder="Search LRN or name..."
                placeholderTextColor="#94A3B8"
                onChangeText={(v) => {
                  typed.current = v;
                  setHasText(v.length > 0);
                }}
                onSubmitEditing={submitSearch}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              <TouchableOpacity style={{ opacity: hasText ? 1 : 0.35 }} onPress={submitSearch} disabled={!hasText}>
                <Text style={[styles.searchButton, { color: t.primary }]}>Search</Text>
              </TouchableOpacity>
            </View>

            {!!term && (
              <View style={styles.applied}>
                <Text style={[styles.appliedText, { color: t.muted }]} numberOfLines={1}>
                  Showing results for “{term}”
                </Text>
                <TouchableOpacity onPress={clearSearch}>
                  <Text style={[styles.clear, { color: t.primary }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.count, { color: t.muted }]}>
              {total} student{total === 1 ? '' : 's'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          result.isLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={t.primary} />
          ) : (
            <DashedEmpty
              icon="people-outline"
              title={term ? 'No students match your search.' : 'No students registered yet.'}
            />
          )
        }
        ListFooterComponent={
          result.isFetchingNextPage ? (
            <ActivityIndicator style={{ margin: 16 }} color={t.primary} />
          ) : students.length > 0 ? (
            <Text style={[styles.end, { color: t.muted }]}>{result.hasNextPage ? 'Scroll to load more' : 'End of List'}</Text>
          ) : undefined
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <StudentCard
            student={item}
            canManage={canManage}
            onOpen={() => setDetail(item)}
            onEdit={() => setFormTarget({ kind: 'edit', student: item })}
            onRemove={() => askRemove(item)}
          />
        )}
      />

      <StudentDetailSheet
        student={detail}
        canManage={canManage}
        onClose={() => setDetail(null)}
        onEdit={(student) => {
          setDetail(null);
          setFormTarget({ kind: 'edit', student });
        }}
      />
      {canManage && <StudentFormSheet target={formTarget} onClose={() => setFormTarget(null)} />}
    </View>
  );
}

function StudentCard({
  student,
  canManage,
  onOpen,
  onEdit,
  onRemove,
}: {
  student: StudentRecord;
  canManage: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const t = useDashboardTheme();
  const facts = [
    student.sex,
    student.birthDate ? formatDate(student.birthDate) : '',
    student.age != null ? `${student.age} yrs` : '',
  ].filter(Boolean);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}
      activeOpacity={0.75}
      onPress={onOpen}
    >
      <View style={[styles.avatar, { backgroundColor: t.primaryTint }]}>
        <Text style={[styles.avatarText, { color: t.primary }]}>
          {(student.firstName[0] ?? '') + (student.lastName[0] ?? '')}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: t.foreground }]} numberOfLines={1}>
          {formatStudentName(student)}
        </Text>
        <Text style={[styles.lrn, { color: t.muted }]}>LRN {student.lrn || '—'}</Text>
        {facts.length > 0 && <Text style={[styles.meta, { color: t.muted }]}>{facts.join(' · ')}</Text>}
        {(student.religion || student.cityMunicipality) && (
          <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
            {[student.religion, student.cityMunicipality].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>
      {canManage && (
        <MoreButton
          onPress={() =>
            showRowMenu(formatStudentName(student), [
              { label: 'Edit', onPress: onEdit },
              { label: 'Remove', destructive: true, onPress: onRemove },
            ])
          }
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 3, fontSize: 13, lineHeight: 18 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12 },
  addText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  searchButton: { fontSize: 14, fontWeight: '700' },
  applied: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  appliedText: { flex: 1, fontSize: 12.5 },
  clear: { fontSize: 13, fontWeight: '700', marginLeft: 12 },
  count: { marginTop: 12, fontSize: 12.5, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  name: { fontSize: 15.5, fontWeight: '700' },
  lrn: { marginTop: 2, fontSize: 12, fontFamily: 'Menlo' },
  meta: { marginTop: 2, fontSize: 12.5 },
  end: { textAlign: 'center', fontSize: 12.5, paddingVertical: 16 },
});
