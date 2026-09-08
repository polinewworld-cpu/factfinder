// 에디터에서 유튜브/X(트위터)/인스타그램 링크를 붙여넣으면 임베드 HTML로 변환
// - 유튜브: 바로 iframe으로 렌더링됨 (별도 스크립트 불필요)
// - X/인스타그램: blockquote만 심어두고, 독자 화면에서 각 사의 embed.js가 자동으로 위젯으로 바꿔줌 (components/EmbedScripts.tsx)
export type EmbedType = 'youtube' | 'twitter' | 'instagram';

export function parseEmbedUrl(rawUrl: string): { type: EmbedType; html: string } | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');

  // 유튜브
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') {
    let videoId = '';
    if (host === 'youtu.be') videoId = url.pathname.slice(1);
    else if (url.pathname === '/watch') videoId = url.searchParams.get('v') ?? '';
    else if (url.pathname.startsWith('/shorts/')) videoId = url.pathname.split('/')[2] ?? '';
    if (!videoId) return null;
    return {
      type: 'youtube',
      html: `<div class="embed-youtube" contenteditable="false"><iframe width="100%" height="360" src="https://www.youtube.com/embed/${videoId}" title="YouTube video" frameborder="0" allowfullscreen></iframe></div>`,
    };
  }

  // X(트위터)
  if (host === 'twitter.com' || host === 'x.com') {
    return {
      type: 'twitter',
      html: `<blockquote class="twitter-tweet" contenteditable="false"><a href="${url.toString()}"></a></blockquote>`,
    };
  }

  // 인스타그램
  if (host === 'instagram.com') {
    return {
      type: 'instagram',
      html: `<blockquote class="instagram-media" data-instgrm-permalink="${url.toString()}" contenteditable="false"></blockquote>`,
    };
  }

  return null;
}
