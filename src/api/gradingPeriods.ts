import { initializeApi, unwrap } from '../api';
import { toDateOnly, toIsoDate, todayString } from '../school-setup/dates';

const BASE = '/api/GradingPeriod';

export interface GradingPeriod {
  id: string;
  schoolYearId: string;
  code: string;
  name: string;
  sequenceNo: number;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd
  isLocked: boolean;
  isActive: boolean;
}

export interface GradingPeriodInput {
  code: string;
  name: string;
  sequenceNo: number;
  startDate: string;
  endDate: string;
}

const mapPeriod = (raw: any): GradingPeriod => {
  const startDate = toDateOnly(raw.startDate);
  const endDate = toDateOnly(raw.endDate);
  const today = todayString();
  return {
    id: raw.gradingPeriodId,
    schoolYearId: raw.schoolYearId,
    code: raw.code ?? '',
    name: raw.name ?? '',
    sequenceNo: raw.sequenceNo ?? 0,
    startDate,
    endDate,
    isLocked: !!raw.isLocked,
    isActive: !!startDate && !!endDate && today >= startDate && today <= endDate,
  };
};

export const gradingPeriodsApi = {
  listBySchoolYear: async (schoolYearId: string): Promise<GradingPeriod[]> => {
    const res = await initializeApi().get(`${BASE}/school-year/${schoolYearId}`);
    const data = unwrap<any[]>(res.data);
    return (Array.isArray(data) ? data : []).map(mapPeriod);
  },

  create: async (input: GradingPeriodInput & { schoolYearId: string }): Promise<GradingPeriod> => {
    const res = await initializeApi().post(BASE, {
      ...input,
      startDate: toIsoDate(input.startDate),
      endDate: toIsoDate(input.endDate),
    });
    return mapPeriod(unwrap<any>(res.data));
  },

  update: async (gradingPeriodId: string, input: GradingPeriodInput): Promise<GradingPeriod> => {
    const res = await initializeApi().put(`${BASE}/${gradingPeriodId}`, {
      ...input,
      startDate: toIsoDate(input.startDate),
      endDate: toIsoDate(input.endDate),
    });
    return mapPeriod(unwrap<any>(res.data));
  },

  remove: async (gradingPeriodId: string): Promise<void> => {
    await initializeApi().delete(`${BASE}/${gradingPeriodId}`);
  },
};
