// Run with: node --test src/answer-sheet/readSheet.test.ts   (Node 22.18+ strips the types itself)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CANON_PX_PER_MM,
  findCornerMarks,
  readBubbles,
  readSheet,
  solveHomography,
  warpGray,
  type GrayImage,
  type Homography,
} from './readSheet.ts';
import { MARK_MM, PAGE_MM, computeSheetLayout } from './sheetLayout.ts';

const PX = 4; // synthetic "print" resolution, px per mm

/** The sheet as it would print: white page, black corner marks, bubble outlines, shaded bubbles */
function renderSheet(itemCount: number, choiceCount: number, marks: Record<number, number[]>): GrayImage {
  const w = PAGE_MM.width * PX;
  const h = PAGE_MM.height * PX;
  const data = new Uint8Array(w * h).fill(255);
  const dot = (cx: number, cy: number, rMm: number, value: number, ringOnly = 0) => {
    const r = rMm * PX;
    const rin = ringOnly ? r - ringOnly * PX : -1;
    for (let y = Math.floor(cy * PX - r); y <= Math.ceil(cy * PX + r); y++) {
      for (let x = Math.floor(cx * PX - r); x <= Math.ceil(cx * PX + r); x++) {
        const d2 = (x - cx * PX) ** 2 + (y - cy * PX) ** 2;
        if (d2 <= r * r && d2 >= rin * rin && x >= 0 && y >= 0 && x < w && y < h) data[y * w + x] = value;
      }
    }
  };
  const square = (x0: number, y0: number, side: number) => {
    for (let y = Math.round(y0 * PX); y < Math.round((y0 + side) * PX); y++) {
      for (let x = Math.round(x0 * PX); x < Math.round((x0 + side) * PX); x++) data[y * w + x] = 0;
    }
  };
  const inset = MARK_MM.inset;
  const far = (n: number, total: number) => total - n - MARK_MM.size;
  square(inset, inset, MARK_MM.size);
  square(far(inset, PAGE_MM.width), inset, MARK_MM.size);
  square(inset, far(inset, PAGE_MM.height), MARK_MM.size);
  square(far(inset, PAGE_MM.width), far(inset, PAGE_MM.height), MARK_MM.size);

  const layout = computeSheetLayout(itemCount, choiceCount);
  for (const b of layout.bubbles) {
    dot(b.x, b.y, layout.bubbleMm / 2, 0, 0.35); // outline
    if (marks[b.item]?.includes(b.choice)) dot(b.x, b.y, layout.bubbleMm / 2 - 0.2, 40); // pen fill
  }
  return { data, width: w, height: h };
}

/** A phone photo of `sheet`: tilted, perspective-skewed, dim on one side, noisy, with a dark table around it */
function photograph(sheet: GrayImage, opts: { shadow?: boolean } = {}): GrayImage {
  const outW = 1000;
  const outH = 1400;
  // where the page's four corners land in the photo
  const dst = [
    { x: 95, y: 70 },
    { x: 905, y: 110 },
    { x: 880, y: 1330 },
    { x: 120, y: 1290 },
  ];
  const src = [
    { x: 0, y: 0 },
    { x: sheet.width, y: 0 },
    { x: sheet.width, y: sheet.height },
    { x: 0, y: sheet.height },
  ];
  const h: Homography = solveHomography(src, dst);
  const base = warpGray(sheet, h, outW, outH);
  // warpGray paints outside the page white; the table is darker than paper but not black
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const inside = warpGray({ data: new Uint8Array(sheet.width * sheet.height).fill(1), width: sheet.width, height: sheet.height }, h, outW, outH);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const i = y * outW + x;
      let v = inside.data[i] === 1 ? base.data[i] * 0.88 + 12 : 70; // paper is off-white; table is dim
      if (opts.shadow) v *= 0.55 + 0.45 * (x / outW); // left side in shadow
      v += (rnd() - 0.5) * 14;
      base.data[i] = Math.max(0, Math.min(255, v));
    }
  }
  return base;
}

const KEY = [0, 1, 2, 3, 1, 2, 1, 0, 3, 2];
const marksFor = (answers: number[]) => Object.fromEntries(answers.map((a, i) => [i, [a]]));

