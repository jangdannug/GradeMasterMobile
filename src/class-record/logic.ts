// Pure logic for the Class Record feature (grade math, validation, status helpers, name search).
// No React or network code here, so it can be unit tested on its own.

// ---- Enums (the API sends numbers) ---------------------------------------------------------------

export const ClassRecordStatus = {
  Draft: 0,
  Submitted: 1,
  Withdrawn: 2,
  Approved: 3,
  Rejected: 4,
  PendingHeadReview: 5,
  ReturnedByHead: 6,
  Locked: 7,
} as const;

export const SectionSubmissionStatus = {
  Draft: 0,
  Submitted: 1,
  Approved: 2,
  Rejected: 3,
  Returned: 4,
} as const;

export const ActivityCategory = { Decision: 0, Comment: 1 } as const;
export const ActivityFilter = { All: 0, Decisions: 1, Comments: 2 } as const;

export const SUBMISSION_ACTIVITY_LABELS: Record<number, string> = {
  0: 'Submitted',
  1: 'Resubmitted',
  2: 'Withdrawn',
  3: 'Approved',
  4: 'Rejected',
  5: 'Returned by School Head',
  6: 'Adviser review skipped',
  7: 'Locked',
  8: 'Comment added',
  9: 'Comment replied',
  10: 'Comment edited',
  11: 'Comment deleted',
};

// ---- Status helpers --------------------------------------------------------------------------------

const STATUS_NAMES = Object.keys(ClassRecordStatus) as (keyof typeof ClassRecordStatus)[];

/** Accepts the status as a number, a numeric string, or the status name; null when unknown */
export function classRecordStatusValue(status: unknown): number | null {
  if (status === null || status === undefined || status === '') return null;
  if (typeof status === 'number') return Number.isFinite(status) ? status : null;
  const text = String(status).trim();
  if (/^\d+$/.test(text)) return Number(text);
  const name = STATUS_NAMES.find((n) => n.toLowerCase() === text.toLowerCase());
  return name ? ClassRecordStatus[name] : null;
}

export type StatusTone = 'info' | 'warning' | 'success' | 'danger' | 'secondary';

export function submissionStatusLabel(status: unknown): string {
  switch (classRecordStatusValue(status)) {
    case ClassRecordStatus.Draft:
      return 'Draft';
    case ClassRecordStatus.Submitted:
      return 'Submitted';
    case ClassRecordStatus.Withdrawn:
      return 'Withdrawn';
    case ClassRecordStatus.Approved:
      return 'Approved';
    case ClassRecordStatus.Rejected:
      return 'Rejected';
    case ClassRecordStatus.PendingHeadReview:
      return 'Pending School Head Review';
    case ClassRecordStatus.ReturnedByHead:
      return 'Returned by School Head';
    case ClassRecordStatus.Locked:
      return 'Locked';
    default:
      return 'Unknown';
  }
}

export function submissionBadgeTone(status: unknown): StatusTone {
  switch (classRecordStatusValue(status)) {
    case ClassRecordStatus.Approved:
      return 'success';
    case ClassRecordStatus.Rejected:
      return 'danger';
    case ClassRecordStatus.Withdrawn:
    case ClassRecordStatus.ReturnedByHead:
      return 'warning';
    case ClassRecordStatus.Draft:
    case ClassRecordStatus.Submitted:
    case ClassRecordStatus.PendingHeadReview:
      return 'info';
    default:
      return 'secondary';
  }
}

/** Ionicons name for the status badge */
export function submissionStatusIcon(status: unknown): string | null {
  switch (classRecordStatusValue(status)) {
    case ClassRecordStatus.Approved:
      return 'checkmark-circle';
    case ClassRecordStatus.Rejected:
      return 'close-circle';
    case ClassRecordStatus.PendingHeadReview:
      return 'hourglass';
    case ClassRecordStatus.ReturnedByHead:
      return 'return-down-back';
    case ClassRecordStatus.Locked:
      return 'lock-closed';
    default:
      return null;
  }
}

/** True when the status is anything other than a plain draft (or missing) */
export function isSubmittedStatus(status: unknown): boolean {
  const value = classRecordStatusValue(status);
  return value !== null && value !== ClassRecordStatus.Draft;
}

