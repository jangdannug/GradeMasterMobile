import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage, PagedResult } from '../api';
import { ClassSubjectOffering, classSubjectOfferingsApi } from '../api/classSubjectOfferings';
import { gradeLevelsApi } from '../api/gradeLevels';
import { Section, sectionsApi } from '../api/sections';
import { SetupSchoolYear } from '../api/schoolYears';
import { teacherLabel, userProfilesApi } from '../api/userProfiles';
import { academicKeys } from '../academic-setup/keys';
import { confirmDestructive, DashedEmpty, Option } from '../components/forms';
import { useDashboardTheme } from '../dashboard/theme';
import {
  buildGradeLevelSubjectIdBySubjectId,
  buildOfferingsBySection,
  NO_TEACHER,
  orderSubjects,
  withTeacher,
} from './assignments';
import SectionCard from './SectionCard';
import SectionFormModal, { SectionFormTarget, SectionFormValues } from './SectionFormModal';

const OFFERINGS_KEY = ['class-subject-offerings'] as const;
const FIVE_MINUTES = 5 * 60 * 1000;

type SectionPages = InfiniteData<PagedResult<Section>, number>;

export default function TeachingAssignmentTab({ schoolYear }: { schoolYear: SetupSchoolYear }) {
  const t = useDashboardTheme();
  const queryClient = useQueryClient();
  const [pickedLevelId, setPickedLevelId] = useState('');
  const [formTarget, setFormTarget] = useState<SectionFormTarget | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ---- Data -----------------------------------------------------------------------------------
  const { data: levels = [], isLoading: loadingLevels } = useQuery({
    queryKey: academicKeys.gradeLevels,
    queryFn: gradeLevelsApi.list,
  });
  const level = levels.find((l) => l.id === pickedLevelId) ?? levels[0];
  const levelId = level?.id ?? '';

  const sectionsKey = ['sections', schoolYear.id, levelId] as const;
  const sectionsQuery = useInfiniteQuery({
    queryKey: sectionsKey,
    queryFn: ({ pageParam }) =>
      sectionsApi.paged({ schoolYearId: schoolYear.id, gradeLevelId: levelId, pageNumber: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNextPage ? last.pageNumber + 1 : undefined),
    enabled: !!levelId,
  });
  const sections = sectionsQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const totalSections = sectionsQuery.data?.pages[0]?.totalCount ?? 0;

  const subjectsQuery = useQuery({
    queryKey: academicKeys.levelSubjects(levelId, schoolYear.id),
    queryFn: () => gradeLevelsApi.subjects(levelId, schoolYear.id),
    enabled: !!levelId,
  });
  const subjects = useMemo(() => orderSubjects(subjectsQuery.data ?? []), [subjectsQuery.data]);
  const glsBySubjectId = useMemo(
    () => buildGradeLevelSubjectIdBySubjectId(subjectsQuery.data ?? []),
    [subjectsQuery.data]
  );

  const offeringsQuery = useQuery({ queryKey: OFFERINGS_KEY, queryFn: classSubjectOfferingsApi.list });
  const offeringsBySection = useMemo(() => buildOfferingsBySection(offeringsQuery.data ?? []), [offeringsQuery.data]);

  const teachersQuery = useQuery({
    queryKey: ['teachers-all'],
    queryFn: userProfilesApi.allTeachers,
    staleTime: FIVE_MINUTES,
  });
  const teachers = teachersQuery.data ?? [];
  const teacherOptions: Option[] = useMemo(
    () => teachers.map((tc) => ({ value: tc.userProfileId, label: teacherLabel(tc) })),
    [teachers]
  );
  const teacherById = useMemo(() => new Map(teachers.map((tc) => [tc.userProfileId, tc])), [teachers]);
  const teacherNameById = useMemo(
    () => new Map(teachers.map((tc) => [tc.userProfileId, teacherLabel(tc)])),
    [teachers]
  );

  // ---- Cache patches (in place, to avoid refetch flicker) -------------------------------------
  const patchSection = (sectionId: string, patch: Partial<Section>) =>
    queryClient.setQueryData<SectionPages>(sectionsKey, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
            })),
          }
        : old
    );

  /** Applies a teacher change to one cached offering; false when it is not in the cache */
  const patchOffering = (
    offeringId: string,
    teacher: { teacherProfileId: string; teacherFirstName: string; teacherLastName: string }
  ) => {
    let found = false;
    queryClient.setQueryData<ClassSubjectOffering[]>(OFFERINGS_KEY, (old) =>
      old?.map((o) => {
        if (o.id !== offeringId) return o;
        found = true;
        return withTeacher(o, teacher);
      })
    );
    return found;
  };

  const teacherFields = (teacherId: string, fromServer?: ClassSubjectOffering | null) => {
    const profile = teacherById.get(teacherId);
    return {
      teacherProfileId: teacherId,
      teacherFirstName: fromServer?.teacherFirstName || profile?.firstName || '',
      teacherLastName: fromServer?.teacherLastName || profile?.lastName || '',
    };
  };

  // ---- Mutations ------------------------------------------------------------------------------
  const assignAdviser = useMutation({
    mutationFn: (v: { sectionId: string; teacherId: string }) => sectionsApi.assignAdviser(v.sectionId, v.teacherId),
    onSuccess: (_, v) =>
      patchSection(v.sectionId, { adviserTeacherProfileId: v.teacherId, adviserName: teacherNameById.get(v.teacherId) ?? '' }),
    onError: (e) => Alert.alert('Could not assign adviser', apiErrorMessage(e)),
  });

  const unassignAdviser = useMutation({
    mutationFn: (v: { sectionId: string }) => sectionsApi.unassignAdviser(v.sectionId),
    onSuccess: (_, v) => patchSection(v.sectionId, { adviserTeacherProfileId: '', adviserName: '' }),
    onError: (e) => Alert.alert('Could not unassign adviser', apiErrorMessage(e)),
  });

  const assignSubjectTeacher = useMutation({
    mutationFn: async (v: { sectionId: string; offeringId: string; teacherId: string }) =>
      classSubjectOfferingsApi.assignTeacher(v.offeringId, v.teacherId),
    onSuccess: (row, v) => {
      if (!patchOffering(v.offeringId, teacherFields(v.teacherId, row))) {
        queryClient.invalidateQueries({ queryKey: OFFERINGS_KEY });
      }
    },
    onError: (e) => Alert.alert('Could not assign teacher', apiErrorMessage(e)),
  });

  const unassignSubjectTeacher = useMutation({
    mutationFn: (v: { sectionId: string; offeringId: string }) => classSubjectOfferingsApi.unassignTeacher(v.offeringId),
    onSuccess: (_, v) => {
      if (!patchOffering(v.offeringId, NO_TEACHER)) queryClient.invalidateQueries({ queryKey: OFFERINGS_KEY });
    },
    onError: (e) => Alert.alert('Could not unassign teacher', apiErrorMessage(e)),
  });

  const createOffering = useMutation({
    mutationFn: async (v: { sectionId: string; gradeLevelSubjectId: string; teacherId: string }) => {
      try {
        return await classSubjectOfferingsApi.create({
          schoolYearSectionId: v.sectionId,
          gradeLevelSubjectId: v.gradeLevelSubjectId,
          teacherProfileId: v.teacherId,
        });
      } catch (error: any) {
        // The backend creates offerings itself, so a 409 means it already exists: assign through it
        if (error?.response?.status !== 409) throw error;
        const fresh = await classSubjectOfferingsApi.list();
        const existing = fresh.find(
          (o) => o.schoolYearSectionId === v.sectionId && o.gradeLevelSubjectId === v.gradeLevelSubjectId
        );
        if (!existing) throw error;
        const row = await classSubjectOfferingsApi.assignTeacher(existing.id, v.teacherId);
        queryClient.setQueryData<ClassSubjectOffering[]>(
          OFFERINGS_KEY,
          fresh.map((o) => (o.id === existing.id ? withTeacher(o, teacherFields(v.teacherId, row)) : o))
        );
        return null;
      }
    },
    onSuccess: (row, v) => {
      if (row) {
        // Add the new row in place; if the response had no subject details, take them from the level
        queryClient.setQueryData<ClassSubjectOffering[]>(OFFERINGS_KEY, (old = []) => [
          ...old.filter((o) => o.id !== row.id),
          { ...row, ...teacherFields(v.teacherId, row) },
        ]);
      }
    },
    onError: (e) => {
      queryClient.invalidateQueries({ queryKey: OFFERINGS_KEY });
      Alert.alert('Could not assign teacher', apiErrorMessage(e));
    },
  });

  const saveSection = useMutation({
    mutationFn: async (values: SectionFormValues) => {
      const input = { schoolYearId: schoolYear.id, gradeLevelId: values.gradeLevelId, name: values.name, description: values.description };
      if (formTarget?.kind === 'edit') await sectionsApi.update(formTarget.section.id, input);
      else await sectionsApi.create(input);
    },
    onSuccess: () => {
      Alert.alert('Saved', formTarget?.kind === 'edit' ? 'Section updated' : 'Section added');
      setFormTarget(null);
      queryClient.invalidateQueries({ queryKey: ['sections', schoolYear.id] });
      // The backend creates an offering per subject for every new section
      queryClient.invalidateQueries({ queryKey: OFFERINGS_KEY });
    },
    onError: (e) => Alert.alert('Could not save section', apiErrorMessage(e)),
  });

  const removeSection = useMutation({
    mutationFn: (section: Section) => sectionsApi.remove(section.id),
    onSuccess: () => {
      Alert.alert('Removed', 'Section removed');
      queryClient.invalidateQueries({ queryKey: ['sections', schoolYear.id] });
      queryClient.invalidateQueries({ queryKey: OFFERINGS_KEY });
    },
    onError: (e) => Alert.alert('Could not remove section', apiErrorMessage(e)),
  });

  // ---- Handlers -------------------------------------------------------------------------------
  const onAdviserChange = (section: Section, value: string) => {
    if (!value) {
      // Unassigning only makes sense when an adviser is currently set
      if (!section.adviserTeacherProfileId) return;
      unassignAdviser.mutate({ sectionId: section.id });
    } else {
      assignAdviser.mutate({ sectionId: section.id, teacherId: value });
    }
  };

  const onSubjectTeacherChange = (
    sectionId: string,
    gradeLevelSubjectId: string,
    offering: ClassSubjectOffering | undefined,
    value: string
  ) => {
    if (!value) {
      if (!offering?.id || !offering.teacherProfileId) return;
      unassignSubjectTeacher.mutate({ sectionId, offeringId: offering.id });
    } else if (offering?.id) {
      assignSubjectTeacher.mutate({ sectionId, offeringId: offering.id, teacherId: value });
    } else {
      createOffering.mutate({ sectionId, gradeLevelSubjectId, teacherId: value });
    }
  };

  const askRemove = (section: Section) =>
    confirmDestructive(
      'Remove section',
      `"${section.name}" will be removed from ${level?.name ?? 'this grade level'}.`,
      () => removeSection.mutate(section),
      'Remove'
    );

  const busyIds = (mutations: { isPending: boolean; variables?: { sectionId: string } }[]) =>
    new Set(mutations.filter((m) => m.isPending && m.variables).map((m) => m.variables!.sectionId));
  const adviserBusy = busyIds([assignAdviser, unassignAdviser]);
  const offeringBusy = busyIds([assignSubjectTeacher, unassignSubjectTeacher, createOffering]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        sectionsQuery.refetch(),
        subjectsQuery.refetch(),
        offeringsQuery.refetch(),
        teachersQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  if (loadingLevels) return <ActivityIndicator style={{ marginTop: 40 }} color={t.primary} />;

  return (
    <>
      <FlatList
        data={sections}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onEndReached={() =>
          sectionsQuery.hasNextPage && !sectionsQuery.isFetchingNextPage && sectionsQuery.fetchNextPage()
        }
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
        ListHeaderComponent={
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {levels.map((l) => {
                const selected = l.id === levelId;
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
              <View style={styles.levelRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.levelName, { color: t.foreground }]}>{level.name}</Text>
                  <Text style={[styles.meta, { color: t.muted }]}>
                    {level.code} · {totalSections} section{totalSections === 1 ? '' : 's'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: t.primary }]}
                  onPress={() => setFormTarget({ kind: 'add' })}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.addText}>Add Section</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          sectionsQuery.isLoading ? (
            <View style={{ gap: 12 }}>
              {[0, 1].map((i) => (
                <View key={i} style={[styles.skeleton, { backgroundColor: t.card, borderColor: t.border }]} />
              ))}
            </View>
          ) : (
            <DashedEmpty icon="people-outline" title="No section found" subtitle="Add a section to get started." />
          )
        }
        ListFooterComponent={
          sectionsQuery.isFetchingNextPage ? <ActivityIndicator style={{ margin: 16 }} color={t.primary} /> : undefined
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item: section }) => (
          <SectionCard
            section={section}
            subjects={subjects}
            sectionOfferings={offeringsBySection.get(section.id)}
            glsBySubjectId={glsBySubjectId}
            teacherOptions={teacherOptions}
            teacherNameById={teacherNameById}
            adviserBusy={adviserBusy.has(section.id)}
            offeringBusy={offeringBusy.has(section.id)}
            onAdviserChange={onAdviserChange}
            onSubjectTeacherChange={onSubjectTeacherChange}
            onEdit={() => setFormTarget({ kind: 'edit', section })}
            onRemove={() => askRemove(section)}
          />
        )}
      />

      <SectionFormModal
        target={formTarget}
        levels={levels}
        defaultLevelId={levelId}
        saving={saveSection.isPending}
        onClose={() => setFormTarget(null)}
        onSubmit={(values) => saveSection.mutate(values)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40 },
  chips: { gap: 8, paddingBottom: 14 },
  chip: { minWidth: 52, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5 },
  chipText: { fontSize: 14, fontWeight: '800' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  levelName: { fontSize: 19, fontWeight: '800' },
  meta: { marginTop: 3, fontSize: 12.5 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12 },
  addText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  skeleton: { height: 160, borderRadius: 16, borderWidth: 1 },
});
