import { asList, initializeApi, PagedResult, toPaged, unwrap } from '../api';

export interface UserProfile {
  userProfileId: string;
  userId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  employeeNumber: string;
  licenseNumber: string;
  hireDate: string; // yyyy-MM-dd or ''
  employmentStatus: string;
  positionId: string;
  positionName: string;
  positionType: number | null;
}

const mapProfile = (raw: any): UserProfile => ({
  userProfileId: raw.userProfileId,
  userId: raw.userId ?? '',
  firstName: raw.firstName ?? '',
  middleName: raw.middleName ?? '',
  lastName: raw.lastName ?? '',
  email: raw.email ?? '',
  employeeNumber: raw.employeeNumber ?? '',
  licenseNumber: raw.licenseNumber ?? '',
  hireDate: raw.hireDate ? String(raw.hireDate).slice(0, 10) : '',
  employmentStatus: raw.employmentStatus ?? '',
  positionId: raw.positionId ?? '',
  positionName: raw.positionName ?? '',
  positionType: raw.positionType ?? null,
});

/** "Last, First, Middle" (falls back to the last name, then the email) */
export const teacherLabel = (t: Pick<UserProfile, 'firstName' | 'middleName' | 'lastName' | 'email'>) =>
  [t.lastName, t.firstName, t.middleName].filter(Boolean).join(', ') || t.lastName || t.email || 'Teacher';

const MAX_PAGES = 20;

export const userProfilesApi = {
  /** One page of teaching staff (the query param is the lowercase `positiontype`) */
  pagedTeachers: async (pageNumber: number, search: string, pageSize = 50): Promise<PagedResult<UserProfile>> => {
    const res = await initializeApi().get('/api/UserProfile/paged', {
      params: { pageNumber, pageSize, positiontype: 'teaching', search: search || undefined },
    });
    return toPaged(unwrap<any>(res.data), mapProfile, pageNumber, pageSize);
  },

  /** The whole teacher roster for the pickers: loops pages of 100 until the last one */
  allTeachers: async (): Promise<UserProfile[]> => {
    const all: UserProfile[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await userProfilesApi.pagedTeachers(page, '', 100);
      all.push(...result.items);
      if (!result.hasNextPage) break;
    }
    return all;
  },
};

// ---- User management (School Head) -----------------------------------------------------------------

export interface PositionRef {
  positionId: string;
  code: string;
  name: string;
  positionType: number | null;
}

export interface DesignationRef {
  userDesignationId: string;
  code: string;
  name: string;
}

export const EMPLOYMENT_STATUSES = ['Permanent', 'Probationary', 'Contractual', 'Part-Time'] as const;

export interface UserProfileInput {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  employeeNumber: string;
  licenseNumber: string;
  /** yyyy-MM-dd */
  hireDate: string;
  employmentStatus: string;
  positionId: string;
  designationIds: string[];
  /** Create only */
  schoolId?: string;
}

/** "First Middle Last", skipping blanks */
export const fullName = (u: Pick<UserProfile, 'firstName' | 'middleName' | 'lastName'>) =>
  [u.firstName, u.middleName, u.lastName].filter(Boolean).join(' ');

// A bare date makes the API fail or shift the day: send a full ISO instant at UTC midnight
const hireDateIso = (date: string) => new Date(`${date}T00:00:00.000Z`).toISOString();

const payload = (input: UserProfileInput, creating: boolean) => ({
  firstName: input.firstName.trim(),
  middleName: input.middleName.trim(),
  lastName: input.lastName.trim(),
  email: input.email.trim(),
  employeeNumber: input.employeeNumber.trim(),
  licenseNumber: input.licenseNumber.trim(),
  hireDate: hireDateIso(input.hireDate),
  employmentStatus: input.employmentStatus,
  positionId: input.positionId,
  // On edit the existing bindings are unreadable: only send designations when some were picked
  ...(creating ? { designationIds: input.designationIds, schoolId: input.schoolId } : {}),
  ...(!creating && input.designationIds.length > 0 ? { designationIds: input.designationIds } : {}),
});

export const userManagementApi = {
  paged: async (pageNumber: number, search: string, pageSize = 50): Promise<PagedResult<UserProfile>> => {
    const res = await initializeApi().get('/api/UserProfile/paged', {
      params: { pageNumber, pageSize, search: search || undefined },
    });
    return toPaged(unwrap<any>(res.data) ?? res.data, mapProfile, pageNumber, pageSize);
  },

  positions: async (): Promise<PositionRef[]> => {
    const res = await initializeApi().get('/api/UserProfile/positions');
    return asList<any>(unwrap<any>(res.data) ?? res.data).map((p) => ({
      positionId: p.positionId,
      code: p.code ?? '',
      name: p.name ?? '',
      positionType: p.positionType ?? null,
    }));
  },

  designations: async (): Promise<DesignationRef[]> => {
    const res = await initializeApi().get('/api/UserProfile/designations');
    return asList<any>(unwrap<any>(res.data) ?? res.data).map((d) => ({
      userDesignationId: d.userDesignationId,
      code: d.code ?? '',
      name: d.name ?? '',
    }));
  },

  create: async (input: UserProfileInput): Promise<void> => {
    await initializeApi().post('/api/UserProfile/register', payload(input, true));
  },

  update: async (userProfileId: string, input: UserProfileInput): Promise<void> => {
    await initializeApi().put(`/api/UserProfile/${userProfileId}`, payload(input, false));
  },

  remove: async (userProfileId: string): Promise<void> => {
    await initializeApi().delete(`/api/UserProfile/${userProfileId}`);
  },
};