export function submissionStatusHint(status: unknown, isEditable: boolean): string {
  const value = classRecordStatusValue(status);
  if (isEditable) {
    if (value === ClassRecordStatus.Draft) return 'This sheet has not been submitted yet. You can edit and submit it.';
    if (value === ClassRecordStatus.ReturnedByHead)
      return 'The head returned this record for revision. Fix the scores and submit again.';
    return 'This record is still editable.';
  }
  switch (value) {
    case ClassRecordStatus.Submitted:
      return 'This record was submitted and is waiting for review. It can no longer be edited.';
    case ClassRecordStatus.PendingHeadReview:
      return "This record is pending school head's review. It can no longer be edited.";
    case ClassRecordStatus.Approved:
      return 'This record was approved and is locked. It can no longer be edited.';
    case ClassRecordStatus.Rejected:
      return 'This record was rejected. It can no longer be edited.';
    case ClassRecordStatus.Withdrawn:
      return 'This record was withdrawn. It can no longer be edited.';
    case ClassRecordStatus.ReturnedByHead:
      return 'The head returned this record for revision.';
    case ClassRecordStatus.Locked:
      return 'This record is locked. It can no longer be edited.';
    default:
      return 'This grading sheet is read-only.';
  }
}

// ---- Grade math --------------------------------------------------------------------------------

export interface GradingItem {
  id: string;
  maxScore: number;
}

export interface GradingComponent {
  id: string;
  weightPercent: number;
  sequenceNo: number;
  items: GradingItem[];
}

/** enrollmentId -> (item or component id -> raw score) */
export type ScoreMap = Record<string, Record<string, number>>;
/** item (or itemless component) id -> its highest possible score */
export type HighestScoreMap = Record<string, number>;

export const sortComponents = <C extends { sequenceNo: number }>(components: C[]): C[] =>
  [...components].sort((a, b) => a.sequenceNo - b.sequenceNo);

/** Highest score per item; an itemless component is its own column and carries a max of 0 */
export function buildHighestScoreMap(components: GradingComponent[]): HighestScoreMap {
  const map: HighestScoreMap = {};
  components.forEach((c) => {
    if (c.items.length === 0) map[c.id] = 0;
    c.items.forEach((item) => {
      map[item.id] = item.maxScore;
    });
  });
  return map;
}

export function isMaxValid(id: string, highest: HighestScoreMap): boolean {
  const value = highest[id];
  return value !== undefined && value > 0;
}

export function isScoreOverMax(
  enrollmentId: string | undefined,
  id: string,
  scores: ScoreMap,
  highest: HighestScoreMap
): boolean {
  const score = enrollmentId ? scores[enrollmentId]?.[id] : undefined;
  return isMaxValid(id, highest) && score !== undefined && score > highest[id];
}

export interface StudentValidation {
  hasOverMax: boolean;
  hasAnyScore: boolean;
  hasBlank: boolean;
}

export function computeStudentValidation(
  enrollmentId: string | undefined,
  scores: ScoreMap,
  components: GradingComponent[],
  highest: HighestScoreMap
): StudentValidation {
  let hasOverMax = false;
  let hasAnyScore = false;
  // A student with no enrollment cannot be graded: that counts as a blank
  let hasBlank = !enrollmentId;
  const own = enrollmentId ? scores[enrollmentId] : undefined;

  if (own) hasAnyScore = Object.values(own).some((v) => v !== undefined);

  if (enrollmentId) {
    for (const comp of sortComponents(components)) {
      const ids = comp.items.length === 0 ? [comp.id] : comp.items.map((i) => i.id);
      for (const id of ids) {
        if (isScoreOverMax(enrollmentId, id, scores, highest)) hasOverMax = true;
        if (isMaxValid(id, highest) && (own === undefined || own[id] === undefined)) hasBlank = true;
      }
    }
  }
  return { hasOverMax, hasAnyScore, hasBlank };
}

export interface ComponentScore {
  total: number;
  /** percentage score */
  ps: number;
  /** weighted score */
  ws: number;
  valid: boolean;
}

export function compScores(
  enrollmentId: string | undefined,
  comp: GradingComponent,
  scores: ScoreMap,
  highest: HighestScoreMap
): ComponentScore {
  const own = enrollmentId ? scores[enrollmentId] : undefined;
  let total = 0;
  let maxTotal = 0;
  let valid = true;

  if (comp.items.length === 0) {
    total = own?.[comp.id] ?? 0;
    maxTotal = highest[comp.id] ?? 0;
    valid = isMaxValid(comp.id, highest);
  } else {
    for (const item of comp.items) {
      total += own?.[item.id] ?? 0;
      maxTotal += highest[item.id] ?? 0;
      if (!isMaxValid(item.id, highest)) valid = false;
    }
  }
  const ps = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  const ws = ps * (comp.weightPercent / 100);
  return {
    total: Number.isNaN(total) ? 0 : total,
    ps: Number.isNaN(ps) ? 0 : ps,
    ws: Number.isNaN(ws) ? 0 : ws,
    valid,
  };
}

