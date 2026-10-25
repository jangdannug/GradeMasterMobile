import { initializeApi, unwrap } from '../api';
import { toDateOnly, toIsoDate } from '../school-setup/dates';

export interface SchoolYear {
  schoolYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  enrollmentStartDate: string | null;
  enrollmentEndDate: string | null;
  isActive: boolean;
  status: number;
}

export const schoolYearsApi = {
  list: async (): Promise<SchoolYear[]> => {
    const res = await initializeApi().get('/api/SchoolYear');
    return unwrap<SchoolYear[]>(res.data) ?? [];
  },
};

// ---- School Setup (full management) ----------------------------------------------------------

export interface SetupSchoolYear {
  id: string;
  name: string;
  startDate: string; // yyyy-MM-dd
  endDate: string;
  enrollmentStartDate: string;
  enrollmentEndDate: string;
  isActive: boolean;
  isDraft: boolean; // server status 0
  activateOnStart: boolean; // server status 1
  isLocked: boolean;
}

export type SchoolYearInput = Omit<SetupSchoolYear, 'id' | 'isLocked'>;

export const mapSchoolYear = (raw: any): SetupSchoolYear => ({
  id: raw.schoolYearId,
  name: raw.name ?? '',
  startDate: toDateOnly(raw.startDate),
  endDate: toDateOnly(raw.endDate),
  enrollmentStartDate: toDateOnly(raw.enrollmentStartDate),
  enrollmentEndDate: toDateOnly(raw.enrollmentEndDate),
  isActive: !!raw.isActive,
  isDraft: raw.status === 0,
  activateOnStart: raw.status === 1,
  isLocked: false,
});

const toPayload = (input: SchoolYearInput) => ({
  name: input.name,
  startDate: toIsoDate(input.startDate),
  endDate: toIsoDate(input.endDate),
  // The backend's enrollment dates are non-nullable: blank ones must be omitted (not "" or null)
  ...(input.enrollmentStartDate ? { enrollmentStartDate: toIsoDate(input.enrollmentStartDate) } : {}),
  ...(input.enrollmentEndDate ? { enrollmentEndDate: toIsoDate(input.enrollmentEndDate) } : {}),
  isActive: input.isActive,
  status: input.isDraft ? 0 : 1,
});

export const setupSchoolYearsApi = {
  list: async (): Promise<SetupSchoolYear[]> => {
    const res = await initializeApi().get('/api/SchoolYear');
    const data = unwrap<any[]>(res.data);
    return (Array.isArray(data) ? data : []).map(mapSchoolYear);
  },

  create: async (input: SchoolYearInput): Promise<SetupSchoolYear> => {
    const res = await initializeApi().post('/api/SchoolYear', toPayload(input));
    return mapSchoolYear(unwrap<any>(res.data));
  },

  update: async (id: string, input: SchoolYearInput): Promise<SetupSchoolYear> => {
    const res = await initializeApi().put(`/api/SchoolYear/${id}`, toPayload(input));
    return mapSchoolYear(unwrap<any>(res.data));
  },

  remove: async (id: string): Promise<void> => {
    await initializeApi().delete(`/api/SchoolYear/${id}`);
  },
};
