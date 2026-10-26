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

export interface BubblePosition {
  /** 0-based item index. */
  item: number;
  /** 0-based choice index (0 = a). */
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
  /** Centre x of each choice's letter / bubbles. */
  choiceX: number[];
  /** Centre y of the first row, and the row pitch. */
  firstRowY: number;
}

export interface SheetLayout {
  columns: ColumnLayout[];
  rowMm: number;
  bubbleMm: number;
  headRowMm: number;
  headGapMm: number;
  columnPadMm: number;
  numberGutterMm: number;
  bubbles: BubblePosition[];
}

export function computeSheetLayout(itemCount: number, choiceCount: number): SheetLayout {
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
    const heightMm = COLUMN_PAD_Y_MM * 2 + HEAD_ROW_MM + HEAD_GAP_MM + items * rowMm;
    const choiceAreaX = x + COLUMN_PAD_MM + NUMBER_GUTTER_MM;
    const choiceW = (widthMm - COLUMN_PAD_MM * 2 - NUMBER_GUTTER_MM) / choiceCount;
    const choiceX = Array.from({ length: choiceCount }, (_, k) => choiceAreaX + choiceW * (k + 0.5));
    const firstRowY = GRID_TOP_MM + COLUMN_PAD_Y_MM + HEAD_ROW_MM + HEAD_GAP_MM + rowMm / 2;
    columns.push({ x, y: GRID_TOP_MM, width: widthMm, height: heightMm, firstItem, items, choiceX, firstRowY });
    for (let i = 0; i < items; i++) {
      for (let k = 0; k < choiceCount; k++) {
        bubbles.push({ item: firstItem + i, choice: k, x: choiceX[k], y: firstRowY + i * rowMm });
      }
    }
  }

  return {
    columns,
    rowMm,
    bubbleMm,
    headRowMm: HEAD_ROW_MM,
    headGapMm: HEAD_GAP_MM,
    columnPadMm: COLUMN_PAD_MM,
    numberGutterMm: NUMBER_GUTTER_MM,
    bubbles,
  };
}
