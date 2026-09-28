import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WRITER_ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 빌드 시 미리 실행(정적 생성)되지 않도록 — DB 접속은 실제 요청이 올 때만
export const dynamic = 'force-dynamic';

// 관리자가 미리 만들어두는 키워드 목록 (여론, 단독 등)
export async function GET() {
  const keywords = await prisma.keyword.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(keywords);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (!WRITER_ROLES.includes(user.role as any)) {
    return NextResponse.json({ error: '작성자만 키워드를 추가할 수 있습니다' }, { status: 403 });
  }
  const { name } = await req.json();
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return NextResponse.json({ error: '키워드 이름을 입력해주세요' }, { status: 400 });
  const existing = await prisma.keyword.findUnique({ where: { name: trimmed } });
  if (existing) return NextResponse.json(existing);
  const keyword = await prisma.keyword.create({ data: { name: trimmed } });
  return NextResponse.json(keyword, { status: 201 });
}
