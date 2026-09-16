import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 빌드 시 미리 실행(정적 생성)되지 않도록 — DB 접속은 실제 요청이 올 때만
export const dynamic = 'force-dynamic';

// 에디터 특수문자 세트 — 편집장이 에디터 안의 레이어(모달)에서 카테고리별로 추가/삭제 (2026-09-11: 관리자 메뉴에서 이동)
export async function GET() {
  const chars = await prisma.specialCharacter.findMany({ orderBy: [{ category: 'asc' }, { order: 'asc' }] });
  return NextResponse.json(chars);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 특수문자를 추가할 수 있습니다' }, { status: 403 });
  }
  const { char, label, category, order } = await req.json();
  if (!char?.trim()) return NextResponse.json({ error: '문자를 입력해주세요' }, { status: 400 });
  const created = await prisma.specialCharacter.create({
    data: { char: char.trim(), label, category: category?.trim() || '자주쓰는', order: order ?? 0 },
  });
  return NextResponse.json(created, { status: 201 });
}
