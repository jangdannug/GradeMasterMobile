import { MARK_MM, PAGE_MM, computeSheetLayout, itemChoices, markCenters, type SheetShape } from './sheetLayout.ts';

/**
 * Reads a photographed answer sheet. Pure functions over grayscale pixel buffers,
 * so the whole pipeline (find the corner marks, straighten the page, read the
 * bubbles) is unit-tested in Node; the phone only supplies the grayscale photo.
 */

export interface GrayImage {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Corners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

/** Pixels per millimetre of the straightened page the bubbles are read from */
export const CANON_PX_PER_MM = 4;

// ---- Thresholding ----------------------------------------------------------------------------------

/** Otsu's threshold: the gray level that best splits the histogram into ink and paper */
export function otsuThreshold(img: GrayImage): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < img.data.length; i++) hist[img.data[i]]++;
  const total = img.data.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return best;
}

// ---- Corner marks ----------------------------------------------------------------------------------

interface Blob {
  cx: number;
  cy: number;
  w: number;
  h: number;
  fill: number;
}

/** Dark connected blobs inside a window, by 4-connected flood fill */
function darkBlobs(img: GrayImage, threshold: number, x0: number, y0: number, x1: number, y1: number): Blob[] {
  const { data, width } = img;
  const w = x1 - x0;
  const h = y1 - y0;
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const blobs: Blob[] = [];

  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const start = sy * w + sx;
      if (seen[start] || data[(y0 + sy) * width + x0 + sx] >= threshold) continue;
      let sp = 0;
      stack[sp++] = start;
      seen[start] = 1;
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = sx;
      let maxX = sx;
      let minY = sy;
      let maxY = sy;
      while (sp > 0) {
        const cur = stack[--sp];
        const cy = (cur / w) | 0;
        const cx = cur - cy * w;
        area++;
        sumX += cx;
        sumY += cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        const neighbours = [cx > 0 ? cur - 1 : -1, cx < w - 1 ? cur + 1 : -1, cy > 0 ? cur - w : -1, cy < h - 1 ? cur + w : -1];
        for (const n of neighbours) {
          if (n < 0 || seen[n]) continue;
          const ny = (n / w) | 0;
          const nx = n - ny * w;
          if (data[(y0 + ny) * width + x0 + nx] >= threshold) continue;
          seen[n] = 1;
          stack[sp++] = n;
        }
      }
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      blobs.push({ cx: x0 + sumX / area, cy: y0 + sumY / area, w: bw, h: bh, fill: area / (bw * bh) });
    }
  }
  return blobs;
}

/**
 * Finds the four solid black squares printed in the page corners. Each is searched in its own
 * corner window of the photo; the blob that is square, solid and closest to the photo's corner wins.
 * Returns null when any corner is missing or the four do not form a plausible page.
 */
export function findCornerMarks(img: GrayImage): Corners | null {
  const { width, height } = img;
  const threshold = otsuThreshold(img);
  const winW = Math.round(width * 0.36);
  const winH = Math.round(height * 0.3);
  const minSide = width * 0.012;
  const maxSide = width * 0.09;

  const pick = (x0: number, y0: number, cornerX: number, cornerY: number): Point | null => {
    const blobs = darkBlobs(img, threshold, x0, y0, x0 + winW, y0 + winH).filter(
      (b) =>
        b.w >= minSide && b.h >= minSide && b.w <= maxSide && b.h <= maxSide &&
        b.w / b.h > 0.7 && b.w / b.h < 1.43 && b.fill >= 0.72,
    );
    if (blobs.length === 0) return null;
    blobs.sort((a, b) => Math.hypot(a.cx - cornerX, a.cy - cornerY) - Math.hypot(b.cx - cornerX, b.cy - cornerY));
    return { x: blobs[0].cx, y: blobs[0].cy };
  };

  const topLeft = pick(0, 0, 0, 0);
  const topRight = pick(width - winW, 0, width, 0);
  const bottomRight = pick(width - winW, height - winH, width, height);
  const bottomLeft = pick(0, height - winH, 0, height);
  if (!topLeft || !topRight || !bottomRight || !bottomLeft) return null;

  const corners = { topLeft, topRight, bottomRight, bottomLeft };
  return isPlausiblePage(corners, img) ? corners : null;
}

/** Convex, big enough, and roughly A4-shaped (perspective stretches the ratio, so the band is wide) */
function isPlausiblePage(c: Corners, img: GrayImage): boolean {
  const pts = [c.topLeft, c.topRight, c.bottomRight, c.bottomLeft];
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const d = pts[(i + 2) % 4];
    const cross = (b.x - a.x) * (d.y - b.y) - (b.y - a.y) * (d.x - b.x);
    if (cross === 0) return false;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  let area = 0;
  for (let i = 0; i < 4; i++) area += pts[i].x * pts[(i + 1) % 4].y - pts[(i + 1) % 4].x * pts[i].y;
  if (Math.abs(area) / 2 < img.width * img.height * 0.2) return false;
  const top = Math.hypot(c.topRight.x - c.topLeft.x, c.topRight.y - c.topLeft.y);
  const left = Math.hypot(c.bottomLeft.x - c.topLeft.x, c.bottomLeft.y - c.topLeft.y);
  const ratio = top / left;
  const expected = (PAGE_MM.width - 2 * (MARK_MM.inset + MARK_MM.size / 2)) / (PAGE_MM.height - 2 * (MARK_MM.inset + MARK_MM.size / 2));
  return ratio > expected * 0.6 && ratio < expected * 1.5;
}

