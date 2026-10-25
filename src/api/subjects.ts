import { asList, initializeApi, unwrap } from '../api';

export interface Subject {
  subjectId: string;
  code: string;
  name: string;
  description: string | null;
  units: number | null;
  isCore: boolean;
  isComposite: boolean;
}

export interface CreateSubjectInput {
  code: string;
  name: string;
  description?: string;
  units?: number;
  isCore: boolean;
  schoolYearId: string;
}

export interface SubjectBody {
  code: string;
  name: string;
  description: string;
  units: number;
  isCore: boolean;
  isComposite: boolean;
}

export interface SubjectChildBody {
  code: string;
  name: string;
  description: string;
  sequenceNo: number;
}

export const subjectsApi = {
  list: async (): Promise<Subject[]> => {
    const res = await initializeApi().get('/api/subjects');
    return asList<any>(unwrap<any>(res.data)).map((s) => ({
      ...s,
      description: s.description ?? '',
      units: s.units ?? null,
    })) as Subject[];
  },

  update: async (subjectId: string, body: SubjectBody): Promise<void> => {
    await initializeApi().put(`/api/subjects/${subjectId}`, body);
  },

  /** Adds a child to a composite subject (the backend cannot attach children inline on create) */
  addChild: async (parentSubjectId: string, body: SubjectChildBody): Promise<void> => {
    await initializeApi().post(`/api/subjects/${parentSubjectId}/children`, body);
  },

  create: async (input: CreateSubjectInput): Promise<void> => {
    await initializeApi().post('/api/subjects', { ...input, isComposite: false });
  },

  remove: async (subjectId: string): Promise<void> => {
    await initializeApi().delete(`/api/subjects/${subjectId}`);
  },
};
