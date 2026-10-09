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

export function youtubeFullFrameThumb(url: string) {
  return url.replace(/\/(hqdefault|sddefault|default|0)\.(jpg|webp)(\?.*)?$/i, '/maxresdefault.$2$3');
}

// YouTube hqdefault/sddefault are 4:3 with 16:9 (or 9:16) content and bars.
// Strip those bars first so a 1:1 cover is full-bleed of the video frame.
export function coverContentInset(
  naturalW: number,
  naturalH: number,
  contentAspect?: number | null,
) {
  if (!contentAspect || !naturalW || !naturalH) {
    return { w: naturalW, h: naturalH, x: 0, y: 0 };
  }
  const imageAspect = naturalW / naturalH;
  if (imageAspect > contentAspect + 0.02) {
    const w = naturalH * contentAspect;
    return { w, h: naturalH, x: (naturalW - w) / 2, y: 0 };
  }
  if (imageAspect + 0.02 < contentAspect) {
    const h = naturalW / contentAspect;
    return { w: naturalW, h, x: 0, y: (naturalH - h) / 2 };
  }
  return { w: naturalW, h: naturalH, x: 0, y: 0 };
}

export function coverOverflowAxis(
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number,
  fallback: 'x' | 'y' = 'x',
  contentAspect?: number | null,
): 'x' | 'y' {
  const content = coverContentInset(naturalW, naturalH, contentAspect);
  if (!content.w || !content.h || !boxW || !boxH) return fallback;
  const cover = Math.max(boxW / content.w, boxH / content.h);
  const overflowX = content.w * cover - boxW;
  const overflowY = content.h * cover - boxH;
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
  contentAspect?: number | null,
) {
  const content = coverContentInset(naturalW, naturalH, contentAspect);
  const fx = clampFocal(focalX) / 100;
  const fy = clampFocal(focalY) / 100;
  const cover = Math.max(boxW / content.w, boxH / content.h);
  const width = naturalW * cover;
  const height = naturalH * cover;
  return {
    width,
    height,
    left: -content.x * cover - (content.w * cover - boxW) * fx,
    top: -content.y * cover - (content.h * cover - boxH) * fy,
  };
}

export function coverOverflowPx(
  boxW: number,
  boxH: number,
  naturalW: number,
  naturalH: number,
  contentAspect?: number | null,
) {
  const content = coverContentInset(naturalW, naturalH, contentAspect);
  if (!content.w || !content.h || !boxW || !boxH) return { x: 0, y: 0 };
  const cover = Math.max(boxW / content.w, boxH / content.h);
  return {
    x: Math.max(0, content.w * cover - boxW),
    y: Math.max(0, content.h * cover - boxH),
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

// 카드에 쓰는 사진 주소 → 축소본 주소(app/api/blob/[filename]이 처음 요청 때 만들어 저장, 2026-10-09). 우리 저장소(/api/blob/) 사진만. GIF는 움직이는 webp로 줄임
export const CARD_WIDTHS = [800, 1600] as const;
export function sizedImage(url: string | null | undefined, width: (typeof CARD_WIDTHS)[number]): string | undefined {
  if (!url) return undefined;
  if (!url.startsWith('/api/blob/') || url.includes('?')) return url;
  return `${url}?w=${width}`;
}
