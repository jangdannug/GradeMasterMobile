/**
 * Geometry of a printed answer sheet, in millimetres on an A4 portrait page.
 *
 * The printout draws every element from this layout and the phone scanner reads
 * bubbles at the same coordinates, so the two must agree exactly.
 * GradeMasterFrontend/client/features/answer-sheet/lib/sheet-layout.ts is the
 * source of truth that prints the sheet; this is a copy — change both together.
 */
export const PAGE_MM = { width: 210, height: 297 } as const;

/** Black alignment squares in the page corners; the scanner finds them to straighten the photo. */
export const MARK_MM = { size: 6, inset: 6 } as const;
export const markCenters = () => {
  const c = MARK_MM.inset + MARK_MM.size / 2;
  return {
    topLeft: { x: c, y: c },
    topRight: { x: PAGE_MM.width - c, y: c },
    bottomRight: { x: PAGE_MM.width - c, y: PAGE_MM.height - c },
    bottomLeft: { x: c, y: PAGE_MM.height - c },
  };
};

export const PAGE_PADDING_MM = { x: 16, top: 16, bottom: 14 } as const;
/** Header block (title, tags, QR) and the name/date/score fields below it. */
export const HEADER_MM = { top: 16, height: 40 } as const;
export const FIELDS_MM = { top: 62, height: 9 } as const;
export const QR_MM = { size: 34, boxWidth: 38 } as const;
export const FOOTER_MM = { bottom: 14, height: 14 } as const;

export const GRID_TOP_MM = 80;
export const GRID_WIDTH_MM = PAGE_MM.width - PAGE_PADDING_MM.x * 2;
export const COLUMN_GAP_MM = 5;
const GRID_BOTTOM_MM = PAGE_MM.height - FOOTER_MM.bottom - FOOTER_MM.height - 4;

const ITEMS_PER_COLUMN = 20;
const MAX_COLUMNS = 4;
const COLUMN_PAD_MM = 2.5;
const COLUMN_PAD_Y_MM = 1;
const HEAD_ROW_MM = 7;
const HEAD_GAP_MM = 0.5;
const NUMBER_GUTTER_MM = 10.5;
/** The "TEST I · TRUE OR FALSE" titles above the parts of a sheet with more than one part. */
const PART_HEAD_MM = 6;

/** The teacher-use essay score box: a labelled row of digit bubbles per essay digit. */
const ESSAY_PAD_MM = 2.5;
const ESSAY_TITLE_MM = 6;
const ESSAY_DIGIT_HEAD_MM = 4.5;
const ESSAY_ROW_MM = 6.5;
const ESSAY_ESSAY_GAP_MM = 1.5;
const ESSAY_LABEL_COL_MM = 44;
const ESSAY_PITCH_MM = 7.5;
const ESSAY_BUBBLE_MM = 4.5;
const ESSAY_GAP_MM = 4;

/** Below this row pitch the bubbles get too small to shade and read reliably. */
export const MIN_ROW_MM = 4.2;

/** The kinds of part a sheet can have; the teacher sets their order (Test I, II, III). */
export type PartKind = "tf" | "mc" | "essay";
export const DEFAULT_PART_ORDER: readonly PartKind[] = ["tf", "mc", "essay"];
const PART_NAMES: Record<PartKind, string> = { tf: "TRUE OR FALSE", mc: "MULTIPLE CHOICE", essay: "ESSAY" };
const ROMAN = ["I", "II", "III"];

/** What decides where everything sits on a sheet. */
export interface SheetShape {
  itemCount: number;
  choiceCount: number;
  /** How many items are true-or-false (T = 0, F = 1); the rest are multiple choice. */
  trueFalseCount?: number;
  /** Max points of each hand-marked essay. */
  essayPoints?: number[];
  /** Order of the parts on the sheet; missing kinds keep their default place after the given ones. */
  partOrder?: readonly string[];
}

/** A valid, complete part order: unknown or repeated entries dropped, missing kinds appended in default order. */
export function normalizePartOrder(order?: readonly string[] | null): PartKind[] {
  const given = [...new Set((order ?? []).filter((p): p is PartKind => (DEFAULT_PART_ORDER as readonly string[]).includes(p)))];
  return [...given, ...DEFAULT_PART_ORDER.filter((p) => !given.includes(p))];
}

