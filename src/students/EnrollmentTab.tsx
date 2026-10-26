import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { academicKeys } from '../academic-setup/keys';
import { apiErrorMessage } from '../api';
import { EnrollmentRecord, enrollmentsApi } from '../api/enrollments';
import { gradeLevelsApi } from '../api/gradeLevels';
import { sectionsApi } from '../api/sections';
import { studentsApi } from '../api/students';
import {
  Badge,
  BadgeTone,
  confirmDestructive,
  DashedEmpty,
  SearchInput,
  SelectField,
  showRowMenu,
} from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { formatDate } from '../school-setup/dates';
import { useSchoolYears } from '../school-setup/hooks';
import { MoreButton } from '../school-setup/SetupParts';
import BulkEnrollmentSheet from './BulkEnrollmentSheet';
import EnrollmentFormSheet, { EnrollmentFormTarget } from './EnrollmentFormSheet';
import { datePart, ENROLLMENT_STATUSES, previousSchoolSummary } from './enrollmentRules';

const PAGE_SIZE = 20;
const TWO_MINUTES = 2 * 60 * 1000;

const statusTone = (status: string): BadgeTone => {
  switch (status) {
    case 'Enrolled':
      return 'success';
    case 'Transferred':
      return 'primary';
    case 'Dropped':
      return 'danger';
    default:
      return 'muted'; // Graduated, Not Enrolled
  }
};

const TYPE_LABELS: Record<string, string> = { LateEnrollee: 'Late Enrollee', TransferStudent: 'Transfer Student' };

