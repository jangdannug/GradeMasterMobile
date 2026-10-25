import { ClassSubjectOffering } from '../api/classSubjectOfferings';
import { GradeLevelSubject } from '../api/gradeLevels';

/** gradeLevelSubjectId -> offering, for one section */
export type SectionOfferings = Map<string, ClassSubjectOffering>;

/** sectionId -> (gradeLevelSubjectId -> offering) */
export function buildOfferingsBySection(offerings: ClassSubjectOffering[]): Map<string, SectionOfferings> {
  const bySection = new Map<string, SectionOfferings>();
  offerings.forEach((offering) => {
    if (!offering.schoolYearSectionId || !offering.gradeLevelSubjectId) return;
    let sectionMap = bySection.get(offering.schoolYearSectionId);
    if (!sectionMap) {
      sectionMap = new Map();
      bySection.set(offering.schoolYearSectionId, sectionMap);
    }
    sectionMap.set(offering.gradeLevelSubjectId, offering);
  });
  return bySection;
}

/** subjectId -> gradeLevelSubjectId, from the level's membership rows */
export function buildGradeLevelSubjectIdBySubjectId(rows: GradeLevelSubject[]): Map<string, string> {
  const map = new Map<string, string>();
  rows.forEach((row) => {
    if (row.gradeLevelSubjectId) map.set(row.subjectId, row.gradeLevelSubjectId);
  });
  return map;
}

/**
 * Looks the offering up by gradeLevelSubjectId first; if that misses, falls back to scanning the
 * section's offerings for one with the same subjectId. Composite children only appear nested (no
 * membership row id) but the backend still gives them an offering, so the fallback matters.
 */
export function findSubjectOffering(
  sectionOfferings: SectionOfferings | undefined,
  gradeLevelSubjectId: string | undefined,
  subjectId: string
): ClassSubjectOffering | undefined {
  if (!sectionOfferings) return undefined;
  if (gradeLevelSubjectId) {
    const byId = sectionOfferings.get(gradeLevelSubjectId);
    if (byId) return byId;
  }
  for (const offering of sectionOfferings.values()) {
    if (offering.subjectId === subjectId) return offering;
  }
  return undefined;
}

/**
 * Assigned / unassigned teacher slots of a section. Every child of a composite is one slot (the
 * composite itself is not assignable; children without a gradeLevelSubjectId are skipped), and
 * every subject without children is one slot.
 */
export function countSectionAssignments(
  subjects: GradeLevelSubject[],
  sectionOfferings: SectionOfferings | undefined,
  gradeLevelSubjectIdBySubjectId: Map<string, string>
): { assigned: number; unassigned: number } {
  let assigned = 0;
  let unassigned = 0;

  for (const subject of subjects) {
    if (subject.children.length > 0) {
      for (const child of subject.children) {
        const offering = findSubjectOffering(
          sectionOfferings,
          gradeLevelSubjectIdBySubjectId.get(child.childSubjectId),
          child.childSubjectId
        );
        const gradeLevelSubjectId =
          gradeLevelSubjectIdBySubjectId.get(child.childSubjectId) ?? offering?.gradeLevelSubjectId;
        if (!gradeLevelSubjectId) continue;
        if (offering?.teacherProfileId) assigned += 1;
        else unassigned += 1;
      }
    } else if (findSubjectOffering(sectionOfferings, subject.gradeLevelSubjectId, subject.subjectId)?.teacherProfileId) {
      assigned += 1;
    } else {
      unassigned += 1;
    }
  }

  return { assigned, unassigned };
}

/** Plain subjects first, then composites (the ones with children) after them */
export function orderSubjects(subjects: GradeLevelSubject[]): GradeLevelSubject[] {
  return [
    ...subjects.filter((s) => s.children.length === 0),
    ...subjects.filter((s) => s.children.length > 0),
  ];
}

/**
 * Applies a teacher change on top of a cached offering. The mutation responses are not fully
 * hydrated (subject fields come back null), so only the teacher fields are taken from them.
 */
export function withTeacher(
  offering: ClassSubjectOffering,
  teacher: { teacherProfileId: string; teacherFirstName: string; teacherLastName: string }
): ClassSubjectOffering {
  return { ...offering, ...teacher };
}

export const NO_TEACHER = { teacherProfileId: '', teacherFirstName: '', teacherLastName: '' };
