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
  const hue1 = rng() * 360;
  const hue2 = (hue1 + 40 + rng() * 70) % 360;
  const hue3 = (hue1 + 155 + rng() * 90) % 360;
  const c1 = hsl(hue1, 58 + rng() * 28, 42 + rng() * 16);
  const c2 = hsl(hue2, 58 + rng() * 28, 42 + rng() * 16);
  const c3 = hsl(hue3, 58 + rng() * 28, 42 + rng() * 16);
  const angle = Math.floor(rng() * 360);
  return {
    background: `linear-gradient(${angle}deg, ${c1} 0%, ${c2} 48%, ${c3} 100%)`,
  };
}
