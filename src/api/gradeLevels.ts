import { asList, initializeApi, peel, unwrap } from '../api';

export interface GradeLevel {
  id: string;
  code: string;
  name: string;
  numericLevel: number;
  description: string;
  category: string;
}

export interface CompositeChild {
  compositeSubjectChildId: string;
  parentSubjectId: string;
  childSubjectId: string;
  childSubjectCode: string;
  childSubjectName: string;
  sequenceNo: number;
}

/** A subject linked to a grade level for one school year (the reliable source for structure) */
export interface GradeLevelSubject {
  gradeLevelSubjectId: string;
  gradeLevelId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  isCore: boolean;
  isComposite: boolean;
  children: CompositeChild[];
}

export interface LevelSubjectInput {
  code: string;
  name: string;
  description: string;
  units: number;
  isCore: boolean;
  isComposite: boolean;
}

const mapLevel = (raw: any): GradeLevel => ({
  id: raw.gradeLevelId,
  code: raw.code ?? '',
  name: raw.name ?? '',
  numericLevel: raw.numericLevel ?? 0,
  description: raw.description ?? '',
  category: raw.category ?? '',
});

const mapMembership = (raw: any): GradeLevelSubject => ({
  gradeLevelSubjectId: raw.gradeLevelSubjectId ?? '',
  gradeLevelId: raw.gradeLevelId ?? '',
  subjectId: raw.subjectId,
  subjectCode: raw.subjectCode ?? '',
  subjectName: raw.subjectName ?? '',
  isCore: raw.isCore ?? true,
  isComposite: raw.isComposite ?? false,
  children: (raw.children ?? []).map((c: any) => ({
    compositeSubjectChildId: c.compositeSubjectChildId ?? '',
    parentSubjectId: c.parentSubjectId ?? raw.subjectId,
    childSubjectId: c.childSubjectId,
    childSubjectCode: c.childSubjectCode ?? '',
    childSubjectName: c.childSubjectName ?? '',
    sequenceNo: c.sequenceNo ?? 0,
  })),
});

export const gradeLevelsApi = {
  list: async (): Promise<GradeLevel[]> => {
    const res = await initializeApi().get('/api/GradeLevel');
    return asList(unwrap<any>(res.data)).map(mapLevel).sort((a, b) => a.numericLevel - b.numericLevel);
  },

  subjects: async (levelId: string, schoolYearId: string): Promise<GradeLevelSubject[]> => {
    const res = await initializeApi().get(`/api/GradeLevel/${levelId}/school-year/${schoolYearId}/subjects`);
    return asList(unwrap<any>(res.data), ['subjects', 'data']).map(mapMembership);
  },

  /** Creates the subject and links it to the level for the school year; returns the new subject id */
  createSubject: async (levelId: string, schoolYearId: string, input: LevelSubjectInput): Promise<string> => {
    const res = await initializeApi().post(
      `/api/GradeLevel/${levelId}/school-year/${schoolYearId}/subjects`,
      input
    );
    const created = peel<{ subjectId: string }>(res.data, 'subjectId');
    if (!created) throw new Error('The server did not return the new subject.');
    return created.subjectId;
  },
};
