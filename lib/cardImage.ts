export const CARD_RATIOS = [0.72, 0.96, 16 / 9];

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
  if (!articleId) return 0.96;
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
