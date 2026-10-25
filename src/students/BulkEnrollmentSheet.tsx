import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { EnrollmentRecord, enrollmentsApi } from '../api/enrollments';
import { GradeLevel } from '../api/gradeLevels';
import { SetupSchoolYear } from '../api/schoolYears';
import { Section } from '../api/sections';
import { formatStudentName, StudentRecord } from '../api/students';
import { FormActions, FormModal, SelectField } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { todayString } from '../school-setup/dates';
import {
  ENROLLMENT_TYPES,
  highestLevelByStudent,
  isValidEnrollmentDate,
  outsideWindowMessage,
  widenDate,
} from './enrollmentRules';

interface Props {
  visible: boolean;
  schoolYear: SetupSchoolYear;
  levels: GradeLevel[];
  sections: Section[];
  /** Every student, and every enrollment already loaded for the school year */
  students: StudentRecord[];
  enrollments: EnrollmentRecord[];
  isReadOnly: boolean;
  onClose: () => void;
}

export default function BulkEnrollmentSheet({
  visible,
  schoolYear,
  levels,
  sections,
  students,
  enrollments,
  isReadOnly,
  onClose,
}: Props) {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const [gradeLevelId, setGradeLevelId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [enrollmentType, setEnrollmentType] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setGradeLevelId('');
    setSectionId('');
    setEnrollmentType('');
    setSelected(new Set());
  }, [visible]);

  const today = todayString();
  const start = schoolYear.enrollmentStartDate;
  const end = schoolYear.enrollmentEndDate;
  const todayOutside = !isValidEnrollmentDate(today, start, end);

  const level = levels.find((l) => l.id === gradeLevelId);
  const sectionOptions = sections
    .filter((s) => s.gradeLevelId === gradeLevelId)
    .map((s) => ({ value: s.id, label: s.name }));

  // Eligible: not enrolled in this school year, and either never enrolled before or enrolled in
  // exactly the level below the target (the history is whatever enrollments are loaded)
  const eligible = useMemo(() => {
    if (!level) return [] as StudentRecord[];
    const levelById = new Map(levels.map((l) => [l.id, l.numericLevel]));
    const levelOfSection = new Map(sections.map((s) => [s.id, levelById.get(s.gradeLevelId) ?? 0]));
    const enrolledIds = new Set(enrollments.map((e) => e.studentId));
    const highest = highestLevelByStudent(enrollments, levelOfSection);
    return students.filter((s) => {
      if (enrolledIds.has(s.studentId)) return false;
      const previous = highest.get(s.studentId) ?? 0;
      return previous === 0 || previous === level.numericLevel - 1;
    });
  }, [level, levels, sections, students, enrollments]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    const fail = (message: string) => Alert.alert('Check the form', message);
    if (!gradeLevelId) return fail('Grade level is required');
    if (!sectionId) return fail('Section is required');
    if (selected.size === 0) return fail('Select at least one student');
    if (todayOutside && !enrollmentType)
      return fail('Enrollment Type is required when enrolling outside the enrollment period');

    // There is no bulk endpoint: one POST per student, in order, stopping at the first failure
    setSubmitting(true);
    let done = 0;
    let failure: unknown = null;
    for (const studentId of selected) {
      try {
        await enrollmentsApi.create({
          studentId,
          schoolYearSectionId: sectionId,
          enrollmentDate: widenDate(today),
          status: 'Enrolled',
          ...(enrollmentType ? { enrollmentType } : {}),
        });
        done += 1;
      } catch (error) {
        failure = error;
        break;
      }
    }
    setSubmitting(false);

    queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    queryClient.invalidateQueries({ queryKey: ['enrollments-all'] });

    if (failure) {
      Alert.alert(
        done > 0 ? `${done} student(s) enrolled` : 'Could not enroll students',
        apiErrorMessage(failure)
      );
      return;
    }
    Alert.alert('Enrolled', `${done} student(s) enrolled`);
    onClose();
  };

  return (
    <FormModal visible={visible} title="Bulk Enrollment" onClose={onClose}>
      <SelectField
        label="Grade Level *"
        value={gradeLevelId}
        options={levels.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` }))}
        placeholder="Select grade level"
        onChange={(v) => {
          setGradeLevelId(v);
          setSectionId('');
          setSelected(new Set());
        }}
      />
      <SelectField
        label="Section *"
        value={sectionId}
        options={sectionOptions}
        placeholder={gradeLevelId ? 'Select section' : 'Select grade level first'}
        disabled={!gradeLevelId}
        onChange={setSectionId}
      />

      {todayOutside && start && end && (
        <>
          <Text style={[styles.warning, { color: t.warning }]}>{outsideWindowMessage(start, end)}</Text>
          <SelectField
            label="Enrollment Type *"
            value={enrollmentType}
            options={ENROLLMENT_TYPES}
            placeholder="None"
            onChange={setEnrollmentType}
          />
        </>
      )}

      {level && (
        <View style={[styles.list, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={styles.listHeader}>
            <Text style={[styles.listTitle, { color: t.foreground }]}>Students ({eligible.length} not enrolled)</Text>
            <View style={styles.listActions}>
              <TouchableOpacity onPress={() => setSelected(new Set(eligible.map((s) => s.studentId)))}>
                <Text style={[styles.link, { color: t.primary }]}>Select all</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelected(new Set())}>
                <Text style={[styles.link, { color: t.muted }]}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          {eligible.length === 0 ? (
            <Text style={[styles.empty, { color: t.muted }]}>All students are enrolled.</Text>
          ) : (
            <FlatList
              data={eligible}
              keyExtractor={(s) => s.studentId}
              scrollEnabled={false}
              extraData={selected}
              renderItem={({ item }) => {
                const on = selected.has(item.studentId);
                return (
                  <TouchableOpacity
                    style={[styles.row, { borderTopColor: t.border }]}
                    activeOpacity={0.7}
                    onPress={() => toggle(item.studentId)}
                  >
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? t.primary : t.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { color: t.foreground }]}>{formatStudentName(item)}</Text>
                      <Text style={[styles.lrn, { color: t.muted }]}>LRN {item.lrn || '—'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      <FormActions
        confirmLabel={`Enroll (${selected.size})`}
        saving={submitting}
        onCancel={onClose}
        onConfirm={() => {
          if (isReadOnly) return Alert.alert('View only', 'The school year must be active to enroll students');
          void submit();
        }}
      />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  warning: { fontSize: 12.5, fontWeight: '600', marginBottom: 14 },
  list: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginBottom: 16 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  listTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  listActions: { flexDirection: 'row', gap: 16 },
  link: { fontSize: 13, fontWeight: '700' },
  empty: { textAlign: 'center', paddingVertical: 24, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 14.5, fontWeight: '600' },
  lrn: { fontSize: 12, marginTop: 1, fontFamily: 'Menlo' },
});