/** The parts actually on the sheet, in the teacher's order. */
export function sheetParts(shape: SheetShape): PartKind[] {
  const tf = shape.trueFalseCount ?? 0;
  const present: Record<PartKind, boolean> = {
    tf: tf > 0,
    mc: shape.itemCount - tf > 0,
    essay: (shape.essayPoints ?? []).length > 0,
  };
  return normalizePartOrder(shape.partOrder).filter((p) => present[p]);
}

/** "TEST I · TRUE OR FALSE", numbered in the sheet's order. */
export function partTitle(shape: SheetShape, part: PartKind): string {
  const index = sheetParts(shape).indexOf(part);
  return `TEST ${ROMAN[index] ?? index + 1} · ${PART_NAMES[part]}`;
}

/** The item numbers (0-based, end exclusive) of the true-or-false and multiple-choice questions. */
export function itemRanges(shape: SheetShape): Record<"tf" | "mc", [number, number]> {
  const tf = shape.trueFalseCount ?? 0;
  const order = normalizePartOrder(shape.partOrder);
  return order.indexOf("tf") < order.indexOf("mc")
    ? { tf: [0, tf], mc: [tf, shape.itemCount] }
    : { mc: [0, shape.itemCount - tf], tf: [shape.itemCount - tf, shape.itemCount] };
}

export const isTrueFalseItem = (shape: SheetShape, item: number) => {
  const [start, end] = itemRanges(shape).tf;
  return item >= start && item < end;
};

/** How many choices an item has: true-or-false items have two. */
export const itemChoices = (shape: SheetShape, item: number) => (isTrueFalseItem(shape, item) ? 2 : shape.choiceCount);

export interface BubblePosition {
  /** 0-based item index. */
  item: number;
  /** 0-based choice index (0 = a; on a true-or-false item 0 = T, 1 = F). */
  choice: number;
  /** Bubble centre. */
  x: number;
  y: number;
}

export interface ColumnLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0-based index of the first item in the column, and how many it holds. */
  firstItem: number;
  items: number;
  part: "tf" | "mc";
  /** Centre x of each choice's letter / bubbles. */
  choiceX: number[];
  /** Centre y of the first row, and the row pitch. */
  firstRowY: number;
}

/** The title above a part on a sheet with more than one part. */
export interface PartLayout {
  part: PartKind;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type EssayPlace = "tens" | "ones";

export interface EssayRow {
  /** 0-based essay index. */
  essay: number;
  place: EssayPlace;
  /** Centre y of the row's bubbles. */
  y: number;
  /** Bubbles for digits 0 .. digits-1: only the digits the essay's max points allow. */
  digits: number;
}

export interface EssayBoxLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Max points of each essay. */
  points: number[];
  /** Per essay: its tens row (when worth 10 or more), then its ones row. */
  rows: EssayRow[];
  /** Centre x of the bubbles for digits 0–9. */
  digitX: number[];
  bubbleMm: number;
  padMm: number;
  titleMm: number;
  digitHeadMm: number;
  rowMm: number;
  labelColMm: number;
}

export interface SheetLayout {
  columns: ColumnLayout[];
  /** Part titles; empty unless the sheet has more than one part. */
  parts: PartLayout[];
  rowMm: number;
  bubbleMm: number;
  headRowMm: number;
  headGapMm: number;
  columnPadMm: number;
  numberGutterMm: number;
  bubbles: BubblePosition[];
  /** The teacher-use essay score box, or null when the sheet has no essays. */
  essay: EssayBoxLayout | null;
}

