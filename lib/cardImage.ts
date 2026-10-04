export const CARD_RATIOS = [1, 1, 16 / 9];
export const FEATURED_CARD_RATIO = 1.12;
// 2열 슬롯 너비 대비 높이. 1열 1:1 크롭 높이와 맞추면 col/(2col+gap) ≈ 0.484
export const WIDE_CARD_RATIO = 0.484;

export function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function cardImageRatio(articleId?: string | null, featured = false, wide = false) {
  if (featured) return FEATURED_CARD_RATIO;
  if (wide) return WIDE_CARD_RATIO;
  if (!articleId) return 1;
  return CARD_RATIOS[hashString(articleId) % CARD_RATIOS.length];
}

export function isSquareAssignedCrop(articleId?: string | null) {
  return cardImageRatio(articleId) === 1;
}

export function clampFocal(value: unknown, fallback = 50) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function coverObjectPosition(x?: number | null, y?: number | null) {
  return `${clampFocal(x)}% ${clampFocal(y)}%`;
}

export const COVER_HOVER_SCALE = 1.05;
const COVER_HOVER_PAN_OF_ZOOM = 0.4;

export function coverOverflowAxis(
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number,
  fallback: 'x' | 'y' = 'x',
): 'x' | 'y' {
  if (!naturalW || !naturalH || !boxW || !boxH) return fallback;
  const cover = Math.max(boxW / naturalW, boxH / naturalH);
  const overflowX = naturalW * cover - boxW;
  const overflowY = naturalH * cover - boxH;
  if (overflowX > overflowY + 0.5) return 'x';
  if (overflowY > overflowX + 0.5) return 'y';
  return fallback;
}

export function coverDrawnLayout(
  boxW: number,
  boxH: number,
  naturalW: number,
  naturalH: number,
  focalX?: number | null,
  focalY?: number | null,
) {
  const fx = clampFocal(focalX) / 100;
  const fy = clampFocal(focalY) / 100;
  const cover = Math.max(boxW / naturalW, boxH / naturalH);
  const width = naturalW * cover;
  const height = naturalH * cover;
  return {
    width,
    height,
    left: -(width - boxW) * fx,
    top: -(height - boxH) * fy,
  };
}

export function coverHoverPanVars(
  axis: 'x' | 'y',
  focalX?: number | null,
  focalY?: number | null,
  scale = COVER_HOVER_SCALE,
  boxW = 0,
  boxH = 0,
) {
  const fx = clampFocal(focalX);
  const fy = clampFocal(focalY);
  const extra = Math.max(0, scale - 1);
  const origin = (axis === 'x' ? fx : fy) / 100;
  const towardHigh = origin <= 0.5;
  const boxPx = axis === 'x' ? boxW : boxH;
  const leftoverPx = extra * (towardHigh ? 1 - origin : origin) * COVER_HOVER_PAN_OF_ZOOM * boxPx;
  const signed = `${towardHigh ? -leftoverPx : leftoverPx}px`;
  return {
    originX: `${fx}%`,
    originY: `${fy}%`,
    panX: axis === 'x' ? signed : '0px',
    panY: axis === 'y' ? signed : '0px',
  };
}