export default function EnrollmentTab() {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { data: allYears = [] } = useSchoolYears();
  // Draft school years cannot take enrollments
  const schoolYears = useMemo(() => allYears.filter((sy) => !sy.isDraft), [allYears]);

  const [selectedId, setSelectedId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const onSearch = useCallback((term: string) => setSearch(term), []);

  const [formTarget, setFormTarget] = useState<EnrollmentFormTarget | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-select the active school year
  useEffect(() => {
    if (selectedId || schoolYears.length === 0) return;
    setSelectedId((schoolYears.find((sy) => sy.isActive) ?? schoolYears[0]).id);
  }, [schoolYears, selectedId]);

  const schoolYear = schoolYears.find((sy) => sy.id === selectedId);
  const isReadOnly = !schoolYear || !schoolYear.isActive || schoolYear.isLocked;

  // ---- Reference data (for names, pickers and the bulk sheet) ----------------------------------
  const { data: levels = [] } = useQuery({ queryKey: academicKeys.gradeLevels, queryFn: gradeLevelsApi.list });
  const { data: sections = [] } = useQuery({
    queryKey: ['sy-sections', selectedId],
    queryFn: () => sectionsApi.allForSchoolYear(selectedId),
    enabled: !!selectedId,
  });
  const { data: students = [] } = useQuery({
    queryKey: ['students-all'],
    queryFn: studentsApi.listAll,
    staleTime: TWO_MINUTES,
  });
  const { data: enrollmentsAll = [] } = useQuery({
    queryKey: ['enrollments-all', selectedId],
    queryFn: () => enrollmentsApi.listAll(selectedId),
    enabled: !!selectedId && bulkOpen,
  });

  const studentById = useMemo(() => new Map(students.map((s) => [s.studentId, s])), [students]);
  const sectionById = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const levelById = useMemo(() => new Map(levels.map((l) => [l.id, l])), [levels]);

  const studentLabel = (studentId: string) => {
    const s = studentById.get(studentId);
    return s ? `${s.lrn || 'No LRN'} · ${[s.lastName, s.firstName].filter(Boolean).join(', ')}` : 'Unknown';
  };
  const studentName = (studentId: string) => {
    const s = studentById.get(studentId);
    return s ? [s.lastName, s.firstName].filter(Boolean).join(', ') : 'Unknown';
  };

  // ---- The list: every filter is applied server-side -------------------------------------------
  const filters = { schoolYearId: selectedId, gradeLevelId: levelId, sectionId, status, search };
  const result = useInfiniteQuery({
    queryKey: ['enrollments', filters],
    queryFn: ({ pageParam }) => enrollmentsApi.paged(filters, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNextPage ? last.pageNumber + 1 : undefined),
    enabled: !!selectedId,
  });
  const enrollments = result.data?.pages.flatMap((p) => p.items) ?? [];
  const total = result.data?.pages[0]?.totalCount ?? 0;

  const remove = useMutation({
    mutationFn: (e: EnrollmentRecord) => enrollmentsApi.remove(e.id),
    onSuccess: () => {
      Alert.alert('Removed', 'Enrollment removed');
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments-all'] });
    },
    onError: (e) => Alert.alert('Could not remove enrollment', apiErrorMessage(e)),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await result.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const yearOptions = schoolYears.map((sy) => ({ value: sy.id, label: `${sy.name}${sy.isActive ? ' (Active)' : ''}` }));
  const sectionOptions = sections
    .filter((s) => s.gradeLevelId === levelId)
    .map((s) => ({ value: s.id, label: s.name }));

  const guardReadOnly = () => {
    if (!isReadOnly) return false;
    Alert.alert('View only', schoolYear?.isLocked ? 'The school year is locked' : 'The school year is not active');
    return true;
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={enrollments}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => result.hasNextPage && !result.isFetchingNextPage && result.fetchNextPage()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <SelectField
                label="School Year"
                value={selectedId}
                options={yearOptions}
                placeholder="Select a school year"
                onChange={(v) => {
                  setSelectedId(v);
                  setLevelId('');
                  setSectionId('');
                }}
              />
            </View>

            {schoolYear ? (
              <>
                {isReadOnly && (
                  <View style={[styles.note, { backgroundColor: t.secondaryTint, borderColor: t.border }]}>
                    <Ionicons name="lock-closed" size={15} color={t.muted} />
                    <Text style={[styles.noteText, { color: t.muted }]}>
                      {schoolYear.isLocked
                        ? 'Read-only — school year is locked'
                        : 'Read-only — school year is not active'}
                    </Text>
                  </View>
                )}
                {!!schoolYear.enrollmentStartDate && !!schoolYear.enrollmentEndDate && (
                  <Text style={[styles.period, { color: t.muted }]}>
                    Enrollment period: {formatDate(schoolYear.enrollmentStartDate)} →{' '}
                    {formatDate(schoolYear.enrollmentEndDate)}
                  </Text>
                )}

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.primary, { backgroundColor: t.primary }, isReadOnly && { opacity: 0.4 }]}
                    onPress={() => !guardReadOnly() && setFormTarget({ kind: 'create' })}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="person-add" size={17} color="#fff" />
                    <Text style={styles.primaryText}>Enroll</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondary, { borderColor: t.border, backgroundColor: t.card }, isReadOnly && { opacity: 0.4 }]}
                    onPress={() => !guardReadOnly() && setBulkOpen(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="people" size={17} color={t.primary} />
                    <Text style={[styles.secondaryText, { color: t.primary }]}>Bulk Enroll</Text>
                  </TouchableOpacity>
                </View>

                {/* Filters */}
                <SelectField
                  label="Grade Level"
                  value={levelId}
                  options={[{ value: '', label: 'All grade levels' }, ...levels.map((l) => ({ value: l.id, label: l.name }))]}
                  placeholder="All grade levels"
                  // Changing the level resets the section
                  onChange={(v) => {
                    setLevelId(v);
                    setSectionId('');
                  }}
                />
                <SelectField
                  label="Section"
                  value={sectionId}
                  options={[{ value: '', label: 'All sections' }, ...sectionOptions]}
                  placeholder={levelId ? 'All sections' : 'Select grade level first'}
                  disabled={!levelId}
                  onChange={setSectionId}
                />
                <SelectField
                  label="Status"
                  value={status}
                  options={[{ value: '', label: 'All statuses' }, ...ENROLLMENT_STATUSES.map((s) => ({ value: s, label: s }))]}
                  placeholder="All statuses"
                  onChange={setStatus}
                />
                <SearchInput placeholder="Search by student name" onSearch={onSearch} />
              </>
            ) : (
              <Text style={[styles.empty, { color: t.muted }]}>
                Select a school year and school to view enrollments
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          !schoolYear ? undefined : result.isLoading ? (
            <ActivityIndicator style={{ marginTop: 28 }} color={t.primary} />
          ) : (
            <DashedEmpty icon="document-text-outline" title="No enrollments match the selected filters." />
          )
        }
        ListFooterComponent={
          result.isFetchingNextPage ? (
            <ActivityIndicator style={{ margin: 16 }} color={t.primary} />
          ) : enrollments.length > 0 ? (
            <Text style={[styles.end, { color: t.muted }]}>
              {total} enrollment{total === 1 ? '' : 's'} · {result.hasNextPage ? 'Scroll to load more' : 'End of List'}
            </Text>
          ) : undefined
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const section = sectionById.get(item.schoolYearSectionId);
          const level = section ? levelById.get(section.gradeLevelId) : undefined;
          return (
            <EnrollmentCard
              enrollment={item}
              name={studentName(item.studentId)}
              levelName={level?.name ?? ''}
              sectionName={section?.name ?? ''}
              showActions={!isReadOnly}
              onEdit={() =>
                setFormTarget({ kind: 'edit', enrollment: item, studentLabel: studentLabel(item.studentId) })
              }
              onRemove={() =>
                confirmDestructive(
                  'Remove enrollment',
                  `${studentName(item.studentId)}'s enrollment will be removed.`,
                  () => remove.mutate(item),
                  'Remove'
                )
              }
            />
          );
        }}
      />

      {schoolYear && (
        <>
          <EnrollmentFormSheet
            target={formTarget}
            schoolYear={schoolYear}
            levels={levels}
            sections={sections}
            onClose={() => setFormTarget(null)}
          />
          <BulkEnrollmentSheet
            visible={bulkOpen}
            schoolYear={schoolYear}
            levels={levels}
            sections={sections}
            students={students}
            enrollments={enrollmentsAll}
            isReadOnly={isReadOnly}
            onClose={() => setBulkOpen(false)}
          />
        </>
      )}
    </View>
  );
}

function EnrollmentCard({
  enrollment,
  name,
  levelName,
  sectionName,
  showActions,
  onEdit,
  onRemove,
}: {
  enrollment: EnrollmentRecord;
  name: string;
  levelName: string;
  sectionName: string;
  showActions: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const t = useDashboardTheme();
  const shs = !!(enrollment.semester || enrollment.track || enrollment.strand);
  const placement = [levelName, sectionName].filter(Boolean).join(' · ');
  const date = datePart(enrollment.enrollmentDate);

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: t.foreground }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.meta, { color: t.muted }]}>{placement || '—'}</Text>
        </View>
        <Badge label={enrollment.status || 'Not Enrolled'} tone={statusTone(enrollment.status)} />
        {showActions && (
          <MoreButton
            onPress={() =>
              showRowMenu(name, [
                { label: 'Edit', onPress: onEdit },
                { label: 'Remove', destructive: true, onPress: onRemove },
              ])
            }
          />
        )}
      </View>

      <View style={styles.facts}>
        <Fact label="Date" value={date ? formatDate(date) : '—'} />
        <Fact label="Type" value={TYPE_LABELS[enrollment.enrollmentType] ?? (enrollment.enrollmentType || '—')} />
      </View>

      {!!enrollment.previousSchool?.lastSchoolAttended && (
        <TouchableOpacity
          onPress={() =>
            Alert.alert(enrollment.previousSchool!.lastSchoolAttended, previousSchoolSummary(enrollment.previousSchool!))
          }
          style={styles.previous}
        >
          <Ionicons name="school-outline" size={15} color={t.primary} />
          <Text style={[styles.previousText, { color: t.primary }]} numberOfLines={1}>
            {enrollment.previousSchool.lastSchoolAttended}
          </Text>
          <Ionicons name="information-circle-outline" size={15} color={t.muted} />
        </TouchableOpacity>
      )}

      {(enrollment.isReturning || shs) && (
        <View style={styles.flags}>
          {enrollment.isReturning && <Badge label="Balik-Aral" tone="warning" outline />}
          {shs && (
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Senior High',
                  `Semester: ${enrollment.semester || '—'} · Track: ${enrollment.track || '—'} · Strand: ${
                    enrollment.strand || '—'
                  }`
                )
              }
            >
              <Badge label="SHS" tone="primary" outline />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const t = useDashboardTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.factLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: t.foreground }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 3, fontSize: 13, lineHeight: 18 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 8 },
  noteText: { fontSize: 12.5, fontWeight: '600' },
  period: { fontSize: 12.5, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  primary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 12 },
  primaryText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  secondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 12, borderWidth: 1 },
  secondaryText: { fontSize: 14.5, fontWeight: '700' },
  empty: { marginTop: 24, textAlign: 'center', fontSize: 14 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15.5, fontWeight: '700' },
  meta: { marginTop: 2, fontSize: 12.5 },
  facts: { flexDirection: 'row', gap: 12, marginTop: 12 },
  factLabel: { fontSize: 11, fontWeight: '600' },
  factValue: { fontSize: 13.5, fontWeight: '600', marginTop: 2 },
  previous: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  previousText: { flex: 1, fontSize: 13, fontWeight: '600' },
  flags: { flexDirection: 'row', gap: 8, marginTop: 12 },
  end: { textAlign: 'center', fontSize: 12.5, paddingVertical: 16 },
});
