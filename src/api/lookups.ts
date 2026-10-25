import { asList, initializeApi, unwrap } from '../api';

export interface Lookup {
  id: number;
  name: string;
  group: string;
}

const fetchLookup = async (kind: string): Promise<Lookup[]> => {
  const res = await initializeApi().get(`/api/Common/${kind}`);
  return asList<any>(unwrap<any>(res.data)).map((raw) => ({
    id: raw.id,
    name: raw.name ?? '',
    group: raw.group ?? '',
  }));
};

export const lookupsApi = {
  languages: () => fetchLookup('languages'),
  religions: () => fetchLookup('religions'),
  ethnicities: () => fetchLookup('indigenous-ethnicities'),
  lsenTypes: () => fetchLookup('lsen-types'),
};

export type LookupKind = keyof typeof lookupsApi;