/** The essay score box, its top at `top`, or sitting on the bottom of the grid area when `top` is left out. */
export function computeEssayBox(essayPoints: number[], top?: number): EssayBoxLayout | null {
  if (essayPoints.length === 0) return null;
  const rowsPer = essayPoints.map((p) => (p >= 10 ? 2 : 1));
  const rowCount = rowsPer.reduce((a, b) => a + b, 0);
  const height =
    ESSAY_PAD_MM * 2 + ESSAY_TITLE_MM + ESSAY_DIGIT_HEAD_MM + rowCount * ESSAY_ROW_MM + (essayPoints.length - 1) * ESSAY_ESSAY_GAP_MM;
  const width = ESSAY_PAD_MM * 2 + ESSAY_LABEL_COL_MM + 10 * ESSAY_PITCH_MM;
  const x = PAGE_PADDING_MM.x;
  const y = top ?? GRID_BOTTOM_MM - height;

  const rows: EssayRow[] = [];
  let rowTop = y + ESSAY_PAD_MM + ESSAY_TITLE_MM + ESSAY_DIGIT_HEAD_MM;
  essayPoints.forEach((max, essay) => {
    if (max >= 10) {
      rows.push({ essay, place: "tens", y: rowTop + ESSAY_ROW_MM / 2, digits: Math.floor(max / 10) + 1 });
      rowTop += ESSAY_ROW_MM;
    }
    rows.push({ essay, place: "ones", y: rowTop + ESSAY_ROW_MM / 2, digits: max >= 10 ? 10 : max + 1 });
    rowTop += ESSAY_ROW_MM + ESSAY_ESSAY_GAP_MM;
  });

  return {
    x,
    y,
    width,
    height,
    points: essayPoints,
    rows,
    digitX: Array.from({ length: 10 }, (_, d) => x + ESSAY_PAD_MM + ESSAY_LABEL_COL_MM + ESSAY_PITCH_MM * (d + 0.5)),
    bubbleMm: ESSAY_BUBBLE_MM,
    padMm: ESSAY_PAD_MM,
    titleMm: ESSAY_TITLE_MM,
    digitHeadMm: ESSAY_DIGIT_HEAD_MM,
    rowMm: ESSAY_ROW_MM,
    labelColMm: ESSAY_LABEL_COL_MM,
  };
}

/**
 * Where everything sits on a sheet. Its true-or-false and multiple-choice parts share one band of
 * columns, left to right in the teacher's order; the essay box sits above that band when the essay
 * comes first and below it otherwise.
 */
export function computeSheetLayout(shape: SheetShape): SheetLayout {
  const common = { headRowMm: HEAD_ROW_MM, headGapMm: HEAD_GAP_MM, columnPadMm: COLUMN_PAD_MM, numberGutterMm: NUMBER_GUTTER_MM };
  const parts = sheetParts(shape);
  if (parts.length === 1 && parts[0] === "mc") return { ...multipleChoiceOnly(shape.itemCount, shape.choiceCount), ...common, essay: null };

  const head = parts.length > 1 ? PART_HEAD_MM : 0;
  const titles: PartLayout[] = [];
  let gridTop = GRID_TOP_MM;
  let gridBottom = GRID_BOTTOM_MM;
  let essay: EssayBoxLayout | null = null;
  if (parts.includes("essay")) {
    if (parts[0] === "essay") {
      essay = computeEssayBox(shape.essayPoints!, GRID_TOP_MM + head)!;
      gridTop = essay.y + essay.height + ESSAY_GAP_MM;
    } else {
      essay = computeEssayBox(shape.essayPoints!)!;
      gridBottom = essay.y - head - ESSAY_GAP_MM;
    }
    if (head) titles.push({ part: "essay", title: partTitle(shape, "essay"), x: essay.x, y: essay.y - head, width: essay.width, height: head });
  }

  const grid = bubbleGrid(shape, parts, gridTop, gridBottom, head);
  return { ...grid, parts: [...titles, ...grid.parts], ...common, essay };
}

/** A multiple-choice-only sheet. Copies printed before parts existed are read with this exact geometry. */
function multipleChoiceOnly(itemCount: number, choiceCount: number) {
  const columnCount = Math.min(MAX_COLUMNS, Math.max(1, Math.ceil(itemCount / ITEMS_PER_COLUMN)));
  const perColumn = Math.ceil(itemCount / columnCount);
  const gridHeight = GRID_BOTTOM_MM - GRID_TOP_MM;
  const rowMm = Math.min(9.5, (gridHeight - COLUMN_PAD_Y_MM * 2 - HEAD_ROW_MM - HEAD_GAP_MM) / perColumn);
  const slotMm = (GRID_WIDTH_MM - COLUMN_GAP_MM * (columnCount - 1)) / columnCount;
  const bubbleMm = Math.max(3, Math.min(6.5, rowMm - 2.3, (slotMm - 14) / choiceCount - 1.5));
  // A lone column keeps its bubbles close together instead of stretching across the page.
  const widthMm = columnCount === 1 ? Math.min(slotMm, 28 + choiceCount * (bubbleMm + 7)) : slotMm;

  const columns: ColumnLayout[] = [];
  const bubbles: BubblePosition[] = [];
  for (let c = 0; c < columnCount; c++) {
    const firstItem = c * perColumn;
    const items = Math.min(perColumn, itemCount - firstItem);
    const x = PAGE_PADDING_MM.x + c * (widthMm + COLUMN_GAP_MM);
    columns.push(column(x, GRID_TOP_MM, widthMm, firstItem, items, "mc", choiceCount, rowMm, bubbles));
  }
  return { columns, parts: [] as PartLayout[], rowMm, bubbleMm, bubbles };
}