export function initialGrade(
  enrollmentId: string | undefined,
  components: GradingComponent[],
  scores: ScoreMap,
  highest: HighestScoreMap
): number {
  return sortComponents(components).reduce((sum, comp) => sum + compScores(enrollmentId, comp, scores, highest).ws, 0);
}

// ---- Transmutation and descriptors -----------------------------------------------------------------

export interface TransmutationRow {
  minInitial: number;
  maxInitial: number;
  transmuted: number;
}

export interface DescriptorRow {
  minGrade: number;
  maxGrade: number;
  label: string;
  color: string;
}

/** The sheet shows the server's final grade; this client lookup exists for reference and tests */
export function lookupFinalGrade(ig: number, rows: TransmutationRow[]): number | null {
  for (const row of rows) {
    if (!Number.isNaN(row.minInitial) && !Number.isNaN(row.maxInitial) && ig >= row.minInitial && ig <= row.maxInitial)
      return row.transmuted;
  }
  return null;
}

export function lookupDescriptor(fg: number, rows: DescriptorRow[]): { label: string; color: string } | null {
  for (const row of rows) {
    if (!Number.isNaN(row.minGrade) && !Number.isNaN(row.maxGrade) && fg >= row.minGrade && fg <= row.maxGrade)
      return { label: row.label, color: row.color };
  }
  return null;
}

// Tailwind 600 (light) and 400 (dark) shades of the descriptor color names
const DESCRIPTOR_COLORS: Record<string, [light: string, dark: string]> = {
  rose: ['#e11d48', '#fb7185'],
  orange: ['#ea580c', '#fb923c'],
  amber: ['#d97706', '#fbbf24'],
  yellow: ['#ca8a04', '#facc15'],
  lime: ['#65a30d', '#a3e635'],
  green: ['#16a34a', '#4ade80'],
  emerald: ['#059669', '#34d399'],
  teal: ['#0d9488', '#2dd4bf'],
  cyan: ['#0891b2', '#22d3ee'],
  sky: ['#0284c7', '#38bdf8'],
  blue: ['#2563eb', '#60a5fa'],
  indigo: ['#4f46e5', '#818cf8'],
  violet: ['#7c3aed', '#a78bfa'],
  purple: ['#9333ea', '#c084fc'],
  fuchsia: ['#c026d3', '#e879f9'],
  pink: ['#db2777', '#f472b6'],
};

/** A descriptor color may be a name ("Green") or a hex value; returns a color for the theme, or null */
export function descriptorColor(color: string, dark: boolean): string | null {
  if (!color) return null;
  if (color.startsWith('#')) return color;
  const pair = DESCRIPTOR_COLORS[color.trim().toLowerCase()];
  return pair ? pair[dark ? 1 : 0] : null;
}

// ---- Drafts ------------------------------------------------------------------------------------

export interface SheetRowLike {
  enrollmentId: string;
  scores: Record<string, { rawScore: number | null }>;
}

/** Seeds the editable draft score grid from the server sheet (null scores are skipped) */
export function buildScoreMap(rows: SheetRowLike[] | undefined): ScoreMap {
  const map: ScoreMap = {};
  for (const row of rows ?? []) {
    const cells: Record<string, number> = {};
    for (const [id, cell] of Object.entries(row.scores ?? {})) {
      if (cell.rawScore !== null && cell.rawScore !== undefined) cells[id] = cell.rawScore;
    }
    map[row.enrollmentId] = cells;
  }
  return map;
}

/** Text typed into a score field -> number, or undefined to clear the cell */
export function parseScoreInput(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const value = parseFloat(trimmed);
  return Number.isNaN(value) ? undefined : value;
}

export interface ScoreEntryChange {
  enrollmentId: string;
  gradingComponentItemId: string;
  rawScore: number | null;
}

/** Only the cells whose draft differs from the baseline; a cleared cell is sent as null */
export function changedEntries(baseline: ScoreMap, draft: ScoreMap): ScoreEntryChange[] {
  const out: ScoreEntryChange[] = [];
  const enrollmentIds = new Set([...Object.keys(baseline), ...Object.keys(draft)]);
  enrollmentIds.forEach((enrollmentId) => {
    const before = baseline[enrollmentId] ?? {};
    const after = draft[enrollmentId] ?? {};
    new Set([...Object.keys(before), ...Object.keys(after)]).forEach((id) => {
      if (before[id] !== after[id]) {
        out.push({ enrollmentId, gradingComponentItemId: id, rawScore: after[id] ?? null });
      }
    });
  });
  return out;
}

