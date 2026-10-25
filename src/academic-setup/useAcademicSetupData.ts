import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { GradeLevel, GradeLevelSubject, gradeLevelsApi } from '../api/gradeLevels';
import { GradingScheme, gradingSchemesApi } from '../api/gradingSchemes';
import { Subject, subjectsApi } from '../api/subjects';
import { academicKeys } from './keys';
import { computeSchemeWeightTotal, isWeightTotalComplete, sumItemWeights } from './weights';

const FIVE_MINUTES = 5 * 60 * 1000;
const NONE: never[] = [];

/** A child of a composite subject, joined with the catalog for units and description */
export interface ChildSubjectDetail {
  compositeSubjectChildId: string;
  subjectId: string;
  code: string;
  name: string;
  description: string;
  units: number | null;
  isCore: boolean;
  sequenceNo: number;
}

/** A root subject of a grade level (children inline), joined with the catalog */
export interface SubjectDetail {
  gradeLevelSubjectId: string;
  subjectId: string;
  code: string;
  name: string;
  description: string;
  units: number | null;
  isCore: boolean;
  isComposite: boolean;
  children: ChildSubjectDetail[];
}

export interface SubjectEntry {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  /** Parent's subjectId when this entry is a child of a composite in the same level; null for roots */
  parentSubjectId: string | null;
}

export interface SubjectGroup {
  level: GradeLevel;
  subjects: SubjectEntry[];
}

export interface AcademicSetupData {
  schemes: GradingScheme[];
  /** schemeId -> subjectIds currently assigned on the server */
  byScheme: Map<string, string[]>;
  subjectsByLevel: Map<string, SubjectDetail[]>;
  /** Subjects per grade level, flattened (Step 3 rendering) */
  groups: SubjectGroup[];
  levels: GradeLevel[];
  subjectCount: number;
  unassignedCount: number;
  assignedIds: Set<string>;
  /** Completion of the 4 wizard steps (index 0..3) */
  completion: boolean[];
  /** Why a step is still open (empty once the step is done) */
  hints: string[];
  /** Overall weight total per scheme; only schemes whose components and items have loaded are present */
  schemeWeightTotals: Map<string, number>;
  /** Schemes whose overall weight total is not 100% */
  incompleteSchemeIds: Set<string>;
  isLoading: boolean;
}

/** System-defined schemes alone never satisfy Steps 2 and 4; Step 3 counts assignments across every scheme */
export function computeCompletion(schemes: GradingScheme[], subjectCount: number, unassignedCount: number): boolean[] {
  return [
    subjectCount > 0,
    schemes.some((s) => !s.isSystemDefined),
    schemes.length > 0 && subjectCount > 0 && unassignedCount === 0,
    schemes.some((s) => !s.isSystemDefined && s.isActive),
  ];
}

export function computeHints(schemes: GradingScheme[], subjectCount: number, unassignedCount: number): string[] {
  const hasCustom = schemes.some((s) => !s.isSystemDefined);
  const hasActiveCustom = schemes.some((s) => !s.isSystemDefined && s.isActive);

  let assignHint = '';
  if (schemes.length === 0) assignHint = 'Create a grading scheme before assigning subjects.';
  else if (subjectCount === 0) assignHint = 'Add subjects to a grade level before assigning schemes.';
  else if (unassignedCount > 0)
    assignHint = `${unassignedCount} subject${unassignedCount !== 1 ? 's' : ''} still without a grading scheme.`;

  return [
    subjectCount > 0 ? '' : 'Add at least one subject to a grade level.',
    hasCustom ? '' : 'Create a grading scheme for this school year.',
    assignHint,
    hasActiveCustom
      ? ''
      : hasCustom
        ? 'Activate a grading scheme for this school year.'
        : 'Create a grading scheme before activating one.',
  ];
}

/**
 * One derivation of everything Academic Setup needs. The stepper and all four steps read this
 * single read model (via AcademicSetupProvider), so the per-level and per-scheme fan-outs are
 * consumed once and the counts and completion can never drift between steps. Server state stays in
 * react-query: this hook only composes queries and memoizes the derived views.
 */
