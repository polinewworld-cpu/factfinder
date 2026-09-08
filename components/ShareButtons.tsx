'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Kakao?: any;
  }
}

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

export default function ShareButtons({ title, coverImageUrl }: { title: string; coverImageUrl?: string | null }) {
  const [url, setUrl] = useState('');
  const [kakaoReady, setKakaoReady] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
    if (!KAKAO_JS_KEY) return; // 앱키 미등록 시 카카오 버튼은 비활성 상태로만 노출
    if (!document.getElementById('kakao-sdk')) {
      const s = document.createElement('script');
      s.id = 'kakao-sdk';
      s.src = 'https://developers.kakao.com/sdk/js/kakao.js';
      s.onload = () => {
        if (window.Kakao && !window.Kakao.isInitialized()) window.Kakao.init(KAKAO_JS_KEY);
        setKakaoReady(true);
      };
      document.body.appendChild(s);
    } else {
      setKakaoReady(true);
    }
  }, []);

  function shareFacebook() {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      '_blank',
      'width=600,height=500'
    );
  }

  function shareX() {
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      '_blank',
      'width=600,height=500'
    );
  }

  function shareKakao() {
    if (!kakaoReady || !window.Kakao) return;
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title,
        imageUrl: coverImageUrl || `${window.location.origin}/og-default.png`,
        link: { mobileWebUrl: url, webUrl: url },
      },
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">공유</span>
      <button
        onClick={shareKakao}
        disabled={!KAKAO_JS_KEY}
        title={KAKAO_JS_KEY ? '카카오톡 공유' : '카카오 앱키 등록 후 활성화됩니다'}
        className="w-8 h-8 rounded-full bg-[#FEE500] text-black text-xs font-bold flex items-center justify-center disabled:opacity-30"
      >
        톡
      </button>
      <button
        onClick={shareFacebook}
        title="페이스북 공유"
        className="w-8 h-8 rounded-full bg-[#1877F2] text-white text-xs font-bold flex items-center justify-center"
      >
        f
      </button>
      <button
        onClick={shareX}
        title="X(트위터) 공유"
        className="w-8 h-8 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center"
      >
        X
      </button>
    </div>
  );
}
