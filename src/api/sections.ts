import { initializeApi, PagedResult, toPaged, unwrap } from '../api';

export interface Section {
  id: string;
  schoolYearId: string;
  schoolId: string;
  gradeLevelId: string;
  adviserTeacherProfileId: string; // '' when unassigned
  name: string;
  description: string;
  gradeLevelName: string;
  schoolYearName: string;
  adviserName: string;
}

export interface SectionInput {
  schoolYearId: string;
  gradeLevelId: string;
  name: string;
  description: string;
}

const BASE = '/api/SchoolYearSection';

export const mapSection = (raw: any): Section => ({
  id: raw.schoolYearSectionId ?? raw.id,
  schoolYearId: raw.schoolYearId ?? '',
  schoolId: raw.schoolId ?? '',
  gradeLevelId: raw.gradeLevelId ?? '',
  adviserTeacherProfileId: raw.adviserTeacherProfileId ?? '',
  name: raw.name ?? '',
  description: raw.description ?? '',
  gradeLevelName: raw.gradeLevelName ?? '',
  schoolYearName: raw.schoolYearName ?? '',
  adviserName: raw.adviserName ?? '',
});

export const sectionsApi = {
  paged: async (
    params: { schoolYearId: string; gradeLevelId: string; pageNumber: number; search?: string },
    pageSize = 20
  ): Promise<PagedResult<Section>> => {
    const res = await initializeApi().get(`${BASE}/paged`, {
      params: {
        ...params,
        gradeLevelId: params.gradeLevelId || undefined,
        search: params.search || undefined,
        pageSize,
      },
    });
    return toPaged(unwrap<any>(res.data), mapSection, params.pageNumber, pageSize);
  },

  /** Every section of the school year (all pages), for name lookups and the enrollment pickers */
  allForSchoolYear: async (schoolYearId: string): Promise<Section[]> => {
    const all: Section[] = [];
    for (let page = 1; page <= 20; page++) {
      const result = await sectionsApi.paged({ schoolYearId, gradeLevelId: '', pageNumber: page }, 100);
      all.push(...result.items);
      if (!result.hasNextPage) break;
    }
    return all;
  },

  create: async (input: SectionInput): Promise<void> => {
    await initializeApi().post(BASE, input);
  },

  update: async (id: string, input: SectionInput): Promise<void> => {
    await initializeApi().put(`${BASE}/${id}`, input);
  },

  remove: async (id: string): Promise<void> => {
    await initializeApi().delete(`${BASE}/${id}`);
  },

  assignAdviser: async (id: string, adviserTeacherProfileId: string): Promise<void> => {
    await initializeApi().put(`${BASE}/${id}/adviser`, { adviserTeacherProfileId });
  },

  unassignAdviser: async (id: string): Promise<void> => {
    await initializeApi().delete(`${BASE}/${id}/adviser`);
  },
};
