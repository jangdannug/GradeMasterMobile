import { initializeApi, peel, peelList } from '../api';

const BASE = '/api/ClassSubjectOffering';

/** One section + one grade-level subject, optionally with a teacher */
export interface ClassSubjectOffering {
  id: string;
  schoolYearSectionId: string;
  gradeLevelSubjectId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  teacherProfileId: string; // '' when no teacher
  teacherFirstName: string;
  teacherLastName: string;
  gradeLevelId: string;
}

export const mapOffering = (raw: any): ClassSubjectOffering => ({
  id: raw.classSubjectOfferingId ?? raw.id ?? '',
  schoolYearSectionId: raw.schoolYearSectionId ?? '',
  gradeLevelSubjectId: raw.gradeLevelSubjectId ?? '',
  subjectId: raw.subjectId ?? '',
  subjectCode: raw.subjectCode ?? '',
  subjectName: raw.subjectName ?? '',
  teacherProfileId: raw.teacherProfileId ?? '',
  teacherFirstName: raw.teacherFirstName ?? '',
  teacherLastName: raw.teacherLastName ?? '',
  gradeLevelId: raw.gradeLevelId ?? '',
});

/** Single-offering responses are double-wrapped: dig for the object that carries the id */
const peelOffering = (body: any): any | null =>
  peel(body, 'classSubjectOfferingId') ?? peel(body, 'id');

export const classSubjectOfferingsApi = {
  /** Every offering of the school */
  list: async (): Promise<ClassSubjectOffering[]> => {
    const res = await initializeApi().get(BASE);
    return peelList(res.data).map(mapOffering);
  },

  /** The offerings of the signed-in teacher (the backend resolves the teacher from the token) */
  listForTeacher: async (schoolYearId: string): Promise<ClassSubjectOffering[]> => {
    const res = await initializeApi().get(`${BASE}/school-year/${schoolYearId}/teacher`);
    return peelList(res.data).map(mapOffering);
  },

  /** Returns the created row, or null when the response did not carry one */
  create: async (input: {
    schoolYearSectionId: string;
    gradeLevelSubjectId: string;
    teacherProfileId?: string;
  }): Promise<ClassSubjectOffering | null> => {
    const res = await initializeApi().post(BASE, input);
    const raw = peelOffering(res.data);
    return raw ? mapOffering(raw) : null;
  },

  /** The response is not fully hydrated (subject fields come back null): patch, do not replace */
  assignTeacher: async (offeringId: string, teacherProfileId: string): Promise<ClassSubjectOffering | null> => {
    const res = await initializeApi().put(`${BASE}/${offeringId}/teacher`, { teacherProfileId });
    const raw = peelOffering(res.data);
    return raw ? mapOffering(raw) : null;
  },

  unassignTeacher: async (offeringId: string): Promise<void> => {
    await initializeApi().delete(`${BASE}/${offeringId}/teacher`);
  },
};
