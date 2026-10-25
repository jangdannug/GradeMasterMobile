import { initializeApi, unwrap } from '../api';

const BASE = '/api/School';

export interface SchoolDistrictRef {
  districtId: string;
  name: string;
  code: string;
  regionName: string;
  divisionName: string;
}

export interface SchoolHeadRef {
  userProfileId: string;
  employeeNumber: string;
  licenseNumber: string;
}

export interface School {
  schoolId: string;
  depEdSchoolId: string;
  name: string;
  code: string;
  description: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  cityMunicipality: string;
  province: string;
  region: string;
  type: string;
  schoolHeadId: string | null;
  districtId: string | null;
  district: SchoolDistrictRef | null;
  schoolHead: SchoolHeadRef | null;
  // Local only: the backend has no notion of an "active" school
  isActive: boolean;
}

export interface CreateSchoolInput {
  name: string;
  depEdSchoolId: string;
  code: string;
  description: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  cityMunicipality: string;
  province: string;
  districtId: string | null;
  schoolHeadId: string | null;
}

// API nulls become empty strings at the boundary
export const mapSchool = (raw: any): School => ({
  schoolId: raw.schoolId,
  depEdSchoolId: raw.depEdSchoolId ?? '',
  name: raw.name ?? '',
  code: raw.code ?? '',
  description: raw.description ?? '',
  addressLine1: raw.addressLine1 ?? '',
  addressLine2: raw.addressLine2 ?? '',
  postalCode: raw.postalCode ?? '',
  cityMunicipality: raw.cityMunicipality ?? '',
  province: raw.province ?? '',
  region: raw.region ?? raw.district?.regionName ?? '',
  type: raw.type != null ? String(raw.type) : '',
  schoolHeadId: raw.schoolHeadId ?? null,
  districtId: raw.district?.districtId ?? raw.districtId ?? null,
  district: raw.district
    ? {
        districtId: raw.district.districtId ?? '',
        name: raw.district.name ?? '',
        code: raw.district.code ?? '',
        regionName: raw.district.regionName ?? '',
        divisionName: raw.district.divisionName ?? '',
      }
    : null,
  schoolHead: raw.schoolHeadProfile
    ? {
        userProfileId: raw.schoolHeadProfile.userProfileId,
        employeeNumber: raw.schoolHeadProfile.employeeNumber ?? '',
        licenseNumber: raw.schoolHeadProfile.licenseNumber ?? '',
      }
    : null,
  isActive: false,
});

export const schoolsApi = {
  list: async (): Promise<School[]> => {
    const res = await initializeApi().get(BASE);
    const data = unwrap<any[]>(res.data);
    return (Array.isArray(data) ? data : []).map(mapSchool);
  },

  create: async (input: CreateSchoolInput): Promise<School> => {
    const res = await initializeApi().post(`${BASE}/`, input);
    const data = unwrap<any>(res.data);
    const created = Array.isArray(data) ? data[0] : data;
    if (!created) throw new Error('No school returned from create endpoint');
    return mapSchool(created);
  },

  // TODO: the backend exposes no update or delete endpoint for schools yet; the Schools tab edits
  // and removes locally in the react-query cache only (same as the web app).
};
