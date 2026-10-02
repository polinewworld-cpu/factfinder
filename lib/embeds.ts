// 에디터에서 유튜브/X(트위터)/인스타그램 링크를 붙여넣으면 임베드 HTML로 변환
// - 유튜브: 바로 iframe으로 렌더링됨 (별도 스크립트 불필요)
// - X/인스타그램: blockquote만 심어두고, 독자 화면에서 각 사의 embed.js가 자동으로 위젯으로 바꿔줌 (components/EmbedScripts.tsx)
export type EmbedType = 'youtube' | 'twitter' | 'instagram';

const YOUTUBE_ID = /^[\w-]{6,}$/;

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function youtubeVideoIdFromUrl(rawUrl: string): { videoId: string; sourceUrl: string } | null {
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
  let videoId = '';
  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? '';
  } else if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch' || url.pathname.startsWith('/watch/')) {
      videoId = url.searchParams.get('v') || url.pathname.split('/')[2] || '';
    } else if (url.pathname.startsWith('/shorts/')) {
      videoId = url.pathname.split('/')[2] ?? '';
    } else if (url.pathname.startsWith('/embed/')) {
      videoId = url.pathname.split('/')[2] ?? '';
    } else if (url.pathname.startsWith('/live/')) {
      videoId = url.pathname.split('/')[2] ?? '';
    } else if (url.pathname.startsWith('/v/')) {
      videoId = url.pathname.split('/')[2] ?? '';
    }
  }
  if (!videoId || !YOUTUBE_ID.test(videoId)) return null;
  return { videoId, sourceUrl: url.toString() };
}

export function youtubeEmbedHtml(videoId: string, sourceUrl: string, linkText?: string): string {
  const safeId = videoId.replace(/[^\w-]/g, '');
  const attrs = [
    'class="embed-youtube"',
    'contenteditable="false"',
    `data-embed-url="${escapeAttr(sourceUrl)}"`,
  ];
  const trimmedText = linkText?.trim();
  if (trimmedText) attrs.push(`data-link-text="${escapeAttr(trimmedText)}"`);
  return `<div ${attrs.join(' ')}><iframe width="100%" height="360" src="https://www.youtube.com/embed/${safeId}" title="YouTube video" frameborder="0" allowfullscreen></iframe></div>`;
}

export function youtubeWatchUrlFromEmbedSrc(src: string): string | null {
  const match = src.match(/\/embed\/([^?&/"']+)/);
  return match?.[1] && YOUTUBE_ID.test(match[1]) ? `https://www.youtube.com/watch?v=${match[1]}` : null;
}

export function parseEmbedUrl(rawUrl: string, linkText?: string): { type: EmbedType; html: string } | null {
  const youtube = youtubeVideoIdFromUrl(rawUrl);
  if (youtube) {
    return {
      type: 'youtube',
      html: youtubeEmbedHtml(youtube.videoId, youtube.sourceUrl, linkText),
    };
  }

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');

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