// ---- Straightening ---------------------------------------------------------------------------------

/** 3x3 projective transform, row-major, h33 = 1 */
export type Homography = [number, number, number, number, number, number, number, number, number];

/** Solves the homography that maps four source points onto four destination points */
export function solveHomography(src: Point[], dst: Point[]): Homography {
  const a: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const p = a[col][col];
    for (let c = col; c < 9; c++) a[col][c] /= p;
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = a[r][col];
      for (let c = col; c < 9; c++) a[r][c] -= f * a[col][c];
    }
  }
  return [a[0][8], a[1][8], a[2][8], a[3][8], a[4][8], a[5][8], a[6][8], a[7][8], 1];
}

export function invertHomography(h: Homography): Homography {
  const [a, b, c, d, e, f, g, hh, i] = h;
  const det = a * (e * i - f * hh) - b * (d * i - f * g) + c * (d * hh - e * g);
  const inv: Homography = [
    (e * i - f * hh) / det, (c * hh - b * i) / det, (b * f - c * e) / det,
    (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
    (d * hh - e * g) / det, (b * g - a * hh) / det, (a * e - b * d) / det,
  ];
  const s = inv[8];
  return inv.map((v) => v / s) as Homography;
}

/** Resamples `img` through `h` (source → destination) into a new `outW` × `outH` image, bilinear */
export function warpGray(img: GrayImage, h: Homography, outW: number, outH: number): GrayImage {
  const inv = invertHomography(h);
  const out = new Uint8Array(outW * outH);
  const { data, width, height } = img;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const w = inv[6] * x + inv[7] * y + inv[8];
      const sx = (inv[0] * x + inv[1] * y + inv[2]) / w;
      const sy = (inv[3] * x + inv[4] * y + inv[5]) / w;
      if (sx < 0 || sy < 0 || sx > width - 1 || sy > height - 1) {
        out[y * outW + x] = 255;
        continue;
      }
      const x0 = sx | 0;
      const y0 = sy | 0;
      const x1 = Math.min(x0 + 1, width - 1);
      const y1 = Math.min(y0 + 1, height - 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const top = data[y0 * width + x0] * (1 - fx) + data[y0 * width + x1] * fx;
      const bottom = data[y1 * width + x0] * (1 - fx) + data[y1 * width + x1] * fx;
      out[y * outW + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return { data: out, width: outW, height: outH };
}

/** The photo straightened to the printed page: A4 at `CANON_PX_PER_MM`, marks at their printed positions */
export function rectifyPage(img: GrayImage, corners: Corners): GrayImage {
  const s = CANON_PX_PER_MM;
  const m = markCenters();
  const h = solveHomography(
    [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft],
    [m.topLeft, m.topRight, m.bottomRight, m.bottomLeft].map((p) => ({ x: p.x * s, y: p.y * s })),
  );
  return warpGray(img, h, Math.round(PAGE_MM.width * s), Math.round(PAGE_MM.height * s));
}

// ---- Lighting --------------------------------------------------------------------------------------

/**
 * Evens out uneven lighting (shadows, a gradient across the page): divides by a heavily blurred
 * copy of the page with the ink replaced by the typical paper level, so unmarked paper reads
 * ~255 everywhere and a pen mark reads dark wherever it sits.
 */
export function flattenLighting(img: GrayImage, radiusPx = 60): GrayImage {
  const { data, width, height } = img;
  const sorted = Uint8Array.from(data).sort();
  const paper = sorted[Math.floor(sorted.length * 0.85)] || 255;
  const floor = paper * 0.6;

  const w1 = width + 1;
  const integral = new Float64Array(w1 * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      const v = data[y * width + x];
      row += v < floor ? paper : v;
      integral[(y + 1) * w1 + x + 1] = integral[y * w1 + x + 1] + row;
    }
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const ya = Math.max(0, y - radiusPx);
    const yb = Math.min(height, y + radiusPx + 1);
    for (let x = 0; x < width; x++) {
      const xa = Math.max(0, x - radiusPx);
      const xb = Math.min(width, x + radiusPx + 1);
      const sum = integral[yb * w1 + xb] - integral[ya * w1 + xb] - integral[yb * w1 + xa] + integral[ya * w1 + xa];
      const bg = sum / ((xb - xa) * (yb - ya));
      out[y * width + x] = Math.min(255, (data[y * width + x] / bg) * 255);
    }
  }
  return { data: out, width, height };
}

// ---- Bubbles ---------------------------------------------------------------------------------------

/** How dark a bubble's inside must be (0 = paper, 1 = black) to count as shaded */
export const MARKED_DARKNESS = 0.25;
/** A runner-up this close to the darkest bubble makes the item ambiguous */
const MULTIPLE_RATIO = 0.6;

export type ItemState = 'answered' | 'blank' | 'multiple';

export interface ReadItem {
  /** Chosen choice index, or null when blank / more than one choice is shaded */
  answer: number | null;
  state: ItemState;
  /** Darkness of each choice, 0..1 */
  darkness: number[];
}

/** Mean darkness inside a disc of radius `r` px around (cx, cy) */
function discDarkness(img: GrayImage, cx: number, cy: number, r: number): number {
  const { data, width, height } = img;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(width - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(height - 1, Math.ceil(cy + r));
  let sum = 0;
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r) continue;
      sum += data[y * width + x];
      n++;
    }
  }
  return n === 0 ? 0 : 1 - sum / n / 255;
}

