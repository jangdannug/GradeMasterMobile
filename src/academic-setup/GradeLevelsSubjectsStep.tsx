import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../api';
import { gradeLevelsApi } from '../api/gradeLevels';
import { subjectsApi } from '../api/subjects';
import { Badge, confirmDestructive, DashedEmpty } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import { useAcademicSetup } from './AcademicSetupContext';
import { academicKeys } from './keys';
import SubjectFormModal, { SubjectFormMode, SubjectFormValues } from './SubjectFormModal';
import { ChildSubjectDetail, SubjectDetail } from './useAcademicSetupData';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const READ_ONLY_MESSAGE = 'School year must be an active, unlocked draft to change subjects';

export default function GradeLevelsSubjectsStep() {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const { levels, groups, subjectsByLevel, schoolYear, isReadOnly, isLoading } = useAcademicSetup();

  const [pickedLevelId, setPickedLevelId] = useState('');
  const [mode, setMode] = useState<SubjectFormMode | null>(null);

  // Default to the first grade level
  const level = levels.find((l) => l.id === pickedLevelId) ?? levels[0];
  const subjects = (level && subjectsByLevel.get(level.id)) || [];
  const subjectTotal = groups.find((g) => g.level.id === level?.id)?.subjects.length ?? 0;

  const levelCodes = useMemo(
    () =>
      subjects.flatMap((s) => [
        { subjectId: s.subjectId, code: s.code },
        ...s.children.map((c) => ({ subjectId: c.subjectId, code: c.code })),
      ]),
    [subjects]
  );

  const refreshLevel = () => {
    if (!level) return;
    queryClient.invalidateQueries({ queryKey: academicKeys.levelSubjects(level.id, schoolYear.id) });
    queryClient.invalidateQueries({ queryKey: academicKeys.subjects });
  };

  const save = useMutation({
    mutationFn: async (values: SubjectFormValues) => {
      if (!mode || !level) return;
      if (mode.kind === 'create') {
        const parentId = await gradeLevelsApi.createSubject(level.id, schoolYear.id, {
          code: values.code,
          name: values.name,
          description: values.description,
          units: values.units,
          isCore: true,
          isComposite: values.isComposite,
        });
        // The backend cannot attach inline children: add them one at a time to the new parent
        let failed = 0;
        for (let i = 0; i < values.children.length; i++) {
          try {
            await subjectsApi.addChild(parentId, {
              code: values.children[i].code,
              name: values.children[i].name,
              description: '',
              sequenceNo: i,
            });
          } catch {
            failed += 1;
          }
        }
        if (failed > 0) {
          Alert.alert(
            'Created with warnings',
            `${values.name} was created, but ${failed} child subject(s) could not be added.`
          );
        }
      } else if (mode.kind === 'edit') {
        await subjectsApi.update(mode.subject.subjectId, {
          code: values.code,
          name: values.name,
          description: values.description,
          units: values.units,
          isCore: mode.subject.isCore,
          isComposite: values.isComposite,
        });
      } else if (mode.kind === 'add-child') {
        await subjectsApi.addChild(mode.parent.subjectId, {
          code: values.code,
          name: values.name,
          description: values.description,
          sequenceNo: mode.parent.children.length,
        });
      } else {
        await subjectsApi.update(mode.child.subjectId, {
          code: values.code,
          name: values.name,
          description: values.description,
          units: values.units,
          isCore: mode.child.isCore,
          isComposite: false,
        });
      }
    },
    onSuccess: () => {
      setMode(null);
      refreshLevel();
    },
    onError: (e) => Alert.alert('Could not save subject', apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (subjectId: string) => subjectsApi.remove(subjectId),
    onSuccess: () => {
      refreshLevel();
      // A deleted subject disappears from every grading scheme too
      queryClient.invalidateQueries({ queryKey: ['scheme-subjects'] });
    },
    onError: (e) => Alert.alert('Could not delete subject', apiErrorMessage(e)),
  });

  const guard = (action: () => void) => () => {
    if (isReadOnly) {
      Alert.alert('View only', READ_ONLY_MESSAGE);
      return;
    }
    action();
  };

  const askDelete = (name: string, subjectId: string) =>
    confirmDestructive(
      'Delete subject',
      `"${name}" will be permanently deleted from the subject catalog, removed from every grade level and grading scheme.`,
      () => remove.mutate(subjectId)
    );

  if (isLoading && levels.length === 0) return <ActivityIndicator style={styles.loading} color={t.primary} />;

  return (
    <View>
      {/* Grade level chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {levels.map((l) => {
          const selected = l.id === level?.id;
          return (
            <TouchableOpacity
              key={l.id}
              onPress={() => setPickedLevelId(l.id)}
              style={[
                styles.chip,
                { borderColor: selected ? t.primary : t.border, backgroundColor: selected ? t.primary : t.card },
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? '#fff' : t.foreground }]}>{l.code}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {level && (
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={styles.levelHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.levelName, { color: t.foreground }]}>{level.name}</Text>
              <Text style={[styles.meta, { color: t.muted }]}>
                {level.code} · Level {level.numericLevel} · {subjectTotal} subject{subjectTotal === 1 ? '' : 's'}
              </Text>
              {!!level.description && <Text style={[styles.meta, { color: t.muted }]}>{level.description}</Text>}
            </View>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: t.primary }, isReadOnly && { opacity: 0.4 }]}
              onPress={guard(() => setMode({ kind: 'create' }))}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addButtonText}>Add Subject</Text>
            </TouchableOpacity>
          </View>

          {subjects.length === 0 ? (
            <DashedEmpty icon="book-outline" title="No subjects added yet." />
          ) : (
            subjects.map((subject) => (
              <SubjectCard
                key={subject.subjectId}
                subject={subject}
                disabled={isReadOnly}
                onAddChild={guard(() => setMode({ kind: 'add-child', parent: subject }))}
                onEdit={guard(() => setMode({ kind: 'edit', subject }))}
                onDelete={guard(() => askDelete(subject.name, subject.subjectId))}
                onEditChild={(child) => guard(() => setMode({ kind: 'edit-child', parent: subject, child }))()}
                onDeleteChild={(child) => guard(() => askDelete(child.name, child.subjectId))()}
              />
            ))
          )}
        </View>
      )}

      <SubjectFormModal
        mode={mode}
        levelCodes={levelCodes}
        saving={save.isPending}
        onClose={() => setMode(null)}
        onSubmit={(values) => save.mutate(values)}
      />
    </View>
  );
}

function IconButton({
  icon,
  color,
  onPress,
  disabled,
}: {
  icon: IconName;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.iconButton, disabled && { opacity: 0.35 }]}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
    >
      <Ionicons name={icon} size={20} color={color} />
    </TouchableOpacity>
  );
}

function SubjectCard({
  subject,
  disabled,
  onAddChild,
  onEdit,
  onDelete,
  onEditChild,
  onDeleteChild,
}: {
  subject: SubjectDetail;
  disabled: boolean;
  onAddChild: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditChild: (child: ChildSubjectDetail) => void;
  onDeleteChild: (child: ChildSubjectDetail) => void;
}) {
  const t = useDashboardTheme();
  const meta = [subject.code, subject.units != null ? `${subject.units} unit(s)` : ''].filter(Boolean).join(' · ');

  return (
    <View style={[styles.subject, { borderColor: t.border, backgroundColor: t.background }]}>
      <View style={styles.subjectRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.subjectName, { color: t.foreground }]}>{subject.name}</Text>
            {subject.isComposite && <Badge label="Composite" tone="primary" />}
          </View>
          <Text style={[styles.meta, { color: t.muted }]}>{meta}</Text>
          {!!subject.description && (
            <Text style={[styles.meta, { color: t.muted }]} numberOfLines={2}>
              {subject.description}
            </Text>
          )}
        </View>
        <View style={styles.actions}>
          {subject.isComposite && <IconButton icon="add-circle-outline" color={t.primary} onPress={onAddChild} disabled={disabled} />}
          <IconButton icon="create-outline" color={t.muted} onPress={onEdit} disabled={disabled} />
          <IconButton icon="trash-outline" color={t.destructive} onPress={onDelete} disabled={disabled} />
        </View>
      </View>

      {subject.children.length > 0 && (
        <View style={[styles.children, { borderLeftColor: t.border }]}>
          {subject.children.map((child) => (
            <View key={child.subjectId} style={[styles.childRow, { borderTopColor: t.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.childName, { color: t.foreground }]}>{child.name}</Text>
                <Text style={[styles.meta, { color: t.muted }]}>
                  {[child.code, child.units != null ? `${child.units} unit(s)` : ''].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <IconButton icon="create-outline" color={t.muted} onPress={() => onEditChild(child)} disabled={disabled} />
              <IconButton
                icon="trash-outline"
                color={t.destructive}
                onPress={() => onDeleteChild(child)}
                disabled={disabled}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 40 },
  chips: { gap: 8, paddingBottom: 14 },
  chip: { minWidth: 52, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5 },
  chipText: { fontSize: 14, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  levelHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  levelName: { fontSize: 19, fontWeight: '800' },
  meta: { marginTop: 3, fontSize: 12.5, lineHeight: 18 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12 },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  subject: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  subjectRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  subjectName: { fontSize: 15.5, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { padding: 6 },
  children: { marginTop: 10, marginLeft: 6, paddingLeft: 10, borderLeftWidth: 2 },
  childRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  childName: { fontSize: 14, fontWeight: '600' },
});