// ---- Action gating ---------------------------------------------------------------------------------

export interface GateInput {
  status: unknown;
  editable: boolean;
  isGpOpen: boolean;
  isSyLocked: boolean;
  overMaxCount: number;
  blankCount: number;
  isDirty: boolean;
}

export function actionGates(g: GateInput) {
  const status = classRecordStatusValue(g.status);
  // A withdrawn or returned record is submitted-but-editable, so it can be saved again
  const alreadySubmitted =
    isSubmittedStatus(g.status) &&
    status !== ClassRecordStatus.Withdrawn &&
    status !== ClassRecordStatus.ReturnedByHead;
  const blocksSave =
    status === ClassRecordStatus.PendingHeadReview ||
    !g.editable ||
    !g.isGpOpen ||
    alreadySubmitted ||
    g.isSyLocked ||
    g.overMaxCount > 0;
  const blocksSubmit = blocksSave || g.isDirty || g.blankCount > 0;
  return { blocksSave, blocksSubmit };
}

/** isGpOpen: the school year is active and today (yyyy-MM-dd) is inside the period's window */
export function isPeriodOpen(
  schoolYearActive: boolean,
  today: string,
  period: { startDate: string; endDate: string } | undefined
): boolean {
  return !!period && schoolYearActive && !!period.startDate && !!period.endDate && today >= period.startDate && today <= period.endDate;
}

// ---- Name search -------------------------------------------------------------------------------------

export interface StudentNameParts {
  lastName: string;
  firstName: string;
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "Last, First" */
export const formatRowName = (row: StudentNameParts) => [row.lastName, row.firstName].filter(Boolean).join(', ');

/** Lower-cased, accent-folded, whitespace-split search tokens */
export const parseSearchTokens = (query: string): string[] => fold(query).trim().split(/\s+/).filter(Boolean);

/** Every token must appear somewhere in "Last First" (order-free) */
export function matchesStudentSearch(row: StudentNameParts, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = fold([row.lastName, row.firstName].filter(Boolean).join(' '));
  return tokens.every((t) => haystack.includes(t));
}

export interface NameSegment {
  text: string;
  match: boolean;
}

/** Splits a display name into plain and matched segments for highlighting */
export function splitNameByTokens(text: string, tokens: string[]): NameSegment[] {
  if (!text || tokens.length === 0) return [{ text, match: false }];
  const segments: NameSegment[] = [];
  const folded = fold(text);
  // Find the matched character ranges (folding keeps string lengths for these inputs)
  const marks = new Array<boolean>(text.length).fill(false);
  tokens.forEach((token) => {
    let from = 0;
    for (;;) {
      const at = folded.indexOf(token, from);
      if (at === -1) break;
      for (let i = at; i < at + token.length && i < marks.length; i++) marks[i] = true;
      from = at + token.length;
    }
  });
  let current = '';
  let currentMatch = marks[0] ?? false;
  for (let i = 0; i < text.length; i++) {
    if (marks[i] !== currentMatch) {
      if (current) segments.push({ text: current, match: currentMatch });
      current = '';
      currentMatch = marks[i];
    }
    current += text[i];
  }
  if (current) segments.push({ text: current, match: currentMatch });
  return segments;
}

// ---- Class cards -----------------------------------------------------------------------------------

/** Up to two initials for a subject tile (code preferred) */
export function cardInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const GRADE_HUES = [212, 189, 165, 142, 128, 96, 60, 36, 20, 350, 320, 275];

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
};

/** Grade-level hue family plus a subject-specific shade, as an hsl() string */
export function subjectTint(gradeNumeric: number, subjectKey: string, dark: boolean): { bg: string; fg: string } {
  const base = GRADE_HUES[(Math.max(1, gradeNumeric || 1) - 1) % GRADE_HUES.length];
  const hash = hashString(subjectKey);
  const hue = (base + ((hash % 5) - 2) * 9 + 360) % 360;
  const sat = 50 + (Math.floor(hash / 5) % 4) * 7;
  return dark
    ? { bg: `hsl(${hue}, ${sat}%, 20%)`, fg: `hsl(${hue}, ${sat + 15}%, 72%)` }
    : { bg: `hsl(${hue}, ${sat}%, 90%)`, fg: `hsl(${hue}, ${sat + 10}%, 28%)` };
}

/** Two-decimal display of a grade; "—" when missing */
export const formatGrade = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined || Number.isNaN(value) ? '—' : value.toFixed(digits);
