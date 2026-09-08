import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 관리자가 미리 만들어두는 키워드 목록 (여론, 단독 등)
export async function GET() {
  const keywords = await prisma.keyword.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(keywords);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 키워드를 추가할 수 있습니다' }, { status: 403 });
  }
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: '키워드 이름을 입력해주세요' }, { status: 400 });
  const keyword = await prisma.keyword.create({ data: { name: name.trim() } });
  return NextResponse.json(keyword, { status: 201 });
}
