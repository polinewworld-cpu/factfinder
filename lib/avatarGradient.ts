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

function wrapHue(hue: number) {
  return ((hue % 360) + 360) % 360;
}

function isMuddyHue(hue: number) {
  const h = wrapHue(hue);
  return h > 46 && h < 118;
}

/** Three neighbouring vivid hues (~30deg apart). Retry if the set walks into olive/yellow-green. */
function pickAnalogousTrio(rng: () => number): [number, number, number][] {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const base = rng() * 360;
    const step = 26 + rng() * 10;
    const hues = [base, base + step, base + step * 2].map(wrapHue);
    if (hues.some(isMuddyHue)) continue;
    return hues.map((h) => [h, 92 + rng() * 6, 48 + rng() * 8] as [number, number, number]);
  }
  return [
    [200, 94, 50],
    [228, 92, 52],
    [256, 88, 54],
  ];
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
  const [a, b, c] = pickAnalogousTrio(rng);
  const angle = Math.floor(rng() * 360);
  return {
    background: `linear-gradient(${angle}deg, ${hsl(...a)} 0%, ${hsl(...b)} 48%, ${hsl(...c)} 100%)`,
  };
}
