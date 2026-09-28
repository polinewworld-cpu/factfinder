function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsl(hue: number, sat: number, light: number) {
  return `hsl(${Math.round(hue)} ${Math.round(sat)}% ${Math.round(light)}%)`;
}

/** Neighbouring vivid hues only — no complementary pairs, no yellow-green / olive in-betweens. */
const WARM: [number, number, number][] = [
  [322, 86, 54],
  [340, 90, 54],
  [6, 92, 52],
  [24, 94, 52],
];

const COOL: [number, number, number][] = [
  [152, 82, 44],
  [186, 86, 46],
  [214, 90, 52],
  [252, 78, 56],
  [292, 76, 54],
];

function pickVividTrio(rng: () => number): [number, number, number][] {
  const family = rng() < 0.5 ? WARM : COOL;
  const start = Math.floor(rng() * (family.length - 2));
  const trio = family.slice(start, start + 3);
  for (let i = trio.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [trio[i], trio[j]] = [trio[j], trio[i]];
  }
  return trio;
}

/**
 * Google always sends an image URL, even when the account has no photo —
 * a generated coloured-letter avatar on googleusercontent.com.
 * Real uploads use `/a-/…`; generated defaults use `/a/…` (no hyphen).
 */
export function usableAvatarUrl(url?: string | null): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!parsed.hostname.endsWith('googleusercontent.com')) return url;
  const path = parsed.pathname;
  if (path.includes('AAAAAAAAAAA') || path.includes('default-user')) return null;
  if (path.includes('/a-/')) return url;
  if (path.includes('/a/')) return null;
  return url;
}

/** Seeded 3-colour gradient so the same person keeps the same avatar. */
export function avatarGradientStyle(seed: string): { background: string } {
  const rng = mulberry32(hashString(seed || 'factfinder'));
  const [a, b, c] = pickVividTrio(rng);
  const angle = Math.floor(rng() * 360);
  return {
    background: `linear-gradient(${angle}deg, ${hsl(...a)} 0%, ${hsl(...b)} 48%, ${hsl(...c)} 100%)`,
  };
}
