import { useCallback, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { academicKeys } from '../academic-setup/keys';
import { ClassSubjectOffering, classSubjectOfferingsApi } from '../api/classSubjectOfferings';
import { gradeLevelsApi } from '../api/gradeLevels';
import { gradeSubmissionApi, ClassRecordRow, SectionReadiness } from '../api/gradeSubmission';
import { gradingDescriptorsApi } from '../api/gradingDescriptors';
import { GradingPeriod } from '../api/gradingPeriods';
import { gradingSchemesApi } from '../api/gradingSchemes';
import { transmutationApi } from '../api/transmutation';
import { SetupSchoolYear } from '../api/schoolYears';
import { sectionsApi } from '../api/sections';
import { todayString } from '../school-setup/dates';
import {
  actionGates,
  buildHighestScoreMap,
  buildScoreMap,
  changedEntries,
  computeStudentValidation,
  DescriptorRow,
  TransmutationRow,
  HighestScoreMap,
  isPeriodOpen,
  parseScoreInput,
  ScoreMap,
} from './logic';

const FIVE_MINUTES = 5 * 60 * 1000;
const REFERENCE = { staleTime: FIVE_MINUTES, refetchOnWindowFocus: false } as const;

export const classRecordKeys = {
  offerings: (schoolYearId: string) => ['teacher-offerings', schoolYearId] as const,
  scoresheet: (offeringId: string, gradingPeriodId: string) => ['scoresheet', offeringId, gradingPeriodId] as const,
  readiness: (sectionId: string, gradingPeriodId: string) => ['section-readiness', sectionId, gradingPeriodId] as const,
};

// ---------------------------------------------------------------------------------------------
// The teacher's classes (for the picker)
// ---------------------------------------------------------------------------------------------

export interface ClassCard {
  offeringId: string;
  sectionId: string;
  gradeLevelId: string;
  gradeLevelName: string;
  numericLevel: number;
  sectionName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
}

export interface ClassGroup {
  sectionId: string;
  title: string;
  cards: ClassCard[];
}

export function useTeacherClasses(schoolYearId: string, gradingPeriodId: string) {
  const offeringsQuery = useQuery({
    queryKey: classRecordKeys.offerings(schoolYearId),
    queryFn: () => classSubjectOfferingsApi.listForTeacher(schoolYearId),
    enabled: !!schoolYearId,
  });
  const sectionsQuery = useQuery({
    queryKey: ['sy-sections', schoolYearId],
    queryFn: () => sectionsApi.allForSchoolYear(schoolYearId),
    enabled: !!schoolYearId,
  });
  const levelsQuery = useQuery({ queryKey: academicKeys.gradeLevels, queryFn: gradeLevelsApi.list });

  const cards = useMemo<ClassCard[]>(() => {
    const sections = new Map((sectionsQuery.data ?? []).map((s) => [s.id, s]));
    const levels = new Map((levelsQuery.data ?? []).map((l) => [l.id, l]));
    const out: ClassCard[] = [];
    (offeringsQuery.data ?? []).forEach((o: ClassSubjectOffering) => {
      // Offerings without a subject or a section cannot be graded
      if (!o.subjectId || !o.schoolYearSectionId) return;
      const section = sections.get(o.schoolYearSectionId);
      const level = levels.get(section?.gradeLevelId ?? o.gradeLevelId);
      out.push({
        offeringId: o.id,
        sectionId: o.schoolYearSectionId,
        gradeLevelId: level?.id ?? '',
        gradeLevelName: level?.name ?? '',
        numericLevel: level?.numericLevel ?? 0,
        sectionName: section?.name ?? '',
        subjectId: o.subjectId,
        subjectCode: o.subjectCode,
        subjectName: o.subjectName,
      });
    });
    return out;
  }, [offeringsQuery.data, sectionsQuery.data, levelsQuery.data]);

  // Grouped by section: grade level, then section name; subjects by name inside a group
  const groups = useMemo<ClassGroup[]>(() => {
    const bySection = new Map<string, ClassCard[]>();
    cards.forEach((c) => bySection.set(c.sectionId, [...(bySection.get(c.sectionId) ?? []), c]));
    return [...bySection.entries()]
      .map(([sectionId, list]) => {
        const sorted = [...list].sort((a, b) => a.subjectName.localeCompare(b.subjectName));
        const first = sorted[0];
        return {
          sectionId,
          title: `${first.gradeLevelName || 'Grade'} - ${first.sectionName}`,
          cards: sorted,
          sortKey: [first.numericLevel, first.sectionName] as const,
        };
      })
      .sort((a, b) => a.sortKey[0] - b.sortKey[0] || a.sortKey[1].localeCompare(b.sortKey[1]))
      .map(({ sectionId, title, cards: list }) => ({ sectionId, title, cards: list }));
  }, [cards]);

  // One readiness call per section gives every card its submission badge
  const sectionIds = useMemo(() => groups.map((g) => g.sectionId), [groups]);
  const readinessQueries = useQueries({
    queries: sectionIds.map((sectionId) => ({
      queryKey: classRecordKeys.readiness(sectionId, gradingPeriodId),
      queryFn: () => gradeSubmissionApi.readiness(sectionId, gradingPeriodId),
      enabled: !!gradingPeriodId,
      staleTime: 30 * 1000,
    })),
  });
  const readinessSig = readinessQueries.map((q) => q.dataUpdatedAt).join('|');
  const sectionSig = sectionIds.join('|');

  const readinessBySection = useMemo(() => {
    const map = new Map<string, SectionReadiness>();
    sectionIds.forEach((id, i) => {
      const data = readinessQueries[i]?.data;
      if (data) map.set(id, data);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionSig, readinessSig]);

  const recordByOffering = useMemo(() => {
    const map = new Map<string, ClassRecordRow>();
    readinessBySection.forEach((r) => r.classRecords.forEach((c) => map.set(c.classSubjectOfferingId, c)));
    return map;
  }, [readinessBySection]);

  return {
    groups,
    cards,
    readinessBySection,
    recordByOffering,
    isLoading: offeringsQuery.isLoading || sectionsQuery.isLoading || levelsQuery.isLoading,
    refetch: async () => {
      await Promise.all([offeringsQuery.refetch(), sectionsQuery.refetch(), ...readinessQueries.map((q) => q.refetch())]);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The scoresheet, its reference data and the editable draft
// ---------------------------------------------------------------------------------------------

export function useGradingSheet(params: {
  schoolYear: SetupSchoolYear | undefined;
  gradingPeriod: GradingPeriod | undefined;
  card: ClassCard | undefined;
}) {
  const { schoolYear, gradingPeriod, card } = params;
  const queryClient = useQueryClient();
  const offeringId = card?.offeringId ?? '';
  const gradingPeriodId = gradingPeriod?.id ?? '';
  const schoolYearId = schoolYear?.id ?? '';
  const allReady = !!schoolYear && !!gradingPeriod && !!card;

  // ---- The sheet: the single source of truth --------------------------------------------------
  const sheetQuery = useQuery({
    queryKey: classRecordKeys.scoresheet(offeringId, gradingPeriodId),
    queryFn: () => gradeSubmissionApi.scoresheet(offeringId, gradingPeriodId),
    enabled: allReady,
    refetchOnWindowFocus: false,
  });
  const sheet = sheetQuery.data;

  // ---- Reference data: the subject's grading scheme, item weights, descriptors -------------------
  const schemesQuery = useQuery({
    queryKey: academicKeys.schemes(schoolYearId),
    queryFn: () => gradingSchemesApi.listBySchoolYear(schoolYearId),
    enabled: !!schoolYearId,
    ...REFERENCE,
  });
  const schemes = schemesQuery.data ?? [];
  const schemeSubjectQueries = useQueries({
    queries: schemes.map((scheme) => ({
      queryKey: academicKeys.schemeSubjects(scheme.id),
      queryFn: () => gradingSchemesApi.subjects(scheme.id),
      ...REFERENCE,
    })),
  });

  const schemeSubjectSig = schemeSubjectQueries.map((q) => q.dataUpdatedAt).join('|');

  // A subject can be in several schemes: prefer the active one that contains it
  const scheme = useMemo(() => {
    if (!card) return undefined;
    const containing = schemes.filter((_, i) =>
      (schemeSubjectQueries[i]?.data ?? []).some((row) => row.subjectId === card.subjectId)
    );
    return containing.find((s) => s.isActive) ?? containing[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.subjectId, schemes, schemeSubjectSig]);

  const components = useMemo(() => sheet?.components ?? [], [sheet]);
  const itemQueries = useQueries({
    queries: components.map((c) => ({
      queryKey: ['scheme-items', scheme?.id ?? '', c.id],
      queryFn: () => gradingSchemesApi.items(scheme!.id, c.id),
      enabled: !!scheme,
      ...REFERENCE,
    })),
  });
  const itemSig = itemQueries.map((q) => q.dataUpdatedAt).join('|');
  const itemWeights = useMemo(() => {
    const map: Record<string, number> = {};
    itemQueries.forEach((q) => q.data?.forEach((item) => (map[item.id] = item.weightPercent)));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemSig]);

  const descriptorQuery = useQuery({
    queryKey: ['descriptor-entries', scheme?.gradingDescriptorId ?? ''],
    queryFn: () => gradingDescriptorsApi.entries(scheme!.gradingDescriptorId),
    enabled: !!scheme?.gradingDescriptorId,
    ...REFERENCE,
  });
  const descriptorRows = useMemo<DescriptorRow[]>(
    () =>
      (descriptorQuery.data ?? []).map((e) => ({
        minGrade: e.minGrade,
        maxGrade: e.maxGrade,
        label: e.descriptor,
        color: e.descriptorColor,
      })),
    [descriptorQuery.data]
  );

  // The scheme's transmutation table turns the live Initial Grade into the Final Grade as the teacher types
  const transmutationQuery = useQuery({
    queryKey: academicKeys.transmutationEntries(scheme?.transmutationTableId ?? ''),
    queryFn: () => transmutationApi.entries(scheme!.transmutationTableId),
    enabled: !!scheme?.transmutationTableId,
    ...REFERENCE,
  });
  const transmutationRows = useMemo<TransmutationRow[]>(
    () =>
      (transmutationQuery.data ?? []).map((e) => ({
        minInitial: e.initialGrade,
        maxInitial: e.maxInitialGrade,
        transmuted: e.transmutedGrade,
      })),
    [transmutationQuery.data]
  );

  // ---- Gates ----------------------------------------------------------------------------------
  const today = todayString();
  const syActive = !!schoolYear && schoolYear.isActive && !schoolYear.isDraft;
  const isGpOpen = isPeriodOpen(syActive, today, gradingPeriod);
  const isSyLocked = !!schoolYear?.isLocked;
  const isRedacted = !!sheet?.isRedacted;
  // The server's edit gate, never second-guessed; a redacted sheet is never editable
  const editable = !!sheet && sheet.isEditable === true && !isRedacted;

  // ---- Draft vs baseline ---------------------------------------------------------------------
  const baseline = useMemo<ScoreMap>(() => buildScoreMap(sheet?.rows), [sheet]);
  const [draft, setDraft] = useState<ScoreMap>({});
  // Bumped whenever the draft is reset, so the uncontrolled score inputs remount with the new values
  const [version, setVersion] = useState(0);
  const [justSaved, setJustSaved] = useState(false);

  // A new baseline (loaded, saved, refetched) replaces the draft; adjusted during render, not in an effect
  const [seenBaseline, setSeenBaseline] = useState(baseline);
  if (seenBaseline !== baseline) {
    setSeenBaseline(baseline);
    setDraft(baseline);
    setVersion((v) => v + 1);
  }

  const canEnter = editable && isGpOpen;

  const setScore = useCallback(
    (enrollmentId: string, itemId: string, textValue: string) => {
      if (!canEnter) return;
      const value = parseScoreInput(textValue);
      setJustSaved(false);
      setDraft((prev) => {
        const own = { ...(prev[enrollmentId] ?? {}) };
        if (value === undefined) delete own[itemId];
        else own[itemId] = value;
        return { ...prev, [enrollmentId]: own };
      });
    },
    [canEnter]
  );

  const resetDraft = useCallback(() => {
    setDraft(baseline);
    setVersion((v) => v + 1);
    setJustSaved(false);
  }, [baseline]);

  const changed = useMemo(() => changedEntries(baseline, draft), [baseline, draft]);
  const isDirty = editable && changed.length > 0;

  // ---- Per-student validation ----------------------------------------------------------------
  const highest: HighestScoreMap = useMemo(() => buildHighestScoreMap(components), [components]);
  const rows = useMemo(() => sheet?.rows ?? [], [sheet]);
  const validations = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeStudentValidation>>();
    rows.forEach((r) =>
      map.set(r.enrollmentId, computeStudentValidation(r.enrollmentId || undefined, draft, components, highest))
    );
    return map;
  }, [rows, draft, components, highest]);
  let overMaxCount = 0;
  let blankCount = 0;
  validations.forEach((v) => {
    if (v.hasOverMax) overMaxCount += 1;
    if (v.hasBlank) blankCount += 1;
  });

  const gates = actionGates({
    status: sheet?.submissionStatus,
    editable,
    isGpOpen,
    isSyLocked,
    overMaxCount,
    blankCount,
    isDirty,
  });

  // ---- Actions -------------------------------------------------------------------------------
  const invalidateAfterSubmission = () => {
    queryClient.invalidateQueries({ queryKey: classRecordKeys.scoresheet(offeringId, gradingPeriodId) });
    queryClient.invalidateQueries({ queryKey: classRecordKeys.offerings(schoolYearId) });
    queryClient.invalidateQueries({ queryKey: ['section-readiness'] });
    queryClient.invalidateQueries({ queryKey: ['class-record-submission'] });
  };

  const save = async () => {
    if (changed.length > 0) {
      await gradeSubmissionApi.saveScores(offeringId, gradingPeriodId, changed);
    }
    await queryClient.invalidateQueries({ queryKey: classRecordKeys.scoresheet(offeringId, gradingPeriodId) });
    setJustSaved(true);
  };

  const submit = async () => {
    const result = await gradeSubmissionApi.submit(offeringId, gradingPeriodId);
    invalidateAfterSubmission();
    return result;
  };

  const withdraw = async () => {
    if (!sheet?.classRecordSubmissionId) return;
    await gradeSubmissionApi.withdraw(sheet.classRecordSubmissionId);
    invalidateAfterSubmission();
  };

  return {
    sheet,
    isLoading: sheetQuery.isLoading,
    isFetching: sheetQuery.isFetching,
    error: sheetQuery.error,
    refetch: sheetQuery.refetch,
    components,
    rows,
    highest,
    itemWeights,
    descriptorRows,
    transmutationRows,
    scheme,
    draft,
    version,
    setScore,
    resetDraft,
    changed,
    isDirty,
    justSaved,
    editable,
    canEnter,
    isGpOpen,
    syActive,
    isSyLocked,
    isRedacted,
    validations,
    overMaxCount,
    blankCount,
    gates,
    save,
    submit,
    withdraw,
  };
}
