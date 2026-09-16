'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 특수문자 관리는 2026-09-11부터 관리자 메뉴가 아니라 기사 작성 화면(/write)에서 바로 처리함
// (편집장 전용 인라인 추가/삭제 UI). 이 라우트는 옛 북마크/링크를 위한 리다이렉트만 남겨둠.
export default function SpecialCharactersAdminPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/write');
  }, [router]);
  return (
    <main className="max-w-2xl mx-auto px-4 py-10 text-gray-500">
      특수문자 관리는 이제 기사 작성 화면에서 바로 할 수 있습니다. 이동 중…
    </main>
  );
}
