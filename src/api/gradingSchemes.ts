import { asList, initializeApi, unwrap } from '../api';

const BASE = '/api/GradingScheme';

export interface GradingScheme {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystemDefined: boolean;
  isPublished: boolean;
  isLocked: boolean;
  activationId: string | null;
  isActive: boolean;
  activatedAt: string | null;
  transmutationTableId: string;
  gradingDescriptorId: string;
}

export interface GradingComponent {
  id: string;
  gradingSchemeId: string;
  name: string;
  weightPercent: number;
  sequenceNo: number;
}

export interface GradingItem {
  id: string;
  gradingComponentId: string;
  name: string;
  weightPercent: number;
  maxScore: number;
  sequenceNo: number;
}

export interface SchemeSubjectRow {
  gradingSchemeSubjectId: string;
  gradingSchemeId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
}

export interface SchemeFormInput {
  code: string;
  name: string;
  description: string;
}

export interface ItemInput {
  name: string;
  weightPercent: number;
  maxScore: number;
  sequenceNo: number;
}

// API nulls become empty strings at the boundary
export const mapScheme = (raw: any): GradingScheme => ({
  id: raw.gradingSchemeId,
  code: raw.code ?? '',
  name: raw.name ?? '',
  description: raw.description ?? '',
  isSystemDefined: !!raw.isSystemDefined,
  isPublished: !!raw.isPublished,
  isLocked: !!raw.isLocked,
  activationId: raw.activationId ?? null,
  isActive: !!raw.isActiveForSchoolYear,
  activatedAt: raw.activatedAt ?? null,
  transmutationTableId: raw.transmutationTableId ?? '',
  gradingDescriptorId: raw.gradingDescriptorId ?? '',
});

const mapComponent = (raw: any): GradingComponent => ({
  id: raw.gradingComponentId,
  gradingSchemeId: raw.gradingSchemeId ?? '',
  name: raw.name ?? '',
  weightPercent: Number(raw.weightPercent) || 0,
  sequenceNo: raw.sequenceNo ?? 0,
});

const mapItem = (raw: any): GradingItem => ({
  id: raw.gradingComponentItemId,
  gradingComponentId: raw.gradingComponentId ?? '',
  name: raw.name ?? '',
  weightPercent: Number(raw.weightPercent) || 0,
  maxScore: Number(raw.maxScore) || 0,
  sequenceNo: raw.sequenceNo ?? 0,
});

export const gradingSchemesApi = {
  listBySchoolYear: async (schoolYearId: string): Promise<GradingScheme[]> => {
    const res = await initializeApi().get(`${BASE}/school-year/${schoolYearId}`);
    return asList(unwrap<any>(res.data)).map(mapScheme);
  },

  get: async (id: string): Promise<GradingScheme> => {
    const res = await initializeApi().get(`${BASE}/${id}`);
    return mapScheme(unwrap<any>(res.data));
  },

  create: async (input: SchemeFormInput): Promise<void> => {
    await initializeApi().post(BASE, { ...input, duplicatedFromId: '' });
  },

  /** PUT is a FULL replacement: the conversion-rule links must always be sent back */
  update: async (
    id: string,
    input: SchemeFormInput & { transmutationTableId: string; gradingDescriptorId: string }
  ): Promise<void> => {
    await initializeApi().put(`${BASE}/${id}`, {
      code: input.code,
      name: input.name,
      description: input.description,
      transmutationTableId: input.transmutationTableId || null,
      gradingDescriptorId: input.gradingDescriptorId || null,
    });
  },

  remove: async (id: string): Promise<void> => {
    await initializeApi().delete(`${BASE}/${id}`);
  },

  duplicate: async (id: string, input: SchemeFormInput): Promise<void> => {
    await initializeApi().post(`${BASE}/${id}/duplicate`, input);
  },

  // ---- components -----------------------------------------------------------------------------
  components: async (schemeId: string): Promise<GradingComponent[]> => {
    const res = await initializeApi().get(`${BASE}/${schemeId}/components`);
    return asList(unwrap<any>(res.data))
      .map(mapComponent)
      .sort((a, b) => a.sequenceNo - b.sequenceNo);
  },

  createComponent: async (
    schemeId: string,
    input: { name: string; weightPercent: number; sequenceNo: number }
  ): Promise<void> => {
    await initializeApi().post(`${BASE}/${schemeId}/components`, { ...input, gradingSchemeId: schemeId });
  },

  /** REPLACES THE WHOLE LIST: any component left out is deleted, so always send every sibling */
  replaceComponents: async (schemeId: string, components: GradingComponent[]): Promise<void> => {
    await initializeApi().put(`${BASE}/${schemeId}/components`, {
      components: components.map((c) => ({
        gradingComponentId: c.id,
        name: c.name,
        weightPercent: c.weightPercent,
        sequenceNo: c.sequenceNo,
      })),
    });
  },

  removeComponent: async (schemeId: string, componentId: string): Promise<void> => {
    await initializeApi().delete(`${BASE}/${schemeId}/components/${componentId}`);
  },

  // ---- component items ------------------------------------------------------------------------
  items: async (schemeId: string, componentId: string): Promise<GradingItem[]> => {
    const res = await initializeApi().get(`${BASE}/${schemeId}/components/${componentId}/items`);
    return asList(unwrap<any>(res.data))
      .map(mapItem)
      .sort((a, b) => a.sequenceNo - b.sequenceNo);
  },

  createItem: async (schemeId: string, componentId: string, input: ItemInput): Promise<void> => {
    await initializeApi().post(`${BASE}/${schemeId}/components/${componentId}/items`, input);
  },

  updateItem: async (schemeId: string, componentId: string, itemId: string, input: ItemInput): Promise<void> => {
    await initializeApi().put(`${BASE}/${schemeId}/components/${componentId}/items/${itemId}`, input);
  },

  removeItem: async (schemeId: string, componentId: string, itemId: string): Promise<void> => {
    await initializeApi().delete(`${BASE}/${schemeId}/components/${componentId}/items/${itemId}`);
  },

  // ---- scheme <-> subject assignment ----------------------------------------------------------
  subjects: async (schemeId: string): Promise<SchemeSubjectRow[]> => {
    const res = await initializeApi().get(`${BASE}/${schemeId}/subjects`);
    return asList<any>(unwrap<any>(res.data), ['subjects', 'gradingSchemeSubjects']).map((r) => ({
      gradingSchemeSubjectId: r.gradingSchemeSubjectId ?? '',
      gradingSchemeId: r.gradingSchemeId ?? schemeId,
      subjectId: r.subjectId,
      subjectCode: r.subjectCode ?? '',
      subjectName: r.subjectName ?? '',
    }));
  },

  /** Body is the COMPLETE array of subject ids; it replaces the scheme's list */
  replaceSubjects: async (schemeId: string, subjectIds: string[]): Promise<void> => {
    await initializeApi().put(`${BASE}/${schemeId}/subjects`, subjectIds);
  },

  // ---- activation -----------------------------------------------------------------------------
  activate: async (schoolYearId: string, schemeId: string): Promise<void> => {
    await initializeApi().post(`${BASE}/school-year/${schoolYearId}/activations/${schemeId}`);
  },

  deactivate: async (schoolYearId: string, schemeId: string): Promise<void> => {
    await initializeApi().delete(`${BASE}/school-year/${schoolYearId}/activations/${schemeId}`);
  },
};
