import { getCurrentUser } from '@/lib/session';
import { ROLES } from '@/lib/roles';
import AdminSidebar from '@/components/AdminSidebar';

// 관리자 화면 공통 레이아웃 — 좌측 2뎁스 메뉴 + 우측 콘텐츠 (UX 피드백: 흩어진 링크를 좌측 메뉴로 정리)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user || user.role !== ROLES.CHIEF_EDITOR) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-gray-600">편집장만 접근할 수 있는 관리자 화면입니다.</p>
      </main>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] items-start gap-6 px-4">
      <AdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
