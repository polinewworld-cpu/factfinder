'use client';

import { useEffect, useRef, useState } from 'react';
import { avatarGradientStyle, usableAvatarUrl } from '@/lib/avatarGradient';

// 상단 메뉴를 프로필 아바타 하나로 묶고, 클릭하면 드롭다운으로
// 기사 작성 / 편집실 (관리자) / 내 프로필 / 로그아웃을 보여주는 방식 (UX 피드백 반영)
export default function AccountMenu({
  name,
  image,
  userId,
  isWriter,
  isChiefEditor,
}: {
  name: string;
  image?: string | null;
  userId?: string;
  isWriter: boolean;
  isChiefEditor: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  const initial = name.trim().charAt(0) || '?';
  const photo = usableAvatarUrl(image);

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="avatar"
        style={photo ? undefined : avatarGradientStyle(userId || name)}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="내 계정 메뉴"
      >
        {photo ? <img src={photo} alt="" /> : initial}
      </button>
      {open && (
        <div className="account-dropdown" role="menu">
          <p className="account-dropdown-name">{name}</p>
          {isWriter && (
            <a className="account-dropdown-item" href="/write" role="menuitem">
              기사 작성
            </a>
          )}
          {/* 2026-10-09: 기자·논설위원도 편집실(동향 보고·기사 작성·사진 뱅크) 이용 */}
          {isWriter && (
            <a className="account-dropdown-item" href={isChiefEditor ? '/admin' : '/admin/trends'} role="menuitem">
              {isChiefEditor ? '편집실 (관리자)' : '편집실'}
            </a>
          )}
          <a className="account-dropdown-item" href="/saved" role="menuitem">
            저장한 기사
          </a>
          <a className="account-dropdown-item" href="/profile" role="menuitem">
            내 프로필
          </a>
          <a className="account-dropdown-item account-dropdown-item--danger" href="/api/auth/signout" role="menuitem">
            로그아웃
          </a>
        </div>
      )}
    </div>
  );
}
