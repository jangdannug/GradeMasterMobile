import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { EnrollmentRecord, enrollmentsApi } from '../api/enrollments';
import { GradeLevel } from '../api/gradeLevels';
import { SetupSchoolYear } from '../api/schoolYears';
import { Section } from '../api/sections';
import { studentsApi } from '../api/students';
import {
  CheckRow,
  DateField,
  Field,
  FormActions,
  FormModal,
  SectionHeader,
  SelectField,
} from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { todayString } from '../school-setup/dates';
import {
  buildEnrollmentPayload,
  emptyEnrollmentForm,
  ENROLLMENT_STATUSES,
  ENROLLMENT_TYPES,
  EnrollmentFormState,
  formFromEnrollment,
  isShsLevel,
  isValidEnrollmentDate,
  outsideWindowMessage,
  SEMESTERS,
  validateEnrollmentForm,
} from './enrollmentRules';

export type EnrollmentFormTarget = { kind: 'create' } | { kind: 'edit'; enrollment: EnrollmentRecord; studentLabel: string };

interface Props {
  target: EnrollmentFormTarget | null;
  schoolYear: SetupSchoolYear;
  levels: GradeLevel[];
  /** Every section of the school year */
  sections: Section[];
  onClose: () => void;
}

export default function EnrollmentFormSheet({ target, schoolYear, levels, sections, onClose }: Props) {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EnrollmentFormState>(() => emptyEnrollmentForm(todayString()));

  useEffect(() => {
    if (!target) return;
    if (target.kind === 'edit') {
      const section = sections.find((s) => s.id === target.enrollment.schoolYearSectionId);
      setForm(formFromEnrollment(target.enrollment, target.studentLabel, section?.gradeLevelId ?? ''));
    } else {
      setForm(emptyEnrollmentForm(todayString()));
    }
  }, [target, sections]);

  const editing = target?.kind === 'edit';
  const level = levels.find((l) => l.id === form.gradeLevelId);
  const shs = isShsLevel(level);
  const start = schoolYear.enrollmentStartDate;
  const end = schoolYear.enrollmentEndDate;
  const outside = !!form.date && !isValidEnrollmentDate(form.date, start, end);
  const typeRequired = outside;

  const sectionOptions = useMemo(
    () =>
      sections
        .filter((s) => s.gradeLevelId === form.gradeLevelId)
        .map((s) => ({ value: s.id, label: s.name })),
    [sections, form.gradeLevelId]
  );

  const save = useMutation({
    mutationFn: () => {
      const payload = buildEnrollmentPayload(form, {
        shs,
        editing: !!editing,
        hadPreviousSchool: !!(target?.kind === 'edit' && target.enrollment.previousSchool),
      });
      return target?.kind === 'edit'
        ? enrollmentsApi.update(target.enrollment.id, payload)
        : enrollmentsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments-all'] });
      Alert.alert('Saved', editing ? 'Enrollment updated' : 'Student enrolled');
      onClose();
    },
    onError: (e) => Alert.alert('Could not save enrollment', apiErrorMessage(e)),
  });

  if (!target) return null;

  const set = (patch: Partial<EnrollmentFormState>) => setForm((f) => ({ ...f, ...patch }));

  const submit = () => {
    const problem = validateEnrollmentForm(form, { start, end });
    if (problem) return Alert.alert('Check the form', problem);
    save.mutate();
  };

  return (
    <FormModal visible title={editing ? 'Edit Enrollment' : 'Enroll Student'} onClose={onClose}>
      <StudentPicker
        value={form.studentId ? { id: form.studentId, label: form.studentLabel } : null}
        disabled={!!editing}
        onChange={(s) => set({ studentId: s.id, studentLabel: s.label })}
      />

      <SelectField
        label="Grade Level *"
        value={form.gradeLevelId}
        options={levels.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` }))}
        placeholder="Select grade level"
        // Changing the level clears the section
        onChange={(v) => set({ gradeLevelId: v, sectionId: '' })}
      />
      <SelectField
        label="Section *"
        value={form.sectionId}
        options={sectionOptions}
        placeholder={form.gradeLevelId ? 'Select section' : 'Select grade level first'}
        disabled={!form.gradeLevelId}
        onChange={(v) => set({ sectionId: v })}
      />

      <DateField label="Enrollment Date *" value={form.date} onChange={(v) => set({ date: v })} />
      {outside && start && end && (
        <Text style={[styles.warning, { color: t.warning }]}>{outsideWindowMessage(start, end)}</Text>
      )}

      <SelectField
        label="Status"
        value={form.status}
        options={ENROLLMENT_STATUSES.map((s) => ({ value: s, label: s }))}
        onChange={(v) => set({ status: v })}
      />
      <SelectField
        label={typeRequired ? 'Enrollment Type *' : 'Enrollment Type'}
        value={form.enrollmentType}
        options={ENROLLMENT_TYPES}
        placeholder="None"
        onChange={(v) => set({ enrollmentType: v })}
      />

      {form.enrollmentType === 'TransferStudent' && (
        <View style={[styles.block, { backgroundColor: t.card, borderColor: t.border }]}>
          <SectionHeader title="Previous School" />
          <SelectField
            label="Last Grade Level Completed *"
            value={form.lastGradeLevelCompleted}
            // A prefilled value stays selectable even when it is no longer in the catalog
            options={levels.map((l) => ({ value: l.name, label: l.name }))}
            placeholder="Select grade level"
            onChange={(v) => set({ lastGradeLevelCompleted: v })}
          />
          <Field
            label="Last School Attended *"
            value={form.lastSchoolAttended}
            onChangeText={(v) => set({ lastSchoolAttended: v })}
            maxLength={255}
          />
          <Field
            label="Last School ID"
            value={form.lastSchoolId}
            onChangeText={(v) => set({ lastSchoolId: v })}
            maxLength={50}
          />
          <Field
            label="Last School Year Completed *"
            value={form.lastSchoolYearCompleted}
            onChangeText={(v) => set({ lastSchoolYearCompleted: v.replace(/\D/g, '').slice(0, 4) })}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="e.g. 2025"
          />
        </View>
      )}

      {shs && (
        <View style={[styles.block, { backgroundColor: t.card, borderColor: t.border }]}>
          <SectionHeader title="Senior High" />
          <SelectField
            label="Semester"
            value={form.semester}
            options={SEMESTERS}
            placeholder="None"
            onChange={(v) => set({ semester: v })}
          />
          <Field label="Track" value={form.track} onChangeText={(v) => set({ track: v })} maxLength={100} />
          <Field label="Strand" value={form.strand} onChangeText={(v) => set({ strand: v })} maxLength={100} />
        </View>
      )}

      <CheckRow
        label="Returning learner (Balik-Aral)"
        checked={form.isReturning}
        onChange={(v) => set({ isReturning: v })}
      />

      <FormActions
        confirmLabel={editing ? 'Update' : 'Enroll'}
        saving={save.isPending}
        onCancel={onClose}
        onConfirm={submit}
      />
    </FormModal>
  );
}

// ---------------------------------------------------------------------------------------------
// Remote student search: nothing is fetched until a term is submitted
// ---------------------------------------------------------------------------------------------

interface PickedStudent {
  id: string;
  label: string;
}

function StudentPicker({
  value,
  disabled,
  onChange,
}: {
  value: PickedStudent | null;
  disabled: boolean;
  onChange: (student: PickedStudent) => void;
}) {
  const t = useDashboardTheme();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const typed = useRef('');
  const [hasText, setHasText] = useState(false);

  const result = useInfiniteQuery({
    queryKey: ['students-remote', term],
    queryFn: ({ pageParam }) => studentsApi.paged(pageParam, term, 20),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNextPage ? last.pageNumber + 1 : undefined),
    enabled: open && !!term,
  });
  const students = result.data?.pages.flatMap((p) => p.items) ?? [];

  const close = () => {
    setOpen(false);
    setTerm('');
    typed.current = '';
    setHasText(false);
  };
  const submitSearch = () => setTerm(typed.current.trim());

  return (
    <View style={styles.pickerWrap}>
      <Text style={[styles.pickerLabel, { color: t.muted }]}>Student *</Text>
      <TouchableOpacity
        style={[
          styles.pickerBox,
          { backgroundColor: t.card, borderColor: t.border },
          disabled && { opacity: 0.55 },
        ]}
        disabled={disabled}
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.pickerText, { color: value ? t.foreground : '#94A3B8' }]} numberOfLines={1}>
          {value ? value.label : 'Search for a student'}
        </Text>
        <Ionicons name="search" size={18} color={t.muted} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <KeyboardAvoidingView
          style={[styles.sheet, { backgroundColor: t.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: t.primary }]}>Student</Text>
            <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={26} color={t.muted} />
            </TouchableOpacity>
          </View>

          <View style={[styles.search, { backgroundColor: t.card, borderColor: t.border }]}>
            <Ionicons name="search" size={18} color={t.muted} />
            {/* Uncontrolled and submit-only */}
            <TextInput
              style={[styles.searchInput, { color: t.foreground }]}
              placeholder="Name or LRN"
              placeholderTextColor="#94A3B8"
              autoFocus
              onChangeText={(v) => {
                typed.current = v;
                setHasText(v.length > 0);
              }}
              onSubmitEditing={submitSearch}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <TouchableOpacity style={{ opacity: hasText ? 1 : 0.35 }} disabled={!hasText} onPress={submitSearch}>
              <Text style={[styles.searchButton, { color: t.primary }]}>Search</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: t.muted }]}>Enter a name or LRN, then click Search</Text>

          <FlatList
            data={students}
            keyExtractor={(s) => s.studentId}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.results}
            onEndReached={() => result.hasNextPage && !result.isFetchingNextPage && result.fetchNextPage()}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={
              // The chosen student stays visible even after the query changes
              value ? (
                <View style={[styles.selected, { backgroundColor: t.primaryTint, borderColor: t.primary }]}>
                  <Ionicons name="checkmark-circle" size={20} color={t.primary} />
                  <Text style={[styles.selectedText, { color: t.foreground }]} numberOfLines={1}>
                    {value.label}
                  </Text>
                </View>
              ) : undefined
            }
            ListEmptyComponent={
              !term ? undefined : result.isLoading ? (
                <ActivityIndicator style={{ marginTop: 24 }} color={t.primary} />
              ) : (
                <Text style={[styles.empty, { color: t.muted }]}>No students found.</Text>
              )
            }
            ListFooterComponent={
              result.isFetchingNextPage ? <ActivityIndicator style={{ margin: 12 }} color={t.primary} /> : undefined
            }
            renderItem={({ item }) => {
              const label = `${item.lrn || 'No LRN'} · ${[item.lastName, item.firstName].filter(Boolean).join(', ')}`;
              return (
                <TouchableOpacity
                  style={[styles.result, { borderBottomColor: t.border }]}
                  onPress={() => {
                    onChange({ id: item.studentId, label });
                    close();
                  }}
                >
                  <Text style={[styles.resultText, { color: t.foreground }]}>{label}</Text>
                  {value?.id === item.studentId && <Ionicons name="checkmark" size={20} color={t.primary} />}
                </TouchableOpacity>
              );
            }}
          />
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  warning: { fontSize: 12.5, fontWeight: '600', marginTop: -6, marginBottom: 14 },
  block: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  pickerWrap: { marginBottom: 14 },
  pickerLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  pickerBox: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pickerText: { flex: 1, fontSize: 15 },
  sheet: { flex: 1 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 8 },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  searchButton: { fontSize: 14, fontWeight: '700' },
  hint: { marginHorizontal: 20, marginTop: 8, fontSize: 12.5 },
  results: { padding: 20, paddingTop: 12, paddingBottom: 40 },
  selected: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  selectedText: { flex: 1, fontSize: 14, fontWeight: '700' },
  result: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  resultText: { flex: 1, fontSize: 14.5 },
  empty: { textAlign: 'center', paddingVertical: 28, fontSize: 14 },
});
