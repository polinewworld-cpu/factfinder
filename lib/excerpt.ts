// 기사 요약문(excerpt) 자동 생성 — 별도 입력 없이 본문 첫 문장을 사용.
// 화면 어디에도 노출하지 않고 RSS 등 외부 신디케이션용으로만 사용한다 (2026-09-11 신설).
export function deriveExcerpt(html: string, maxLen = 140): string {
  if (!html) return '';

  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ') // 스크립트/스타일 내용 제거
    .replace(/<[^>]+>/g, ' ') // 태그 제거
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + '…';
}
