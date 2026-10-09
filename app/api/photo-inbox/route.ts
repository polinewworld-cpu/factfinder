import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { approveInboxItem, runCollector } from '@/lib/photoCollector';

// 사진 뱅크 수신함 (2026-10-09, 3단계) — 편집장 전용
// GET: 대기 목록 + 수집기 설정 / POST {action:'approve'|'reject', ids, peopleIds?, tagNames?} / POST {action:'collect'} 지금 수집
// PATCH {minutes}: 수집 주기(분, 0=끔)
async function chief() {
  const user = await getCurrentUser();
  return user?.role === ROLES.CHIEF_EDITOR ? user : null;
}

export async function GET() {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  const [items, config, counts] = await Promise.all([
    prisma.photoInbox.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.siteConfig.findUnique({ where: { id: 'singleton' }, select: { photoCollectMinutes: true, photoCollectAt: true } }),
    prisma.photoInbox.groupBy({ by: ['status'], _count: true }),
  ]);
  return NextResponse.json({
    items,
    minutes: config?.photoCollectMinutes ?? 60,
    lastAt: config?.photoCollectAt ?? null,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
  });
}

export async function POST(req: NextRequest) {
  const user = await chief();
  if (!user) return NextResponse.json({ error: '편집장만 할 수 있습니다' }, { status: 403 });
  const b = await req.json().catch(() => ({}));

  if (b.action === 'collect') return NextResponse.json(await runCollector());

  const ids: string[] = Array.isArray(b.ids) ? b.ids.map(String) : [];
  if (!ids.length) return NextResponse.json({ error: '고른 항목이 없습니다' }, { status: 400 });

  if (b.action === 'reject') {
    const r = await prisma.photoInbox.updateMany({ where: { id: { in: ids }, status: 'PENDING' }, data: { status: 'REJECTED', decidedAt: new Date() } });
    return NextResponse.json({ rejected: r.count });
  }
  if (b.action === 'approve') {
    const one = ids.length === 1;
    const errors: string[] = [];
    let approved = 0;
    for (const id of ids) {
      try {
        await approveInboxItem(id, user.id, {
          // 한 장씩 승인할 때만 화면에서 고친 인물·태그·캡션 등을 반영, 여러 장은 수집기가 찾은 인물 그대로 + 공통 상황 태그
          ...(one && Array.isArray(b.peopleIds) ? { peopleIds: b.peopleIds.map(String) } : {}),
          ...(Array.isArray(b.tagNames) ? { tagNames: b.tagNames.map(String) } : {}),
          ...(one && typeof b.title === 'string' ? { title: b.title } : {}),
          ...(one && typeof b.credit === 'string' ? { credit: b.credit } : {}),
          ...(one && typeof b.sourceType === 'string' ? { sourceType: b.sourceType } : {}),
          ...(one && typeof b.license === 'string' ? { license: b.license } : {}),
        });
        approved++;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : '승인 실패');
      }
    }
    return NextResponse.json({ approved, errors });
  }
  return NextResponse.json({ error: '알 수 없는 요청' }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 할 수 있습니다' }, { status: 403 });
  const { minutes } = await req.json().catch(() => ({}));
  const m = Math.max(0, Math.min(24 * 60, Math.round(Number(minutes) || 0)));
  await prisma.siteConfig.upsert({ where: { id: 'singleton' }, update: { photoCollectMinutes: m }, create: { id: 'singleton', photoCollectMinutes: m } });
  return NextResponse.json({ minutes: m });
}
