import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 빌드 시 미리 실행(정적 생성)되지 않도록 — DB 접속은 실제 요청이 올 때만
export const dynamic = 'force-dynamic';

// "테마"는 Keyword와 달리 별도 테이블이 없고 Article.themeTags(콤마 구분 문자열)에 값만 저장돼 있었음.
// 글쓰기 화면에서 이미 쓰인 테마를 목록에서 "선택"할 수 있게 하려고, 전체 기사에서 실제 사용된
// 테마 이름을 중복 제거해서 뽑아 돌려줌 (2026-09-12 신설 — 이전엔 값만 저장할 뿐 어디서도 쓰이지 않았음)
export async function GET() {
  const rows = await prisma.article.findMany({
    where: { themeTags: { not: null } },
    select: { themeTags: true },
  });
  const set = new Set<string>();
  for (const row of rows) {
    (row.themeTags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => set.add(t));
  }
  const themes = Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  return NextResponse.json(themes);
}

// 테마 전역 삭제 — Keyword와 달리 별도 테이블/ID가 없으므로, 요청받은 이름을 모든 기사의
// themeTags(콤마 구분 문자열)에서 통째로 제거하는 방식으로 처리 (2026-09-12 신설, 편집장 전용)
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 테마를 삭제할 수 있습니다' }, { status: 403 });
  }

  const name = (req.nextUrl.searchParams.get('name') ?? '').trim();
  if (!name) return NextResponse.json({ error: '테마 이름이 필요합니다' }, { status: 400 });

  const rows = await prisma.article.findMany({
    where: { themeTags: { contains: name } },
    select: { id: true, themeTags: true },
  });

  for (const row of rows) {
    const remaining = (row.themeTags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t && t !== name);
    await prisma.article.update({
      where: { id: row.id },
      data: { themeTags: remaining.length > 0 ? remaining.join(',') : null },
    });
  }

  return NextResponse.json({ ok: true });
}