/** One column of items: its box, the centre x of each choice, and every bubble added to `bubbles`. */
function column(
  x: number,
  y: number,
  widthMm: number,
  firstItem: number,
  items: number,
  part: "tf" | "mc",
  choices: number,
  rowMm: number,
  bubbles: BubblePosition[],
): ColumnLayout {
  const heightMm = COLUMN_PAD_Y_MM * 2 + HEAD_ROW_MM + HEAD_GAP_MM + items * rowMm;
  const choiceAreaX = x + COLUMN_PAD_MM + NUMBER_GUTTER_MM;
  const choiceW = (widthMm - COLUMN_PAD_MM * 2 - NUMBER_GUTTER_MM) / choices;
  const choiceX = Array.from({ length: choices }, (_, k) => choiceAreaX + choiceW * (k + 0.5));
  const firstRowY = y + COLUMN_PAD_Y_MM + HEAD_ROW_MM + HEAD_GAP_MM + rowMm / 2;
  for (let i = 0; i < items; i++) {
    for (let k = 0; k < choices; k++) {
      bubbles.push({ item: firstItem + i, choice: k, x: choiceX[k], y: firstRowY + i * rowMm });
    }
  }
  return { x, y, width: widthMm, height: heightMm, firstItem, items, part, choiceX, firstRowY };
}

/** The bubbled parts in one band of columns between `top` and `bottom`, each part titled when `head` > 0. */
function bubbleGrid(shape: SheetShape, parts: PartKind[], top: number, bottom: number, head: number) {
  const ranges = itemRanges(shape);
  const groups = parts
    .filter((p): p is "tf" | "mc" => p !== "essay")
    .map((part) => ({ part, first: ranges[part][0], count: ranges[part][1] - ranges[part][0], choices: part === "tf" ? 2 : shape.choiceCount }));

  // Taller columns until the parts fit side by side.
  const columnsFor = (per: number) => groups.reduce((n, g) => n + Math.ceil(g.count / per), 0);
  let perColumn = ITEMS_PER_COLUMN;
  while (columnsFor(perColumn) > MAX_COLUMNS) perColumn++;
  const columnCount = columnsFor(perColumn);

  const columnsTop = top + head;
  const rowMm = Math.min(9.5, (bottom - columnsTop - COLUMN_PAD_Y_MM * 2 - HEAD_ROW_MM - HEAD_GAP_MM) / perColumn);
  const slotMm = (GRID_WIDTH_MM - COLUMN_GAP_MM * (columnCount - 1)) / columnCount;
  const widestChoices = Math.max(...groups.map((g) => g.choices));
  const bubbleMm = Math.max(3, Math.min(6.5, rowMm - 2.3, (slotMm - 14) / widestChoices - 1.5));

  const columns: ColumnLayout[] = [];
  const titles: PartLayout[] = [];
  const bubbles: BubblePosition[] = [];
  let x = PAGE_PADDING_MM.x;
  for (const g of groups) {
    // Two columns or fewer keep their bubbles close together instead of stretching across the page.
    const widthMm = columnCount <= 2 ? Math.min(slotMm, 28 + g.choices * (bubbleMm + 7)) : slotMm;
    const n = Math.ceil(g.count / perColumn);
    const per = Math.ceil(g.count / n);
    const partX = x;
    for (let c = 0; c < n; c++) {
      const firstItem = g.first + c * per;
      const items = Math.min(per, g.first + g.count - firstItem);
      columns.push(column(x, columnsTop, widthMm, firstItem, items, g.part, g.choices, rowMm, bubbles));
      x += widthMm + COLUMN_GAP_MM;
    }
    if (head) titles.push({ part: g.part, title: partTitle(shape, g.part), x: partX, y: top, width: x - COLUMN_GAP_MM - partX, height: head });
  }

  return { columns, parts: titles, rowMm, bubbleMm, bubbles };
}