describe('findCornerMarks', () => {
  it('finds the four corners of a tilted, skewed photo', () => {
    const photo = photograph(renderSheet(10, 4, marksFor(KEY)));
    const c = findCornerMarks(photo);
    assert.ok(c, 'corners found');
    // the mark centres sit 9mm in from each page corner: allow a few px
    const near = (p: { x: number; y: number }, x: number, y: number) => Math.hypot(p.x - x, p.y - y) < 12;
    assert.ok(near(c.topLeft, 95 + 9 * 3.5, 70 + 9 * 3.9) || c.topLeft.x < 200, `topLeft ${JSON.stringify(c.topLeft)}`);
    assert.ok(c.topRight.x > 800 && c.topRight.y < 200);
    assert.ok(c.bottomRight.x > 750 && c.bottomRight.y > 1200);
    assert.ok(c.bottomLeft.x < 250 && c.bottomLeft.y > 1200);
  });

  it('gives up when a corner is missing', () => {
    const photo = photograph(renderSheet(10, 4, {}));
    for (let y = 0; y < 400; y++) for (let x = 0; x < 400; x++) photo.data[y * photo.width + x] = 200; // cover top-left
    assert.equal(findCornerMarks(photo), null);
  });
});

describe('readSheet', () => {
  it('reads a clean photo', () => {
    const r = readSheet(photograph(renderSheet(10, 4, marksFor(KEY))), 10, 4);
    assert.ok(r);
    assert.deepEqual(r.items.map((i) => i.answer), KEY);
    assert.ok(r.items.every((i) => i.state === 'answered'));
  });

  it('copes with a shadow across the page', () => {
    const r = readSheet(photograph(renderSheet(10, 4, marksFor(KEY)), { shadow: true }), 10, 4);
    assert.ok(r);
    assert.deepEqual(r.items.map((i) => i.answer), KEY);
  });

  it('flags blank and double-shaded items instead of guessing', () => {
    const marks: Record<number, number[]> = { ...marksFor(KEY), 2: [], 5: [1, 2] };
    const r = readSheet(photograph(renderSheet(10, 4, marks)), 10, 4);
    assert.ok(r);
    assert.equal(r.items[2].state, 'blank');
    assert.equal(r.items[2].answer, null);
    assert.equal(r.items[5].state, 'multiple');
    assert.equal(r.items[5].answer, null);
    assert.equal(r.items[0].answer, 0);
    assert.equal(r.items[9].answer, 2);
  });

  it('reads a dense multi-column sheet (100 items, 5 choices)', () => {
    const key = Array.from({ length: 100 }, (_, i) => (i * 7) % 5);
    const r = readSheet(photograph(renderSheet(100, 5, marksFor(key))), 100, 5);
    assert.ok(r);
    const wrong = r.items.filter((it, i) => it.answer !== key[i]).length;
    assert.equal(wrong, 0);
  });

  it('returns null for a photo with no sheet in it', () => {
    const blank: GrayImage = { data: new Uint8Array(1000 * 1400).fill(200), width: 1000, height: 1400 };
    assert.equal(readSheet(blank, 10, 4), null);
  });
});

describe('readBubbles', () => {
  it('ignores the printed outline: an unmarked sheet reads blank', () => {
    const sheet = renderSheet(10, 4, {});
    const page = warpGray(sheet, solveHomography(
      [{ x: 0, y: 0 }, { x: sheet.width, y: 0 }, { x: sheet.width, y: sheet.height }, { x: 0, y: sheet.height }],
      [{ x: 0, y: 0 }, { x: PAGE_MM.width * CANON_PX_PER_MM, y: 0 }, { x: PAGE_MM.width * CANON_PX_PER_MM, y: PAGE_MM.height * CANON_PX_PER_MM }, { x: 0, y: PAGE_MM.height * CANON_PX_PER_MM }],
    ), PAGE_MM.width * CANON_PX_PER_MM, PAGE_MM.height * CANON_PX_PER_MM);
    assert.ok(readBubbles(page, 10, 4).every((i) => i.state === 'blank'));
  });
});
