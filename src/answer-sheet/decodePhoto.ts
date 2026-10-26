import { ColorConversionCodes, DataTypes, InterpolationFlags, Mat, OpenCV, Size } from 'react-native-fast-opencv';
import type { GrayImage } from './readSheet';

/** Longest side the reader works at: enough to resolve a 4 px/mm page, light enough to scan in JS */
const MAX_SIDE = 1600;

/**
 * Camera photos decode to 3-channel BGR, but a picked image may be BGRA (a PNG with alpha) or already
 * single-channel (a grayscale JPEG), and cvtColor throws when the code doesn't match the channel count.
 */
function toGray(src: Mat): Mat {
  for (const code of [ColorConversionCodes.COLOR_BGR2GRAY, ColorConversionCodes.COLOR_BGRA2GRAY]) {
    const gray = Mat.create(0, 0, DataTypes.CV_8U);
    try {
      OpenCV.cvtColor(src, gray, code);
      return gray;
    } catch {
      gray.release();
    }
  }
  return OpenCV.clone(src);
}

/**
 * Decodes a camera JPEG (base64) to a grayscale image with native OpenCV — decoding a multi-megapixel
 * photo in JavaScript would take seconds. OpenCV honours the EXIF rotation, so a portrait sheet
 * comes out upright. The page is straightened and its bubbles read in `readSheet`.
 */
export function decodePhoto(base64: string): GrayImage {
  const color = Mat.createFromBase64(base64);
  const gray = toGray(color);

  const longest = Math.max(gray.cols, gray.rows);
  let source = gray;
  let small: Mat | null = null;
  if (longest > MAX_SIDE) {
    const scale = MAX_SIDE / longest;
    small = Mat.create(0, 0, DataTypes.CV_8U);
    OpenCV.resize(gray, small, Size.create(Math.round(gray.cols * scale), Math.round(gray.rows * scale)), 0, 0, InterpolationFlags.INTER_AREA);
    source = small;
  }

  const { buffer, cols, rows } = source.toBuffer('uint8');
  // copy out of native memory before releasing the Mats
  const image: GrayImage = { data: new Uint8Array(buffer), width: cols, height: rows };
  color.release();
  gray.release();
  small?.release();
  return image;
}
