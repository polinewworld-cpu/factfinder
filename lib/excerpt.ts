import { toFrenchBrackets } from '@/lib/frenchBrackets';

// 기사 요약문(excerpt) 자동 생성 — 별도 입력 없이 본문 앞부분을 사용.
// 카드 제목 아래 1~2줄과 RSS 등 외부 신디케이션에 쓴다.
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

  const copy = toFrenchBrackets(text);
  if (copy.length <= maxLen) return copy;
  return copy.slice(0, maxLen).trim() + '…';
}
