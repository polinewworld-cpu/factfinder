// 글 속 "핵심 구절 → 기사 링크" 표시 (2026-10-10, 오진실 기자·김정신 특파원)
// AI는 [[구절|번호]] 로만 쓴다(번호 = 우리가 준 기사 목록의 번호). 서버가 번호를 실제 수집한 기사 주소로 바꿔 [[구절|https://…]] 로 저장하고,
// 화면(components/LinkedText.tsx)이 밑줄 친 링크로 그린다. 번호가 틀리면 링크 없이 구절만 남겨 지어낸 주소가 나갈 수 없다.
// AI가 형식을 어긴 경우([[구절 [[C0]]]], [[구절 (C0)]] 등)도 구절만 살리고 괄호·번호는 지운다 — 화면에 괄호가 새어 나오지 않게 (2026-10-10 수정).

const MARK_RE = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

// 형식을 어긴 표시를 [[구절|번호]]로 바로잡고, 구절 없는 번호만 든 표시는 지운다
function normalize(text: string): string {
  return text
    .replace(/\[\[\s*([^\[\]|]+?)\s*\[\[\s*([A-Za-z]?\d+)\s*\]\]\s*\]\]/g, '[[$1|$2]]') // [[구절 [[C0]]]]
    .replace(/\[\[\s*([^\[\]|]+?)\s*[(（]\s*([A-Za-z]?\d+)\s*[)）]\s*\]\]/g, '[[$1|$2]]') // [[구절 (C0)]]
    .replace(/\[\[\s*[A-Za-z]?\d+\s*\]\]/g, ''); // [[C0]] — 구절 없이 번호만
}

// 남은 표시 찌꺼기 정리 — 번호를 못 풀었을 때 구절만 남기고, 짝 없는 괄호는 지움
function sweep(text: string): string {
  return text
    .replace(/\[\[([^\]|]+)\|[^\]]*\]\]/g, '$1')
    .replace(/\[\[|\]\]/g, '')
    .replace(/\s{2,}/g, ' ');
}

export function resolveMarkers(text: string, lookup: (key: string) => string | undefined): string {
  const resolved = normalize(text).replace(MARK_RE, (_m, phrase: string, key: string) => {
    const url = lookup(key.trim());
    return url && /^https?:\/\/[^\s\]|]+$/.test(url) ? `[[${phrase}|${url}]]` : phrase;
  });
  return resolved;
}

// 링크 없이 글자만 필요할 때(예: 한 줄 브리핑은 옆에 매체 링크가 따로 있음)
export function stripMarkers(text: string): string {
  return sweep(normalize(text));
}

export type LinkedPart = { text: string; url?: string };

export function splitLinked(text: string): LinkedPart[] {
  const clean = normalize(text);
  const parts: LinkedPart[] = [];
  let last = 0;
  const tidy = (t: string) => sweep(t);
  for (const m of clean.matchAll(MARK_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push({ text: tidy(clean.slice(last, idx)) });
    const url = m[2].trim();
    parts.push(/^https?:\/\/[^\s]+$/.test(url) ? { text: m[1], url } : { text: m[1] }); // 번호만 남은 옛 글은 구절만
    last = idx + m[0].length;
  }
  if (last < clean.length) parts.push({ text: tidy(clean.slice(last)) });
  return parts.filter((p) => p.text);
}
