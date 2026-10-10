import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { WRITER_ROLES } from '@/lib/roles';
import { pastOhLetters } from '@/lib/analyticsSnapshot';

// 오진실 기자의 지난 편지들 (2026-10-10) — 기자 이상. 새로 받을 때마다 시각별로 보관된 것을 최신 순으로
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(WRITER_ROLES as readonly string[]).includes(user.role)) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  return NextResponse.json({ letters: await pastOhLetters() });
}
