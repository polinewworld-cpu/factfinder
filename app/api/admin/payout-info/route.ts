import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 정산용 입금 계좌 저장 (2026-10-09) — 후원내역 → 기자별 정산내역에서 기자·비회원 기자 누구든 계좌를 바로 넣고 고침. 편집장 전용.
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 60) : null);

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '편집장만 고칠 수 있습니다' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!b.userId) return NextResponse.json({ error: 'userId가 필요합니다' }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { id: String(b.userId) }, select: { id: true } });
  if (!target) return NextResponse.json({ error: '기자를 찾을 수 없습니다' }, { status: 404 });
  await prisma.user.update({
    where: { id: target.id },
    data: { bankName: str(b.bankName), bankAccount: str(b.bankAccount), accountHolder: str(b.accountHolder) },
  });
  return NextResponse.json({ ok: true });
}
