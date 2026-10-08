import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { putBlob } from '@/lib/blobStorage';
import { createHash } from 'crypto';

// 옛 기사 사진 옮기기 (2026-10-08) — 이관된 옛 기사 본문·대표사진이 아직 다다미디어 서버(www.factfinder.tv/data/…)를
// 가리키고 있어, 도메인 전환 전에 우리 저장소(Supabase, putBlob)로 옮기고 주소를 /api/blob/legacy-… 로 바꾼다.
// 관리자 화면(/admin/legacy-images)이 POST를 반복 호출해 몇 건씩 처리 — 같은 사진은 같은 파일명이라 다시 돌려도 안전.
// ⚠️ 도메인을 2.0으로 전환한 뒤에는 www.factfinder.tv/data/ 가 새 사이트를 가리켜 받아올 수 없으니 반드시 전환 전에 끝낼 것.

const OLD_IMAGE = /https?:\/\/(?:www\.)?factfinder\.tv(\/data\/[^"'\s)]+)/g;
const BATCH = 5; // 한 번 호출에 처리할 기사 수

async function requireChief() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '편집장만 실행할 수 있습니다' }, { status: 403 });
  return null;
}

const hasOldImage = {
  legacyId: { not: null },
  OR: [{ content: { contains: 'factfinder.tv/data/' } }, { coverImageUrl: { contains: 'factfinder.tv/data/' } }],
};

export async function GET() {
  const denied = await requireChief();
  if (denied) return denied;
  const [remaining, total] = await Promise.all([
    prisma.article.count({ where: hasOldImage }),
    prisma.article.count({ where: { legacyId: { not: null } } }),
  ]);
  return NextResponse.json({ remaining, total });
}

// 옛 주소 하나를 받아 저장소에 올리고 새 주소를 돌려줌. 옛 서버에서도 없는 사진(404 등)은 null
async function moveImage(path: string): Promise<string | null> {
  // 저장소 파일명은 영문·숫자만 안전 — 한글·공백이 섞인 옛 파일명은 원래 경로의 해시를 붙여 충돌 없이 변환
  const rel = decodeURIComponent(path).replace(/^\/data\//, '');
  const flat = rel.replace(/\//g, '-');
  const safe = flat.replace(/[^A-Za-z0-9._-]/g, '_');
  const ext = safe.match(/\.[A-Za-z0-9]{2,5}$/)?.[0] ?? '';
  const hash = createHash('sha1').update(rel).digest('hex').slice(0, 8);
  const filename = `legacy-${safe === flat ? safe : `${safe.slice(0, safe.length - ext.length)}-${hash}${ext}`}`;
  try {
    const res = await fetch(`https://www.factfinder.tv${path}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    await putBlob(filename, buf, res.headers.get('content-type') || 'image/jpeg');
    return `/api/blob/${filename}`;
  } catch {
    return null;
  }
}

// body: { after?: number } — 이 옛 기사 번호 다음부터 처리 (실패한 사진이 있는 기사에서 멈추지 않도록 커서로 진행)
export async function POST(req: NextRequest) {
  const denied = await requireChief();
  if (denied) return denied;
  const { after = 0 } = await req.json().catch(() => ({}));

  const articles = await prisma.article.findMany({
    where: { ...hasOldImage, legacyId: { gt: Number(after) || 0 } },
    orderBy: { legacyId: 'asc' },
    take: BATCH,
    select: { id: true, legacyId: true, content: true, coverImageUrl: true, updatedAt: true },
  });

  let moved = 0;
  let failed = 0;
  for (const a of articles) {
    const paths = new Set<string>();
    for (const m of `${a.content} ${a.coverImageUrl ?? ''}`.matchAll(OLD_IMAGE)) paths.add(m[1]);
    const results = await Promise.all([...paths].map(async (p) => [p, await moveImage(p)] as const));
    const map = new Map(results.filter(([, url]) => url) as [string, string][]);
    moved += map.size;
    failed += results.length - map.size;

    const swap = (s: string) => s.replace(OLD_IMAGE, (whole, p) => map.get(p) ?? whole);
    await prisma.article.update({
      where: { id: a.id },
      // updatedAt을 그대로 넘겨 옛 사이트 수정일 유지 (사진 주소만 바뀐 것이라 기사 수정이 아님)
      data: { content: swap(a.content), coverImageUrl: a.coverImageUrl ? swap(a.coverImageUrl) : a.coverImageUrl, updatedAt: a.updatedAt },
    });
  }

  const last = articles.at(-1)?.legacyId ?? null;
  return NextResponse.json({ processed: articles.length, moved, failed, next: last, done: articles.length < BATCH });
}
