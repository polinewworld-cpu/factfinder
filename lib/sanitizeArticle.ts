import sanitizeHtml from 'sanitize-html';

// 기사 본문(article.content)은 저장 시 무조건 이 필터를 거친다.
// 렌더링 쪽(app/article/[id]/page.tsx)은 dangerouslySetInnerHTML로 그대로 뿌리기 때문에,
// 여기서 걸러지지 않은 태그/속성은 방문자 브라우저에서 그대로 실행된다 — 반드시 저장 시점에 걸러야 함.
// 에디터(app/write/page.tsx)가 실제로 만들어내는 태그만 화이트리스트로 허용:
//   굵게/기울임/밑줄, 링크, 이미지, 형광펜(mark), 유튜브 임베드(iframe), X/인스타 임베드(blockquote)
export function sanitizeArticleContent(html: string): string {
  return sanitizeHtml(html ?? '', {
    allowedTags: [
      'p', 'br', 'div', 'span',
      'b', 'strong', 'i', 'em', 'u', 'mark',
      'a', 'img', 'blockquote', 'iframe',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt'],
      div: ['class', 'contenteditable'],
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
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    },
  });
}
