// 기사 본문 HTML 출력 직전 보정 (SEO, 2026-10-08)
//  · 사진 대체 텍스트(alt): 비어 있으면 그 사진 캡션 → 없으면 기사 제목으로 채움 (이미지 검색·접근성)
//  · 지연 로딩: 첫 사진만 바로 불러오고 나머지는 화면에 가까워질 때 (기사 여는 속도)
// 저장된 본문은 건드리지 않고 화면에 내보낼 때만 적용.

const attrEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&') // 마지막에 — 위에서 다시 이스케이프하므로 이중 이스케이프 방지
    .replace(/\s+/g, ' ')
    .trim();

export function enhanceArticleImages(html: string, articleTitle: string): string {
  if (!html) return html;
  // 1) figure 안 사진은 그 figure의 캡션을 대체 텍스트로
  let out = html.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, (fig) => {
    const caption = plain(fig.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? '').slice(0, 150);
    return caption ? fig.replace(/<img\b([^>]*?)\s*\/?>/i, (img, attrs) => withAlt(img, attrs, caption)) : fig;
  });
  // 2) 나머지 사진은 기사 제목으로, 그리고 지연 로딩
  let index = 0;
  out = out.replace(/<img\b([^>]*?)\s*\/?>/gi, (img, attrs: string) => {
    let a = attrs;
    if (!/\balt="[^"]+"/i.test(a)) a = a.replace(/\s*\balt="[^"]*"/i, '') + ` alt="${attrEscape(articleTitle.slice(0, 150))}"`;
    if (index++ > 0 && !/\bloading=/i.test(a)) a += ' loading="lazy"';
    if (!/\bdecoding=/i.test(a)) a += ' decoding="async"';
    return `<img${a} />`;
  });
  return out;
}

function withAlt(img: string, attrs: string, alt: string) {
  if (/\balt="[^"]+"/i.test(attrs)) return img;
  return `<img${attrs.replace(/\s*\balt="[^"]*"/i, '')} alt="${attrEscape(alt)}" />`;
}
