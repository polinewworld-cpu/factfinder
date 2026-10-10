import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { ROLES } from '@/lib/roles';
import { disconnectGmail } from '@/lib/gmail';

// 뉴스레터 발송 지메일 연결 끊기 (2026-10-10)
export async function DELETE() {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '편집장만 할 수 있습니다' }, { status: 403 });
  await disconnectGmail();
  return NextResponse.json({ ok: true });
}
