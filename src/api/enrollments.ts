import { initializeApi, PagedResult, peel, toPaged, unwrap } from '../api';

const BASE = '/api/Enrollment';

export interface PreviousSchool {
  lastGradeLevelCompleted: string;
  lastSchoolAttended: string;
  lastSchoolId: string;
  lastSchoolYearCompleted: string;
}

export interface EnrollmentRecord {
  id: string;
  studentId: string;
  schoolYearSectionId: string;
  /** Raw timestamp; use its leading yyyy-MM-dd */
  enrollmentDate: string;
  status: string;
  enrollmentType: string;
  isReturning: boolean;
  semester: string;
  track: string;
  strand: string;
  previousSchool: PreviousSchool | null;
}

export interface EnrollmentFilters {
  schoolYearId: string;
  gradeLevelId?: string;
  sectionId?: string;
  status?: string;
  search?: string;
}

const text = (value: unknown) => (value == null ? '' : String(value));

export const mapEnrollment = (raw: any): EnrollmentRecord => ({
  id: raw.enrollmentId ?? raw.id,
  studentId: raw.studentId ?? '',
  schoolYearSectionId: raw.schoolYearSectionId ?? '',
  enrollmentDate: text(raw.enrollmentDate),
  status: text(raw.status),
  enrollmentType: text(raw.enrollmentType),
  isReturning: !!raw.isReturning,
  semester: text(raw.semester),
  track: text(raw.track),
  strand: text(raw.strand),
  previousSchool: raw.previousSchool
    ? {
        lastGradeLevelCompleted: text(raw.previousSchool.lastGradeLevelCompleted),
        lastSchoolAttended: text(raw.previousSchool.lastSchoolAttended),
        lastSchoolId: text(raw.previousSchool.lastSchoolId),
        lastSchoolYearCompleted: text(raw.previousSchool.lastSchoolYearCompleted),
      }
    : null,
});

const MAX_PAGES = 20;

export const enrollmentsApi = {
  /** Unset filters are omitted. (Date filters, if ever added, must be full ISO instants.) */
  paged: async (filters: EnrollmentFilters, pageNumber: number, pageSize = 20): Promise<PagedResult<EnrollmentRecord>> => {
    const res = await initializeApi().get(`${BASE}/paged`, {
      params: {
        SchoolYearId: filters.schoolYearId,
        GradeLevelId: filters.gradeLevelId || undefined,
        SectionId: filters.sectionId || undefined,
        Status: filters.status || undefined,
        Search: filters.search || undefined,
        PageNumber: pageNumber,
        PageSize: pageSize,
      },
    });
    return toPaged(unwrap<any>(res.data), mapEnrollment, pageNumber, pageSize);
  },

  /** Every enrollment of the school year (pages of 100, up to 20 pages), unfiltered */
  listAll: async (schoolYearId: string): Promise<EnrollmentRecord[]> => {
    const all: EnrollmentRecord[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await enrollmentsApi.paged({ schoolYearId }, page, 100);
      all.push(...result.items);
      if (!result.hasNextPage) break;
    }
    return all;
  },

  create: async (payload: Record<string, unknown>): Promise<EnrollmentRecord | null> => {
    const res = await initializeApi().post(BASE, payload);
    const raw = peel(res.data, 'enrollmentId');
    return raw ? mapEnrollment(raw) : null;
  },

  update: async (id: string, payload: Record<string, unknown>): Promise<EnrollmentRecord | null> => {
    const res = await initializeApi().put(`${BASE}/${id}`, payload);
    const raw = peel(res.data, 'enrollmentId');
    return raw ? mapEnrollment(raw) : null;
  },

  // Note: the backend refuses to delete an enrollment that has a previous school (foreign key).
  remove: async (id: string): Promise<void> => {
    await initializeApi().delete(`${BASE}/${id}`);
  },
};
