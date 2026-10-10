import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { SOURCE_TYPES } from '@/lib/photoBankRules';

// 사진 뱅크 서버 쪽 (2026-10-09) — 통합 검색, 사용 이력 기록

export const PHOTO_INCLUDE = {
  tags: true,
  people: true,
  uploader: { select: { name: true, nickname: true } },
  _count: { select: { usages: true } },
} satisfies Prisma.PhotoInclude;

export type PhotoSearch = {
  q?: string;
  sources?: string[];
  tag?: string;
  people?: string[]; // Person id
  peopleMode?: 'all' | 'any';
  from?: string; // 촬영일 YYYY-MM-DD
  to?: string;
  usage?: 'unused' | 'not7d' | '';
  sort?: 'latest' | 'taken' | 'created' | 'leastUsed'; // latest(기본) = 촬영일, 없으면 등록일 기준 최신순 (2026-10-10)
};

export function searchFromParams(sp: URLSearchParams): PhotoSearch {
  const list = (k: string) => sp.get(k)?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  return {
    q: sp.get('q')?.trim() || undefined,
    sources: list('sources'),
    tag: sp.get('tag')?.trim() || undefined,
    people: list('people'),
    peopleMode: sp.get('peopleMode') === 'any' ? 'any' : 'all',
    from: sp.get('from') || undefined,
    to: sp.get('to') || undefined,
    usage: (sp.get('usage') as PhotoSearch['usage']) || '',
    sort: (sp.get('sort') as PhotoSearch['sort']) || 'latest',
  };
}

export async function searchPhotos(s: PhotoSearch, take = 200) {
  const and: Prisma.PhotoWhereInput[] = [];
  if (s.q) {
    const c = { contains: s.q, mode: 'insensitive' as const };
    // 검색창 하나로 인물·별칭, 캡션, 크레디트, 촬영자·기관(+파일명·상황 태그)
    and.push({
      OR: [
        { title: c },
        { credit: c },
        { photographer: c },
        { filename: c },
        { tags: { some: { name: c } } },
        { people: { some: { OR: [{ name: c }, { aliases: c }] } } },
      ],
    });
  }
  const sources = (s.sources ?? []).filter((x) => (SOURCE_TYPES as readonly string[]).includes(x));
  if (sources.length) {
    const withNone = (s.sources ?? []).includes('NONE'); // 옛 갤러리 사진(출처 미입력)
    and.push({ OR: [{ sourceType: { in: sources as any } }, ...(withNone ? [{ sourceType: null }] : [])] });
  } else if ((s.sources ?? []).includes('NONE')) {
    and.push({ sourceType: null });
  }
  // 출처 미입력(옛 갤러리 사진)도 목록에는 다 보임 — 숨겼더니 기존 사진이 전부 사라진 것처럼 보였음(2026-10-09 되돌림).
  // 대신 기사에 넣을 때 막음(출처를 먼저 입력해야 넣기 가능) — components/PhotoBank.tsx
  if (s.tag) and.push({ tags: { some: { name: s.tag } } });
  if (s.people?.length) {
    if (s.peopleMode === 'any') and.push({ people: { some: { id: { in: s.people } } } });
    else for (const id of s.people) and.push({ people: { some: { id } } });
  }
  if (s.from || s.to) {
    and.push({
      takenAt: {
        ...(s.from ? { gte: new Date(`${s.from}T00:00:00+09:00`) } : {}),
        ...(s.to ? { lte: new Date(`${s.to}T23:59:59+09:00`) } : {}),
      },
    });
  }
  if (s.usage === 'unused') and.push({ usages: { none: {} } });
  if (s.usage === 'not7d') and.push({ usages: { none: { firstUsedAt: { gte: new Date(Date.now() - 7 * 86400_000) } } } });

  const orderBy: Prisma.PhotoOrderByWithRelationInput[] =
    s.sort === 'taken'
      ? [{ takenAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }]
      : s.sort === 'leastUsed'
        ? [{ usages: { _count: 'asc' } }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }];

  const where = and.length ? { AND: and } : {};
  if (s.sort === 'latest') {
    // 최신 사진순(기본, 2026-10-10 사장님): 촬영일이 있으면 촬영일, 없으면 등록일로 — DB 정렬로는 못 섞어서 넉넉히 받아 정렬
    const rows = await prisma.photo.findMany({ where, include: PHOTO_INCLUDE, orderBy: [{ createdAt: 'desc' }], take: Math.min(take * 5, 1500) });
    const when = (p: (typeof rows)[number]) => (p.takenAt ?? p.createdAt).getTime();
    return rows.sort((a, b) => when(b) - when(a)).slice(0, take);
  }
  return prisma.photo.findMany({ where, include: PHOTO_INCLUDE, orderBy, take });
}

// 우리 저장소 주소만 비교(절대주소로 들어간 경우 대비)
const normalizeUrl = (u: string) => u.replace(/^https?:\/\/[^/]+(?=\/api\/blob\/)/, '').trim();

function imageSrcs(html: string) {
  return Array.from(html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi), (m) => normalizeUrl(m[1].replace(/&amp;/g, '&')));
}

// 기사 저장 때 — 본문·커버·카드뉴스에 들어간 사진 뱅크 사진을 사용 이력에 기록 (같은 기사는 처음 쓴 날만 남김)
export async function syncPhotoUsage(articleId: string, html?: string | null, extraUrls: (string | null | undefined)[] = []) {
  const urls = Array.from(new Set([...(html ? imageSrcs(html) : []), ...extraUrls.filter(Boolean).map((u) => normalizeUrl(u!))]));
  if (!urls.length) return;
  const photos = await prisma.photo.findMany({ where: { url: { in: urls } }, select: { id: true } });
  if (!photos.length) return;
  await prisma.photoUsage.createMany({
    data: photos.map((p) => ({ photoId: p.id, articleId })),
    skipDuplicates: true,
  });
}
