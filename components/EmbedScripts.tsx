'use client';

import { useEffect } from 'react';

// 본문에 X(트위터)/인스타그램 임베드 blockquote가 있으면 각 사의 위젯 스크립트를 불러와 실제 카드로 렌더링.
// 유튜브는 iframe이라 별도 스크립트 없이 바로 보임.
export default function EmbedScripts() {
  useEffect(() => {
    if (document.querySelector('.twitter-tweet') && !document.getElementById('twitter-wjs')) {
      const s = document.createElement('script');
      s.id = 'twitter-wjs';
      s.src = 'https://platform.twitter.com/widgets.js';
      s.async = true;
      document.body.appendChild(s);
    }
    if (document.querySelector('.instagram-media') && !document.getElementById('instagram-embed-js')) {
      const s = document.createElement('script');
      s.id = 'instagram-embed-js';
      s.src = 'https://www.instagram.com/embed.js';
      s.async = true;
      document.body.appendChild(s);
    } else if (document.querySelector('.instagram-media') && (window as any).instgrm) {
      (window as any).instgrm.Embeds.process();
    }
  }, []);

  return null;
}
