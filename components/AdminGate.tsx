'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// 편집실 화면 권한 (2026-10-09 사장님 지시) — 기자·논설위원은 오진실 기자(동향 보고)·김정신 특파원·사진 뱅크(+기사 작성 /write)만.
// 편집실 첫 화면(/admin)으로 오면 동향 보고로 보냄. 데이터 API는 따로 편집장 전용이라 화면만 막아도 새는 것 없음.
export const WRITER_ADMIN_PATHS = ['/admin/trends', '/admin/foreign-news', '/admin/photo-bank']; // 오진실 기자(동향 보고)·김정신 특파원(외신)은 모든 기자가 열람 (2026-10-10)

export default function AdminGate({ isChief, children }: { isChief: boolean; children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const allowed = isChief || WRITER_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!isChief && pathname === '/admin') router.replace('/admin/trends');
  }, [isChief, pathname, router]);

  if (allowed) return <>{children}</>;
  if (pathname === '/admin') return <main className="py-10 text-gray-500">이동 중…</main>;
  return (
    <main className="py-10">
      <p className="text-gray-600">편집장만 볼 수 있는 화면입니다.</p>
    </main>
  );
}
