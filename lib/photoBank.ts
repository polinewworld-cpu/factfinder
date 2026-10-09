import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { SOURCE_TYPES, isAiSource } from '@/lib/photoBankRules';

// 사진 뱅크 서버 쪽 (2026-10-09) — 통합 검색, 사용 이력 기록, AI 사진 캡션 표시 강제

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
  sort?: 'taken' | 'created' | 'leastUsed';
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
    sort: (sp.get('sort') as PhotoSearch['sort']) || 'created',
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

  return prisma.photo.findMany({ where: and.length ? { AND: and } : {}, include: PHOTO_INCLUDE, orderBy, take });
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

// AI 재구성·AI 생성 사진은 본문 캡션에서 "AI" 표시를 지울 수 없게 — 저장할 때 빠져 있으면 다시 붙임
export async function enforceAiCaptions(html: string) {
  if (!html.includes('<img')) return html;
  const srcs = imageSrcs(html);
  if (!srcs.length) return html;
  const ai = await prisma.photo.findMany({
    where: { url: { in: srcs }, sourceType: { in: ['AI_RECON', 'AI_GEN'] } },
    select: { url: true, sourceType: true },
  });
  if (!ai.length) return html;
  const kind = new Map(ai.map((p) => [p.url, p.sourceType]));
  return html.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, (fig) => {
    const src = fig.match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1];
    const t = src ? kind.get(normalizeUrl(src.replace(/&amp;/g, '&'))) : undefined;
    if (!t || !isAiSource(t)) return fig;
    const label = t === 'AI_GEN' ? 'AI 생성 이미지' : 'AI 재구성 이미지';
    if (/<figcaption\b[^>]*>[\s\S]*AI\s*(재구성|생성)[\s\S]*<\/figcaption>/i.test(fig)) return fig;
    if (/<figcaption\b[^>]*>/i.test(fig)) return fig.replace(/<\/figcaption>/i, ` (${label})</figcaption>`);
    return fig.replace(/<\/figure>/i, `<figcaption>(${label})</figcaption></figure>`);
  });
}