/** The disc measured inside a printed bubble: smaller, so its outline (and small misalignments) don't count */
const innerRadiusMm = (bubbleMm: number) => Math.max(0.45 * (bubbleMm / 2), bubbleMm / 2 - 1.1);

/** Which of a row of bubbles is shaded: the darkest, unless none is dark enough or a runner-up is close */
function pickMark(darkness: number[]): ReadItem {
  const order = darkness.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
  const [top, second] = [order[0], order[1]];
  if (top[0] < MARKED_DARKNESS) return { answer: null, state: 'blank', darkness };
  if (second && second[0] >= MARKED_DARKNESS && second[0] >= top[0] * MULTIPLE_RATIO) {
    return { answer: null, state: 'multiple', darkness };
  }
  return { answer: top[1], state: 'answered', darkness };
}

/** Reads every item of a straightened, lighting-flattened page; true-or-false items have two choices. */
export function readBubbles(page: GrayImage, shape: SheetShape): ReadItem[] {
  const layout = computeSheetLayout(shape);
  const s = page.width / PAGE_MM.width;
  const innerMm = innerRadiusMm(layout.bubbleMm);

  const darkness: number[][] = Array.from({ length: shape.itemCount }, (_, i) => new Array<number>(itemChoices(shape, i)).fill(0));
  for (const b of layout.bubbles) darkness[b.item][b.choice] = discDarkness(page, b.x * s, b.y * s, innerMm * s);

  return darkness.map(pickMark);
}

export type EssayState = 'read' | 'blank' | 'multiple' | 'over';

export interface EssayReading {
  /** The points shaded in the essay's score row(s); null unless `state` is 'read' */
  points: number | null;
  /**
   * 'blank' when nothing (or only the tens digit) is shaded, 'multiple' when a digit row has two marks,
   * 'over' when the shaded number is more than the essay's max points
   */
  state: EssayState;
}

/** Reads the teacher's score rows, one reading per essay; empty when the sheet has none */
export function readEssays(page: GrayImage, shape: SheetShape): EssayReading[] {
  // the box sits above or below the questions depending on the part order
  const box = computeSheetLayout(shape).essay;
  if (!box) return [];
  const essayPoints = box.points;
  const s = page.width / PAGE_MM.width;
  const innerMm = innerRadiusMm(box.bubbleMm);

  return essayPoints.map((max, essay) => {
    const rows = box.rows
      .filter((row) => row.essay === essay)
      .map((row) => ({
        place: row.place,
        // a row has only the digits the essay allows
        mark: pickMark(box.digitX.slice(0, row.digits).map((x) => discDarkness(page, x * s, row.y * s, innerMm * s))),
      }));
    if (rows.some((r) => r.mark.state === 'multiple')) return { points: null, state: 'multiple' };
    const ones = rows.find((r) => r.place === 'ones')!.mark.answer;
    const tens = rows.find((r) => r.place === 'tens')?.mark.answer ?? null;
    // "7" may be shaded as ones only; a lone tens digit means the ones row was forgotten
    if (ones === null) return { points: null, state: 'blank' };
    const points = (tens ?? 0) * 10 + ones;
    return points > max ? { points: null, state: 'over' } : { points, state: 'read' };
  });
}

export interface SheetReading {
  items: ReadItem[];
  /** One reading per essay; empty when the sheet has none */
  essays: EssayReading[];
}

/** The whole pipeline on a grayscale photo; null when the four corner marks can't be found */
export function readSheet(photo: GrayImage, shape: SheetShape): SheetReading | null {
  const corners = findCornerMarks(photo);
  if (!corners) return null;
  const page = flattenLighting(rectifyPage(photo, corners));
  return { items: readBubbles(page, shape), essays: readEssays(page, shape) };
}
