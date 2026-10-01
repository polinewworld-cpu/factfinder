export const CARD_RATIOS = [1, 1, 16 / 9];

export function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function cardImageRatio(articleId?: string | null, featured = false, wide = false) {
  if (featured) return 1.12;
  if (wide) return 0.46;
  if (!articleId) return 1;
  return CARD_RATIOS[hashString(articleId) % CARD_RATIOS.length];
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
const COVER_HOVER_PAN_OF_ZOOM = 0.9;
const COVER_HOVER_OBJECT_SHIFT = 8;

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

export function coverOverflowAmount(
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number,
  axis: 'x' | 'y',
) {
  if (!naturalW || !naturalH || !boxW || !boxH) return 0;
  const cover = Math.max(boxW / naturalW, boxH / naturalH);
  return axis === 'x' ? Math.max(0, naturalW * cover - boxW) : Math.max(0, naturalH * cover - boxH);
}

export function coverHoverPanVars(
  axis: 'x' | 'y',
  focalX?: number | null,
  focalY?: number | null,
  scale = COVER_HOVER_SCALE,
  overflowPx = 0,
) {
  const fx = clampFocal(focalX);
  const fy = clampFocal(focalY);
  const extra = Math.max(0, scale - 1);
  const origin = (axis === 'x' ? fx : fy) / 100;
  const towardHigh = origin <= 0.5;
  const leftoverPct = extra * (towardHigh ? 1 - origin : origin) * COVER_HOVER_PAN_OF_ZOOM * 100;
  const signed = `${towardHigh ? -leftoverPct : leftoverPct}%`;
  const cropShift = overflowPx > 4 ? COVER_HOVER_OBJECT_SHIFT : 0;
  const panFocal = (axis === 'x' ? fx : fy) + (towardHigh ? cropShift : -cropShift);
  const panPos = Math.min(100, Math.max(0, panFocal));
  return {
    originX: `${fx}%`,
    originY: `${fy}%`,
    panX: axis === 'x' ? signed : '0%',
    panY: axis === 'y' ? signed : '0%',
    panOx: `${axis === 'x' ? panPos : fx}%`,
    panOy: `${axis === 'y' ? panPos : fy}%`,
  };
}
