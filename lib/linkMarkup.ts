// 글 속 "핵심 구절 → 기사 링크" 표시 (2026-10-10, 오진실 기자·김정신 특파원)
// AI는 [[구절|번호]] 로만 쓴다(번호 = 우리가 준 기사 목록의 번호). 서버가 번호를 실제 수집한 기사 주소로 바꿔 [[구절|https://…]] 로 저장하고,
// 화면(components/LinkedText.tsx)이 밑줄 친 링크로 그린다. 번호가 틀리면 링크 없이 구절만 남겨 지어낸 주소가 나갈 수 없다.

const MARK_RE = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

export function resolveMarkers(text: string, lookup: (key: string) => string | undefined): string {
  return text.replace(MARK_RE, (_m, phrase: string, key: string) => {
    const url = lookup(key.trim());
    return url && /^https?:\/\/[^\s\]|]+$/.test(url) ? `[[${phrase}|${url}]]` : phrase;
  });
}

export type LinkedPart = { text: string; url?: string };

export function splitLinked(text: string): LinkedPart[] {
  const parts: LinkedPart[] = [];
  let last = 0;
  for (const m of text.matchAll(MARK_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push({ text: text.slice(last, idx) });
    const url = m[2].trim();
    parts.push(/^https?:\/\/[^\s]+$/.test(url) ? { text: m[1], url } : { text: m[1] });
    last = idx + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
