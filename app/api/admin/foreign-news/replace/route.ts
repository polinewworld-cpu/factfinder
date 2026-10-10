import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { WRITER_ROLES } from '@/lib/roles';
import { replaceForeignItem } from '@/lib/foreignNews';

// 김정신 특파원 항목 × — 지우고 새 토픽으로 교체 (2026-10-10)
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(WRITER_ROLES as readonly string[]).includes(user.role)) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!['overview', 'brief'].includes(b.kind) || typeof b.generatedAt !== 'string' || !Number.isInteger(b.index)) return NextResponse.json({ error: '요청이 올바르지 않습니다' }, { status: 400 });
  try {
    return NextResponse.json({ report: await replaceForeignItem(b.generatedAt, b.kind, b.index) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '교체 실패' }, { status: 502 });
  }
}
