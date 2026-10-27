import { initializeApi, peel, peelList } from '../api';
import { encodeAnswers, mapAnswerSheet, type AnswerSheet } from '../answer-sheet/answerSheet';

const BASE = '/api/AnswerSheet';

export const answerSheetsApi = {
  /** The signed-in teacher's sheets (the backend resolves the teacher from the token) */
  list: async (schoolYearId?: string): Promise<AnswerSheet[]> => {
    const res = await initializeApi().get(BASE, { params: schoolYearId ? { schoolYearId } : undefined });
    return peelList(res.data).map(mapAnswerSheet);
  },

  /** One sheet with its answer key; only the subject teacher of the sheet's class may read it */
  get: async (answerSheetId: string): Promise<AnswerSheet | null> => {
    const res = await initializeApi().get(`${BASE}/${answerSheetId}`);
    const raw = peel(res.data, 'answerSheetId');
    return raw ? mapAnswerSheet(raw) : null;
  },

  /** Replaces a sheet's answer key (from a scanned answer key copy); everything else stays as it is */
  saveAnswerKey: async (sheet: AnswerSheet, answers: (number | null)[]): Promise<AnswerSheet | null> => {
    const res = await initializeApi().put(`${BASE}/${sheet.id}`, {
      classSubjectOfferingId: sheet.offeringId,
      gradingPeriodId: sheet.gradingPeriodId,
      gradingComponentItemId: sheet.gradingComponentItemId,
      title: sheet.title,
      itemCount: sheet.itemCount,
      choiceCount: sheet.choiceCount,
      answers: encodeAnswers(answers),
      trueFalseCount: sheet.trueFalseCount,
      essayPoints: sheet.essayPoints,
      partOrder: sheet.partOrder.join(','),
    });
    const raw = peel(res.data, 'answerSheetId');
    return raw ? mapAnswerSheet(raw) : null;
  },
};
