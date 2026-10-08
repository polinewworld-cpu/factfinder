import sanitizeHtml from 'sanitize-html';
import { toFrenchBrackets } from '@/lib/frenchBrackets';

const YOUTUBE_CONVERT_LABEL = '일반 텍스트 링크로 변환하기';

// 작성기에서만 쓰는 변환 버튼이 본문에 남거나, 버튼 태그만 벗겨지고 문구가 남는 경우를 제거한다.
export function stripYoutubeComposerControls(html: string): string {
  if (!html) return html;
  const withoutEmbedExtras = html.replace(
    /<div\b([^>]*\bembed-youtube\b[^>]*)>([\s\S]*?)<\/div>/gi,
    (_match, attrs: string, inner: string) => {
      const iframe = inner.match(/<iframe\b[\s\S]*?<\/iframe>/i)?.[0];
      if (iframe) return `<div${attrs}>${iframe}</div>`;
      const cleaned = inner
        .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '')
        .replace(new RegExp(YOUTUBE_CONVERT_LABEL, 'g'), '')
        .trim();
      return `<div${attrs}>${cleaned}</div>`;
    },
  );
  return withoutEmbedExtras
    .replace(/<button\b[^>]*class="[^"]*embed-to-text[^"]*"[^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/<p[^>]*>\s*(?:일반 텍스트 링크로 변환하기\s*)+<\/p>/g, '')
    .replace(new RegExp(YOUTUBE_CONVERT_LABEL, 'g'), '');
}

// 기사 본문(article.content)은 저장 시 무조건 이 필터를 거친다.
// 렌더링 쪽(app/article/[id]/page.tsx)은 dangerouslySetInnerHTML로 그대로 뿌리기 때문에,
// 여기서 걸러지지 않은 태그/속성은 방문자 브라우저에서 그대로 실행된다 — 반드시 저장 시점에 걸러야 함.
// 에디터(app/write/page.tsx)가 실제로 만들어내는 태그만 화이트리스트로 허용:
//   굵게/기울임/밑줄, 링크, 이미지, 형광펜(mark), 유튜브 임베드(iframe), X/인스타 임베드(blockquote)
export function sanitizeArticleContent(html: string): string {
  const sanitized = sanitizeHtml(html ?? '', {
    allowedTags: [
      'p', 'br', 'div', 'span',
      'b', 'strong', 'i', 'em', 'u', 'mark',
      'a', 'img', 'blockquote', 'iframe',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4',
      // 본문 사진+캡션(<figure class="article-figure"><img><figcaption>) — 빠져 있어서 캡션이 사진 옆 맨글자로 깨지던 문제 수정 (2026-10-08)
      'figure', 'figcaption',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt'],
      figure: ['class'],
      div: ['class', 'contenteditable', 'data-embed-url', 'data-link-text'],
      mark: ['class', 'style'],
      span: ['class', 'style'],
      blockquote: ['class', 'data-instgrm-permalink'],
      iframe: ['src', 'width', 'height', 'title', 'frameborder', 'allowfullscreen'],
    },
    allowedIframeHostnames: ['www.youtube.com'],
    allowedSchemes: ['http', 'https'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowedStyles: {
      mark: { background: [/^#[0-9a-f]{3,6}$/i, /^rgba?\([\d\s,.]+\)$/i] },
      span: { background: [/^#[0-9a-f]{3,6}$/i, /^rgba?\([\d\s,.]+\)$/i] },
    },
    nonTextTags: ['script', 'style', 'textarea', 'option', 'button'],
    exclusiveFilter: (frame) => frame.tag === 'button',
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    },
  });
  return toFrenchBrackets(stripYoutubeComposerControls(sanitized));
}
