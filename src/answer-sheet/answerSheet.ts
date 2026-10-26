/** An answer sheet as the API returns it (`GET /api/AnswerSheet`), with the key decoded. */
export interface AnswerSheet {
  id: string;
  title: string;
  schoolYearId: string;
  offeringId: string;
  gradingPeriodId: string;
  gradingComponentId: string;
  gradingComponentItemId: string;
  subject: string;
  section: string;
  term: string;
  category: string;
  itemName: string;
  /** Max score of the bound item; correct answers are scaled to it */
  maxScore: number;
  itemCount: number;
  choiceCount: number;
  /** Correct choice index per item (0 = a); null when the item has no answer set */
  answers: (number | null)[];
}

const UNSET = '-';

/** The API stores the key as one letter per item, '-' for an unset item */
export const decodeAnswers = (raw: string): (number | null)[] =>
  [...(raw ?? '')].map((c) => (c === UNSET ? null : c.charCodeAt(0) - 97));

export const mapAnswerSheet = (raw: any): AnswerSheet => ({
  id: String(raw?.answerSheetId ?? ''),
  title: String(raw?.title ?? ''),
  schoolYearId: String(raw?.schoolYearId ?? ''),
  offeringId: String(raw?.classSubjectOfferingId ?? ''),
  gradingPeriodId: String(raw?.gradingPeriodId ?? ''),
  gradingComponentId: String(raw?.gradingComponentId ?? ''),
  gradingComponentItemId: String(raw?.gradingComponentItemId ?? ''),
  subject: String(raw?.subjectName ?? ''),
  section: String(raw?.sectionName ?? ''),
  term: String(raw?.gradingPeriodName ?? ''),
  category: String(raw?.componentName ?? ''),
  itemName: String(raw?.itemName ?? ''),
  maxScore: Number(raw?.maxScore) || 0,
  itemCount: Number(raw?.itemCount) || 0,
  choiceCount: Number(raw?.choiceCount) || 0,
  answers: decodeAnswers(raw?.answers),
});

/** What the QR code printed on a sheet resolves to: the sheet and the student it belongs to */
export interface AnswerSheetQr {
  sheetId: string;
  offeringId: string;
  gradingPeriodId: string;
  gradingComponentItemId: string;
  /** Null on a blank copy: the student is only known from the written name */
  enrollmentId: string | null;
}

const COMPACT = /^[0-9A-F]{32}$/;
const QR_PREFIX = 'GM1';
const expandGuid = (c: string) =>
  `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20)}`.toLowerCase();

/** Mirror of the web app's `parseAnswerSheetQr` — the printed format is `GM1:<5 compact GUIDs>` or JSON */
export function parseAnswerSheetQr(raw: string): AnswerSheetQr | null {
  try {
    if (raw.startsWith(`${QR_PREFIX}:`)) {
      const parts = raw.split(':').slice(1);
      if (parts.length !== 5 || !parts.slice(0, 4).every((p) => COMPACT.test(p)) || (parts[4] && !COMPACT.test(parts[4]))) {
        return null;
      }
      const [sheetId, offeringId, gradingPeriodId, gradingComponentItemId] = parts.map(expandGuid);
      return { sheetId, offeringId, gradingPeriodId, gradingComponentItemId, enrollmentId: parts[4] ? expandGuid(parts[4]) : null };
    }
    const { s, o, g, i, e } = JSON.parse(raw);
    const ok = [s, o, g, i].every((v) => typeof v === 'string' && v);
    return ok && (e === null || typeof e === 'string')
      ? { sheetId: s, offeringId: o, gradingPeriodId: g, gradingComponentItemId: i, enrollmentId: e || null }
      : null;
  } catch {
    return null;
  }
}

/**
 * Score for one student's answers: correct answers scaled to the bound item's max score
 * (1 point each when the item count equals the max score). Items without a key entry are
 * ignored; blank or multiple marks (null) count as wrong.
 */
export function scoreAnswers(sheet: Pick<AnswerSheet, 'answers' | 'maxScore'>, studentAnswers: (number | null)[]): number {
  const keyed = sheet.answers.map((key, i) => ({ key, given: studentAnswers[i] ?? null })).filter((x) => x.key !== null);
  if (keyed.length === 0) return 0;
  const correct = keyed.filter((x) => x.key === x.given).length;
  return Math.round(((correct * sheet.maxScore) / keyed.length) * 100) / 100;
}
