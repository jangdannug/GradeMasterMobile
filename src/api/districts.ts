import { initializeApi, unwrap } from '../api';

const BASE = '/api/District';

export interface District {
  districtId: string;
  code: string;
  name: string;
  website: string;
  divisionName: string;
  regionName: string;
  psdsUserProfileId: string | null;
}

export interface DistrictInput {
  code: string;
  name: string;
  website: string;
  regionName: string;
  divisionName: string;
  psdsUserProfileId?: string | null;
}

// API nulls become empty strings at the boundary
export const mapDistrict = (raw: any): District => ({
  districtId: raw.districtId,
  code: raw.code ?? '',
  name: raw.name ?? '',
  website: raw.website ?? '',
  divisionName: raw.divisionName ?? '',
  regionName: raw.regionName ?? '',
  psdsUserProfileId: raw.psdsUserProfileId ?? null,
});

export const districtsApi = {
  list: async (): Promise<District[]> => {
    const res = await initializeApi().get(BASE);
    const data = unwrap<any[]>(res.data);
    return (Array.isArray(data) ? data : []).map(mapDistrict);
  },

  create: async (input: DistrictInput): Promise<District> => {
    const res = await initializeApi().post(BASE, input);
    return mapDistrict(unwrap<any>(res.data));
  },

  update: async (districtId: string, input: DistrictInput): Promise<District> => {
    const res = await initializeApi().put(`${BASE}/${districtId}`, input);
    return mapDistrict(unwrap<any>(res.data));
  },

  remove: async (districtId: string): Promise<void> => {
    await initializeApi().delete(`${BASE}/${districtId}`);
  },
};
