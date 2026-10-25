import { asList, initializeApi, unwrap } from '../api';

const BASE = '/api/TransmutationTable';

export interface TransmutationTable {
  id: string;
  code: string;
  name: string;
  isActiveForScheme: boolean;
  isLocked: boolean;
}

export interface TransmutationEntry {
  id: string;
  initialGrade: number;
  maxInitialGrade: number;
  transmutedGrade: number;
}

export interface TransmutationEntryInput {
  initialGrade: number;
  maxInitialGrade: number;
  transmutedGrade: number;
}

const mapTable = (raw: any): TransmutationTable => ({
  id: raw.transmutationTableId,
  code: raw.code ?? '',
  name: raw.name ?? '',
  isActiveForScheme: !!raw.isActiveForScheme,
  isLocked: !!raw.isLocked,
});

const mapEntry = (raw: any): TransmutationEntry => ({
  id: raw.transmutationEntryId,
  initialGrade: Number(raw.initialGrade) || 0,
  maxInitialGrade: Number(raw.maxInitialGrade) || 0,
  transmutedGrade: Number(raw.transmutedGrade) || 0,
});

export const transmutationApi = {
  list: async (): Promise<TransmutationTable[]> => {
    const res = await initializeApi().get(BASE);
    return asList(unwrap<any>(res.data), ['tables']).map(mapTable);
  },

  create: async (input: { code: string; name: string }): Promise<void> => {
    await initializeApi().post(BASE, input);
  },

  update: async (id: string, input: { code: string; name: string }): Promise<void> => {
    await initializeApi().put(`${BASE}/${id}`, input);
  },

  remove: async (id: string): Promise<void> => {
    await initializeApi().delete(`${BASE}/${id}`);
  },

  entries: async (tableId: string): Promise<TransmutationEntry[]> => {
    const res = await initializeApi().get(`${BASE}/${tableId}/entries`);
    return asList(unwrap<any>(res.data), ['entries'])
      .map(mapEntry)
      .sort((a, b) => b.initialGrade - a.initialGrade);
  },

  createEntry: async (tableId: string, input: TransmutationEntryInput): Promise<void> => {
    await initializeApi().post(`${BASE}/${tableId}/entries`, input);
  },

  updateEntry: async (entryId: string, input: TransmutationEntryInput): Promise<void> => {
    await initializeApi().put(`${BASE}/entries/${entryId}`, input);
  },

  removeEntry: async (entryId: string): Promise<void> => {
    await initializeApi().delete(`${BASE}/entries/${entryId}`);
  },
};
