import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ClassSubjectOffering } from '../api/classSubjectOfferings';
import { GradeLevelSubject } from '../api/gradeLevels';
import { Section } from '../api/sections';
import { Badge, Option, SelectField } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { countSectionAssignments, findSubjectOffering, SectionOfferings } from './assignments';

const UNASSIGNED = '';

interface Props {
  section: Section;
  /** Membership rows of the level, plain subjects first */
  subjects: GradeLevelSubject[];
  sectionOfferings: SectionOfferings | undefined;
  glsBySubjectId: Map<string, string>;
  teacherOptions: Option[];
  teacherNameById: Map<string, string>;
  adviserBusy: boolean;
  /** An offering mutation for this section is in flight */
  offeringBusy: boolean;
  onAdviserChange: (section: Section, value: string) => void;
  onSubjectTeacherChange: (
    sectionId: string,
    gradeLevelSubjectId: string,
    offering: ClassSubjectOffering | undefined,
    value: string
  ) => void;
  onEdit: () => void;
  onRemove: () => void;
}

/** "Unassigned" + every teacher; keeps the current value selectable even when it is not in the roster */
function withCurrent(base: Option[], value: string, fallbackLabel: string): Option[] {
  const options: Option[] = [{ value: UNASSIGNED, label: 'Unassigned' }, ...base];
  if (value && !base.some((o) => o.value === value)) options.push({ value, label: fallbackLabel || 'Teacher' });
  return options;
}

export default function SectionCard({
  section,
  subjects,
  sectionOfferings,
  glsBySubjectId,
  teacherOptions,
  teacherNameById,
  adviserBusy,
  offeringBusy,
  onAdviserChange,
  onSubjectTeacherChange,
  onEdit,
  onRemove,
}: Props) {
  const t = useDashboardTheme();
  const counts = countSectionAssignments(subjects, sectionOfferings, glsBySubjectId);
  const hasSubjects = subjects.length > 0;

  const adviserOptions = withCurrent(
    teacherOptions,
    section.adviserTeacherProfileId,
    teacherNameById.get(section.adviserTeacherProfileId) ?? section.adviserName
  );

  const teacherFor = (offering: ClassSubjectOffering | undefined) => ({
    value: offering?.teacherProfileId ?? UNASSIGNED,
    fallback:
      teacherNameById.get(offering?.teacherProfileId ?? '') ??
      [offering?.teacherLastName, offering?.teacherFirstName].filter(Boolean).join(', '),
  });

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: t.foreground }]}>{section.name}</Text>
            {(adviserBusy || offeringBusy) && <ActivityIndicator size="small" color={t.primary} />}
          </View>
          {hasSubjects && (
            <View style={styles.badges}>
              {counts.assigned > 0 && <Badge label={`${counts.assigned} assigned`} tone="success" outline />}
              {counts.unassigned > 0 && <Badge label={`${counts.unassigned} unassigned`} tone="warning" outline />}
            </View>
          )}
          {!!section.description && <Text style={[styles.description, { color: t.muted }]}>{section.description}</Text>}
        </View>
        <TouchableOpacity style={styles.action} onPress={onEdit} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
          <Ionicons name="create-outline" size={20} color={t.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={onRemove} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
          <Ionicons name="trash-outline" size={20} color={t.destructive} />
        </TouchableOpacity>
      </View>

      {/* Adviser */}
      <SelectField
        label="Adviser"
        value={section.adviserTeacherProfileId}
        options={adviserOptions}
        placeholder="Unassigned"
        disabled={adviserBusy}
        onChange={(value) => onAdviserChange(section, value)}
      />

      {/* Subjects */}
      <Text style={[styles.sectionLabel, { color: t.primary }]}>Subjects</Text>
      {!hasSubjects ? (
        <Text style={[styles.muted, { color: t.muted }]}>No subjects assigned to this grade level.</Text>
      ) : (
        subjects.map((subject) => {
          if (subject.children.length === 0) {
            const offering = findSubjectOffering(sectionOfferings, subject.gradeLevelSubjectId, subject.subjectId);
            const current = teacherFor(offering);
            return (
              <View key={subject.subjectId} style={[styles.subject, { borderColor: t.border, backgroundColor: t.background }]}>
                <Text style={[styles.subjectName, { color: t.foreground }]}>{subject.subjectName}</Text>
                <Text style={[styles.code, { color: t.muted }]}>{subject.subjectCode}</Text>
                <SelectField
                  label="Assigned teacher"
                  value={current.value}
                  options={withCurrent(teacherOptions, current.value, current.fallback)}
                  placeholder="Unassigned"
                  onChange={(value) =>
                    onSubjectTeacherChange(section.id, subject.gradeLevelSubjectId, offering, value)
                  }
                />
              </View>
            );
          }

          // Composite: grouped block. Only its children are assignable.
          return (
            <View key={subject.subjectId} style={[styles.subject, { borderColor: t.border, backgroundColor: t.background }]}>
              <View style={styles.compositeHeader}>
                <Ionicons name="folder-open" size={18} color={t.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subjectName, { color: t.foreground }]}>{subject.subjectName}</Text>
                  <Text style={[styles.code, { color: t.muted }]}>{subject.subjectCode}</Text>
                </View>
                <Badge label="Composite" tone="primary" />
              </View>

              <View style={[styles.children, { borderLeftColor: t.border }]}>
                {subject.children.map((child) => {
                  const knownGls = glsBySubjectId.get(child.childSubjectId);
                  const offering = findSubjectOffering(sectionOfferings, knownGls, child.childSubjectId);
                  const gradeLevelSubjectId = knownGls ?? offering?.gradeLevelSubjectId;
                  const current = teacherFor(offering);
                  return (
                    <View key={child.childSubjectId} style={styles.child}>
                      <Text style={[styles.childName, { color: t.foreground }]}>{child.childSubjectName}</Text>
                      <Text style={[styles.code, { color: t.muted }]}>{child.childSubjectCode}</Text>
                      <SelectField
                        label="Assigned teacher"
                        value={current.value}
                        options={withCurrent(teacherOptions, current.value, current.fallback)}
                        placeholder="Unassigned"
                        disabled={!gradeLevelSubjectId}
                        onChange={(value) =>
                          gradeLevelSubjectId &&
                          onSubjectTeacherChange(section.id, gradeLevelSubjectId, offering, value)
                        }
                      />
                      {!gradeLevelSubjectId && (
                        <Text style={[styles.hint, { color: t.warning }]}>
                          Add this subject to the grade level before assigning a teacher.
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  description: { marginTop: 6, fontSize: 12.5, lineHeight: 18 },
  action: { padding: 6 },
  sectionLabel: { fontSize: 13.5, fontWeight: '800', marginBottom: 8 },
  muted: { fontSize: 13 },
  subject: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  subjectName: { fontSize: 14.5, fontWeight: '700' },
  code: { fontSize: 12, marginTop: 1, marginBottom: 10 },
  compositeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  children: { marginTop: 10, marginLeft: 6, paddingLeft: 12, borderLeftWidth: 2 },
  child: { marginBottom: 4 },
  childName: { fontSize: 13.5, fontWeight: '700' },
  hint: { fontSize: 12, marginTop: -6, marginBottom: 8 },
});