export function useAcademicSetupData(schoolYearId: string): AcademicSetupData {
  const levelsQuery = useQuery({ queryKey: academicKeys.gradeLevels, queryFn: gradeLevelsApi.list });
  const levels = levelsQuery.data ?? (NONE as GradeLevel[]);

  const membershipQueries = useQueries({
    queries: levels.map((level) => ({
      queryKey: academicKeys.levelSubjects(level.id, schoolYearId),
      queryFn: () => gradeLevelsApi.subjects(level.id, schoolYearId),
      enabled: !!schoolYearId,
      staleTime: FIVE_MINUTES,
      refetchOnWindowFocus: false,
    })),
  });

  const subjectsQuery = useQuery({ queryKey: academicKeys.subjects, queryFn: subjectsApi.list });
  const allSubjects = subjectsQuery.data ?? (NONE as Subject[]);

  const schemesQuery = useQuery({
    queryKey: academicKeys.schemes(schoolYearId),
    queryFn: () => gradingSchemesApi.listBySchoolYear(schoolYearId),
    enabled: !!schoolYearId,
  });
  const schemes = schemesQuery.data ?? (NONE as GradingScheme[]);

  const schemeSubjectQueries = useQueries({
    queries: schemes.map((scheme) => ({
      queryKey: academicKeys.schemeSubjects(scheme.id),
      queryFn: () => gradingSchemesApi.subjects(scheme.id),
      staleTime: FIVE_MINUTES,
      refetchOnWindowFocus: false,
    })),
  });

  const componentQueries = useQueries({
    queries: schemes.map((scheme) => ({
      queryKey: academicKeys.components(scheme.id),
      queryFn: () => gradingSchemesApi.components(scheme.id),
      staleTime: FIVE_MINUTES,
      refetchOnWindowFocus: false,
    })),
  });

  // One items query per component of every scheme
  const componentRefs = schemes.flatMap((scheme, i) =>
    (componentQueries[i]?.data ?? []).map((component) => ({ schemeId: scheme.id, componentId: component.id }))
  );
  const itemQueries = useQueries({
    queries: componentRefs.map((ref) => ({
      queryKey: academicKeys.items(ref.schemeId, ref.componentId),
      queryFn: () => gradingSchemesApi.items(ref.schemeId, ref.componentId),
      staleTime: FIVE_MINUTES,
      refetchOnWindowFocus: false,
    })),
  });

  // Stable memo keys: the query arrays change length as data arrives, which useMemo deps cannot do
  const sig = (queries: { dataUpdatedAt: number }[]) => queries.map((q) => q.dataUpdatedAt).join('|');
  const membershipSig = sig(membershipQueries);
  const schemeSubjectsSig = sig(schemeSubjectQueries);
  const weightsSig = `${sig(componentQueries)}#${sig(itemQueries)}`;

  // ---- derived views --------------------------------------------------------------------------
  const rowsByLevel = new Map<string, GradeLevelSubject[]>();
  levels.forEach((level, i) => rowsByLevel.set(level.id, membershipQueries[i]?.data ?? []));

  const groups = useMemo<SubjectGroup[]>(
    () =>
      levels.map((level) => {
        const rows = rowsByLevel.get(level.id) ?? [];
        const rowIds = new Set(rows.map((r) => r.subjectId));
        const childToParent = new Map<string, string>();
        rows.forEach((row) => row.children.forEach((c) => childToParent.set(c.childSubjectId, row.subjectId)));
        const seen = new Set<string>();
        const subjects: SubjectEntry[] = [];

        rows.forEach((row) => {
          if (seen.has(row.subjectId)) return;
          const parentId = childToParent.get(row.subjectId);
          const nestedUnder = parentId && rowIds.has(parentId) ? parentId : null;
          seen.add(row.subjectId);
          subjects.push({
            subjectId: row.subjectId,
            subjectCode: row.subjectCode,
            subjectName: row.subjectName,
            parentSubjectId: nestedUnder,
          });
          if (!nestedUnder) {
            row.children.forEach((c) => {
              if (seen.has(c.childSubjectId)) return;
              seen.add(c.childSubjectId);
              subjects.push({
                subjectId: c.childSubjectId,
                subjectCode: c.childSubjectCode,
                subjectName: c.childSubjectName,
                parentSubjectId: row.subjectId,
              });
            });
          }
        });
        return { level, subjects };
      }),
    [levels, membershipSig]
  );

  const subjectsByLevel = useMemo(() => {
    const catalog = new Map(allSubjects.map((s) => [s.subjectId, s]));
    const map = new Map<string, SubjectDetail[]>();
    levels.forEach((level, i) => {
      const rows = membershipQueries[i]?.data ?? [];
      // A child that also has its own link in the level is listed under its composite parent only
      const childIds = new Set(rows.flatMap((r) => r.children.map((c) => c.childSubjectId)));
      map.set(
        level.id,
        rows
          .filter((r) => !childIds.has(r.subjectId))
          .map((row) => {
            const detail = catalog.get(row.subjectId);
            return {
              gradeLevelSubjectId: row.gradeLevelSubjectId,
              subjectId: row.subjectId,
              code: row.subjectCode,
              name: row.subjectName,
              description: detail?.description ?? '',
              units: detail?.units ?? null,
              isCore: row.isCore,
              isComposite: row.isComposite || row.children.length > 0,
              children: row.children
                .slice()
                .sort((a, b) => a.sequenceNo - b.sequenceNo)
                .map((c) => {
                  const childDetail = catalog.get(c.childSubjectId);
                  return {
                    compositeSubjectChildId: c.compositeSubjectChildId,
                    subjectId: c.childSubjectId,
                    code: c.childSubjectCode,
                    name: c.childSubjectName,
                    description: childDetail?.description ?? '',
                    units: childDetail?.units ?? null,
                    isCore: childDetail?.isCore ?? true,
                    sequenceNo: c.sequenceNo,
                  };
                }),
            };
          })
      );
    });
    return map;
  }, [levels, allSubjects, membershipSig]);

  const byScheme = useMemo(() => {
    const map = new Map<string, string[]>();
    schemes.forEach((scheme, i) => map.set(scheme.id, (schemeSubjectQueries[i]?.data ?? []).map((r) => r.subjectId)));
    return map;
  }, [schemes, schemeSubjectsSig]);

  const assignedIds = useMemo(() => new Set([...byScheme.values()].flat()), [byScheme]);

  const subjectCount = groups.reduce((n, g) => n + g.subjects.length, 0);
  const unassignedCount = groups.reduce(
    (n, g) => n + g.subjects.filter((s) => !assignedIds.has(s.subjectId)).length,
    0
  );

  const completion = useMemo(
    () => computeCompletion(schemes, subjectCount, unassignedCount),
    [schemes, subjectCount, unassignedCount]
  );
  const hints = useMemo(
    () => computeHints(schemes, subjectCount, unassignedCount),
    [schemes, subjectCount, unassignedCount]
  );

  // A scheme still loading its components or items is left out, so it is never reported as 0%
  const { schemeWeightTotals, incompleteSchemeIds } = useMemo(() => {
    const totals = new Map<string, number>();
    const incomplete = new Set<string>();
    schemes.forEach((scheme, i) => {
      const componentQuery = componentQueries[i];
      if (!componentQuery?.isSuccess) return;
      const components = componentQuery.data ?? [];
      const itemTotals = new Map<string, number>();
      let loaded = true;
      components.forEach((component) => {
        const idx = componentRefs.findIndex((r) => r.schemeId === scheme.id && r.componentId === component.id);
        const itemQuery = itemQueries[idx];
        if (!itemQuery?.isSuccess) {
          loaded = false;
          return;
        }
        itemTotals.set(component.id, sumItemWeights(itemQuery.data ?? []));
      });
      if (!loaded) return;
      const total = computeSchemeWeightTotal(components, itemTotals);
      totals.set(scheme.id, total);
      if (!isWeightTotalComplete(total)) incomplete.add(scheme.id);
    });
    return { schemeWeightTotals: totals, incompleteSchemeIds: incomplete };
  }, [schemes, weightsSig]);

  const isLoading =
    levelsQuery.isLoading ||
    subjectsQuery.isLoading ||
    schemesQuery.isLoading ||
    (!!schoolYearId && membershipQueries.some((q) => q.isLoading)) ||
    schemeSubjectQueries.some((q) => q.isLoading) ||
    componentQueries.some((q) => q.isLoading) ||
    itemQueries.some((q) => q.isLoading);

  return {
    schemes,
    byScheme,
    subjectsByLevel,
    groups,
    levels,
    subjectCount,
    unassignedCount,
    assignedIds,
    completion,
    hints,
    schemeWeightTotals,
    incompleteSchemeIds,
    isLoading,
  };
}
