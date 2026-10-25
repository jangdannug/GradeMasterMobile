import { asList, initializeApi, unwrap } from '../api';

const BASE = '/api/GradingDescriptor';

export interface GradingDescriptorSet {
  id: string;
  code: string;
  name: string;
  isActiveForScheme: boolean;
  isLocked: boolean;
}

export interface DescriptorEntry {
  id: string;
  minGrade: number;
  maxGrade: number;
  descriptor: string;
  sortOrder: number;
  descriptorColor: string;
}

export interface DescriptorEntryInput {
  minGrade: number;
  maxGrade: number;
  descriptor: string;
  sortOrder: number;
  descriptorColor: string;
}

const mapSet = (raw: any): GradingDescriptorSet => ({
  id: raw.gradingDescriptorId,
  code: raw.code ?? '',
  name: raw.name ?? '',
  isActiveForScheme: !!raw.isActiveForScheme,
  isLocked: !!raw.isLocked,
});

const mapEntry = (raw: any): DescriptorEntry => ({
  id: raw.gradingDescriptorEntryId,
  minGrade: Number(raw.minGrade) || 0,
  maxGrade: Number(raw.maxGrade) || 0,
  descriptor: raw.descriptor ?? '',
  sortOrder: raw.sortOrder ?? 0,
  descriptorColor: raw.descriptorColor ?? '',
});

export const gradingDescriptorsApi = {
  list: async (): Promise<GradingDescriptorSet[]> => {
    const res = await initializeApi().get(BASE);
    return asList(unwrap<any>(res.data), ['descriptors']).map(mapSet);
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

  entries: async (setId: string): Promise<DescriptorEntry[]> => {
    const res = await initializeApi().get(`${BASE}/${setId}/entries`);
    return asList(unwrap<any>(res.data), ['entries'])
      .map(mapEntry)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  createEntry: async (setId: string, input: DescriptorEntryInput): Promise<void> => {
    await initializeApi().post(`${BASE}/${setId}/entries`, input);
  },

  updateEntry: async (entryId: string, input: DescriptorEntryInput): Promise<void> => {
    await initializeApi().put(`${BASE}/entries/${entryId}`, input);
  },

  removeEntry: async (entryId: string): Promise<void> => {
    await initializeApi().delete(`${BASE}/entries/${entryId}`);
  },

  /** Bulk upsert, used to persist a reorder */
  replaceEntries: async (setId: string, entries: DescriptorEntry[]): Promise<void> => {
    await initializeApi().put(`${BASE}/${setId}/entries`, {
      entries: entries.map((e) => ({
        gradingDescriptorEntryId: e.id,
        minGrade: e.minGrade,
        maxGrade: e.maxGrade,
        descriptor: e.descriptor,
        sortOrder: e.sortOrder,
        descriptorColor: e.descriptorColor,
      })),
    });
  },
};
