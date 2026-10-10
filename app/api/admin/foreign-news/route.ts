import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { ROLES, WRITER_ROLES } from '@/lib/roles';
import { getForeignAvatar, recentForeignReports, refreshForeignNews, setForeignAvatar } from '@/lib/foreignNews';

// 관리자 "김정신 특파원" 데이터 (2026-10-10) — 하루 3번(07·13·19시) 올라오는 최근 보고서들과 프로필 사진 주소를 주고,
// ?refresh=1 이면 지금 회차를 새로 만든다(기자 이상). 한국 관련 이슈를 다룬 영미 주요 외신만 — 선별·번역·권고는 lib/foreignNews.ts
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function requireWriter() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 }) };
  if (!(WRITER_ROLES as readonly string[]).includes(user.role)) {
    return { error: NextResponse.json({ error: '기자 이상만 볼 수 있습니다' }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const auth = await requireWriter();
  if (auth.error) return auth.error;

  try {
    if (req.nextUrl.searchParams.get('refresh') === '1') await refreshForeignNews();
    let reports = await recentForeignReports(6);
    if (!reports.length) reports = [await refreshForeignNews()];
    return NextResponse.json({ reports, avatarUrl: await getForeignAvatar(), canEditAvatar: auth.user!.role === ROLES.CHIEF_EDITOR });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '외신 수집 중 오류' }, { status: 502 });
  }
}

// 프로필 사진 바꾸기 — 편집장만. 사진은 /api/upload로 먼저 올리고 그 주소(/api/blob/…)만 받음
export async function POST(req: NextRequest) {
  const auth = await requireWriter();
  if (auth.error) return auth.error;
  if (auth.user!.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '편집장만 바꿀 수 있습니다' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const url = typeof body.avatarUrl === 'string' ? body.avatarUrl : '';
  if (!/^\/api\/blob\/[A-Za-z0-9._-]+$/.test(url)) return NextResponse.json({ error: '올바른 사진 주소가 아닙니다' }, { status: 400 });
  await setForeignAvatar(url);
  return NextResponse.json({ ok: true, avatarUrl: url });
}
