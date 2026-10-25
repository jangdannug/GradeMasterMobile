// react-query keys for Academic Setup
export const academicKeys = {
  gradeLevels: ['grade-levels'] as const,
  levelSubjects: (levelId: string, schoolYearId: string) => ['grade-level-subjects', levelId, schoolYearId] as const,
  subjects: ['subjects'] as const,
  schemes: (schoolYearId: string) => ['grading-schemes', schoolYearId] as const,
  schemeSubjects: (schemeId: string) => ['scheme-subjects', schemeId] as const,
  components: (schemeId: string) => ['grading-components', schemeId] as const,
  items: (schemeId: string, componentId: string) => ['grading-items', schemeId, componentId] as const,
  transmutationTables: ['transmutation-tables'] as const,
  transmutationEntries: (tableId: string) => ['transmutation-entries', tableId] as const,
  descriptorSets: ['grading-descriptors'] as const,
  descriptorEntries: (setId: string) => ['descriptor-entries', setId] as const,
};
