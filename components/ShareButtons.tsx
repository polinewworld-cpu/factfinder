'use client';

import { useEffect, useState } from 'react';
import { KakaoIcon, FacebookIcon, XIcon, ThreadsIcon, LinkIcon, TelegramIcon, ShareIcon, CloseIcon } from './icons';

declare global {
  interface Window {
    Kakao?: any;
  }
}

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

// 기사 "공유" 버튼 — 클릭 시 레이어(모달)로 페이스북/트위터/스레드/URL공유/카카오톡/텔레그램 6개 노출 (2026-09-12 신설)
// variant="large": 기사 하단 "공유로 전파하기" 큰 버튼 (원고료로 응원하기와 같은 스타일, 2026-09-18)
export default function ShareButtons({
  title,
  coverImageUrl,
  variant = 'icon',
}: {
  title: string;
  coverImageUrl?: string | null;
  variant?: 'icon' | 'large';
}) {
  const [url, setUrl] = useState('');
  const [kakaoReady, setKakaoReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  function shareThreads() {
    window.open(
      `https://www.threads.net/intent/post?text=${encodeURIComponent(`${title} ${url}`)}`,
      '_blank',
      'width=600,height=500'
    );
  }

  function shareTelegram() {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      '_blank',
      'width=600,height=500'
    );
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 권한이 없는 환경 — 조용히 무시
    }
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

  const platforms = [
    { key: 'facebook', label: '페이스북', icon: <FacebookIcon />, onClick: shareFacebook },
    { key: 'x', label: '트위터', icon: <XIcon />, onClick: shareX },
    { key: 'threads', label: '스레드', icon: <ThreadsIcon />, onClick: shareThreads },
    { key: 'url', label: copied ? '복사됨!' : 'URL공유', icon: <LinkIcon />, onClick: copyUrl },
    {
      key: 'kakao',
      label: '카카오톡',
      icon: <KakaoIcon />,
      onClick: shareKakao,
      disabled: !KAKAO_JS_KEY,
    },
    { key: 'telegram', label: '텔레그램', icon: <TelegramIcon />, onClick: shareTelegram },
  ];

  return (
    <>
      {variant === 'large' ? (
        <button type="button" onClick={() => setOpen(true)} className="donate-cta">
          <ShareIcon />
          <span className="hidden sm:inline">공유로 전파하기</span>
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} title="공유" aria-label="공유" className="icon-action">
          <ShareIcon />
        </button>
      )}

      {open && (
        <div className="share-modal-overlay" onClick={() => setOpen(false)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <h3 className="share-modal-title">공유하기</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="share-modal-close">
                <CloseIcon />
              </button>
            </div>
            <p className="share-modal-article-title">{title}</p>
            <div className="share-modal-grid">
              {platforms.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={p.onClick}
                  disabled={p.disabled}
                  className="share-modal-item"
                >
                  <span className="icon-badge icon-badge--lg">{p.icon}</span>
                  <span className="share-modal-item-label">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
