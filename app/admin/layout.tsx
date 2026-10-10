import { getCurrentUser } from '@/lib/session';
import { ROLES, WRITER_ROLES } from '@/lib/roles';
import AdminSidebar from '@/components/AdminSidebar';
import AdminGate from '@/components/AdminGate';

// 관리자 화면 공통 레이아웃 — 좌측 2뎁스 메뉴 + 우측 콘텐츠 (UX 피드백: 흩어진 링크를 좌측 메뉴로 정리)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // 2026-10-09: 기자·논설위원도 들어오되 동향 보고·기사 작성·사진 뱅크만 (나머지 화면은 AdminGate가 막고, API도 편집장 전용)
  if (!user || !(WRITER_ROLES as readonly string[]).includes(user.role)) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-gray-600">기자·논설위원·편집장만 들어올 수 있는 편집실입니다.</p>
      </main>
    );
  }
  const isChief = user.role === ROLES.CHIEF_EDITOR;

  return (
    <div className="page-shell backstage zb-admin flex flex-col md:flex-row items-stretch md:items-start gap-2 md:gap-6">
      <AdminSidebar isChief={isChief} me={{ name: user.name, email: user.email, image: user.image }} />
      <div className="min-w-0 w-full flex-1">
        <AdminGate isChief={isChief}>{children}</AdminGate>
      </div>
    </div>
  );
}
