// 메모리 기반 단순 rate limit. Render 무료 인스턴스는 프로세스가 1개뿐이라
// 별도 저장소(Redis 등) 없이 이 정도로 충분함 — 인스턴스를 여러 개로 늘리면 재검토 필요.
const buckets = new Map<string, number[]>();

// 오래된 키가 쌓이지 않도록 가끔 정리
let lastSweep = Date.now();
function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((t) => now - t < windowMs);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}

/** key(사용자ID/IP 등)가 windowMs 동안 limit번을 넘겨 호출했으면 false */
export function allowRequest(key: string, limit: number, windowMs: number): boolean {
  sweep(windowMs);
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || 'unknown';
}
