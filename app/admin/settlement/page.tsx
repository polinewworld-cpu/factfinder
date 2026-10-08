import { redirect } from 'next/navigation';

// 기자별 정산은 2026-10-08부터 관리자 "후원내역" 화면의 두 번째 탭 — 옛 주소로 들어오면 그 탭으로
export default function SettlementAdminPage() {
  redirect('/admin/donations?tab=settlement');
}
