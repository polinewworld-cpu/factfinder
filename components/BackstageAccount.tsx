'use client';

import { usePathname } from 'next/navigation';

/** 카테고리 줄이 숨는 작성/관리 화면에서만 헤더 오른쪽에 계정 메뉴를 남긴다. */
export default function BackstageAccount({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const backstage = pathname?.startsWith('/admin') || pathname === '/write';
  if (!backstage) return null;
  return <>{children}</>;
}
