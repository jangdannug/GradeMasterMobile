import { isTrueFalseItem, normalizePartOrder, type PartKind, type SheetShape } from './sheetLayout.ts';

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
  /** How many items are true-or-false (T = 0, F = 1); the rest are multiple choice */
  trueFalseCount: number;
  /** Max points of each hand-marked essay, in order; their total is part of `maxScore` */
  essayPoints: number[];
  /** Order of the parts on the printed sheet (Test I, II, III) */
  partOrder: PartKind[];
}

export const essayTotal = (sheet: Pick<AnswerSheet, 'essayPoints'>) => sheet.essayPoints.reduce((a, b) => a + b, 0);

/** What a bubble is labelled: T / F on a true-or-false item, a letter otherwise */
export const choiceLabel = (shape: SheetShape, item: number, choice: number) =>
  isTrueFalseItem(shape, item) ? (choice === 0 ? 'T' : 'F') : String.fromCharCode(97 + choice);

const UNSET = '-';

/** The API stores the key as one letter per item, '-' for an unset item */
export const decodeAnswers = (raw: string): (number | null)[] =>
  [...(raw ?? '')].map((c) => (c === UNSET ? null : c.charCodeAt(0) - 97));

export const encodeAnswers = (answers: (number | null)[]): string =>
  answers.map((a) => (a === null ? UNSET : String.fromCharCode(97 + a))).join('');

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
  trueFalseCount: Number(raw?.trueFalseCount) || 0,
  essayPoints: Array.isArray(raw?.essayPoints) ? raw.essayPoints.map(Number) : [],
  partOrder: normalizePartOrder(typeof raw?.partOrder === 'string' ? raw.partOrder.split(',') : undefined),
});

/** What the QR code printed on a sheet resolves to: the sheet and the student it belongs to */
export interface AnswerSheetQr {
  sheetId: string;
  offeringId: string;
  gradingPeriodId: string;
  gradingComponentItemId: string;
  /** Null on a blank copy (the student is only known from the written name) and on the answer key copy */
  enrollmentId: string | null;
  /** The teacher's answer key copy: scanning it sets the sheet's correct answers instead of a score */
  isKey: boolean;
}

/** Stands in for the student on the answer key copy's QR code */
const KEY_MARK = 'K';

const COMPACT = /^[0-9A-F]{32}$/;
const QR_PREFIX = 'GM1';
const expandGuid = (c: string) =>
  `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20)}`.toLowerCase();

/** Mirror of the web app's `parseAnswerSheetQr` — the printed format is `GM1:<5 compact GUIDs>` or JSON */
export function parseAnswerSheetQr(raw: string): AnswerSheetQr | null {
  try {
    if (raw.startsWith(`${QR_PREFIX}:`)) {
      const parts = raw.split(':').slice(1);
      const isKey = parts[4] === KEY_MARK;
      if (parts.length !== 5 || !parts.slice(0, 4).every((p) => COMPACT.test(p)) || (parts[4] && !isKey && !COMPACT.test(parts[4]))) {
        return null;
      }
      const [sheetId, offeringId, gradingPeriodId, gradingComponentItemId] = parts.map(expandGuid);
      const enrollmentId = parts[4] && !isKey ? expandGuid(parts[4]) : null;
      return { sheetId, offeringId, gradingPeriodId, gradingComponentItemId, enrollmentId, isKey };
    }
    const { s, o, g, i, e, k } = JSON.parse(raw);
    const ok = [s, o, g, i].every((v) => typeof v === 'string' && v);
    return ok && (e === null || typeof e === 'string')
      ? { sheetId: s, offeringId: o, gradingPeriodId: g, gradingComponentItemId: i, enrollmentId: k ? null : e || null, isKey: k === true }
      : null;
  } catch {
    return null;
  }
}

/**
 * Score for one student: correct answers scaled to the bubbled share of the bound item's max score
 * (the max minus the essays' total; 1 point each when that equals the item count), plus the essay
 * points the teacher gave. Items without a key entry are ignored; blank or multiple marks (null) count as wrong.
 */
export function scoreAnswers(
  sheet: Pick<AnswerSheet, 'answers' | 'maxScore' | 'essayPoints'>,
  studentAnswers: (number | null)[],
  essayGiven = 0
): number {
  const keyed = sheet.answers.map((key, i) => ({ key, given: studentAnswers[i] ?? null })).filter((x) => x.key !== null);
  const correct = keyed.filter((x) => x.key === x.given).length;
  const objective = keyed.length === 0 ? 0 : (correct * (sheet.maxScore - essayTotal(sheet))) / keyed.length;
  return Math.round((objective + essayGiven) * 100) / 100;
}
