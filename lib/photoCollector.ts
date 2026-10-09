import { prisma } from '@/lib/prisma';
import { searchNaver } from '@/lib/externalPhotos';
import { fetchRemoteImage, storeRemoteImage } from '@/lib/remoteImage';
import { minjooPhotos, reformPhotos } from '@/lib/partySources';

// 사진 뱅크 자동 수집기 (2026-10-09, 3단계) — 네이버 뉴스에서 "등록 인물 이름 + 제공"을 찾아
// 캡션에 의원실·정당·정부기관 "제공"이 있고 등록 인물 이름(별칭)이 나오는 사진만 수신함으로 넣는다(바로 등록하지 않음).
// 주기: SiteConfig.photoCollectMinutes(기본 60분, 0=끔) — 10분마다 오는 /api/health 핑이 때가 되면 돌린다.
// 한 번에 인물 PER_RUN명씩 돌아가며(오래 안 찾아본 순) — 네이버에 요청이 몰리지 않게.
// 정당 홈페이지·부처 사이트 수집은 사이트별로 따로 붙일 예정(구조가 제각각, 일부는 자바스크립트로만 그려짐).
const PER_RUN = 5;
const SEARCH_PAGES = [1, 11];

let running: Promise<CollectResult> | null = null;
export type CollectResult = { people: string[]; found: number; added: number; skipped: number; party?: number; error?: string };

function namesOf(p: { name: string; aliases: string | null }) {
  return [p.name, ...(p.aliases ?? '').split(',').map((a) => a.trim())].filter((n) => n.length >= 2);
}

async function collect(): Promise<CollectResult> {
  const all = await prisma.person.findMany({ select: { id: true, name: true, aliases: true, lastCollectedAt: true } });
  const batch = all
    .sort((a, b) => (a.lastCollectedAt?.getTime() ?? 0) - (b.lastCollectedAt?.getTime() ?? 0))
    .slice(0, PER_RUN);
  const out: CollectResult = { people: batch.map((p) => p.name), found: 0, added: 0, skipped: 0 };

  for (const person of batch) {
    const items = await searchNaver(person.name, SEARCH_PAGES).catch(() => []);
    for (const it of items) {
      // 사진 설명에 등록 인물 이름이 있는 것만 — 이 인물뿐 아니라 함께 나온 다른 등록 인물도 태그 후보로
      const matched = all.filter((p) => namesOf(p).some((n) => it.caption.includes(n)));
      if (!matched.length) continue;
      out.found++;
      // 중복 제거 ① 같은 이미지 주소 ② 같은 이미지 내용(해시) — 수신함·사진 뱅크 둘 다
      const dupUrl = await prisma.photoInbox.findUnique({ where: { imageUrl: it.image }, select: { id: true } });
      if (dupUrl || (await prisma.photo.findFirst({ where: { sourceUrl: it.image }, select: { id: true } }))) {
        out.skipped++;
        continue;
      }
      const img = await fetchRemoteImage(it.image).catch(() => null);
      if (!img) {
        out.skipped++;
        continue;
      }
      const dupHash =
        (await prisma.photoInbox.findUnique({ where: { hash: img.hash }, select: { id: true } })) ||
        (await prisma.photo.findUnique({ where: { hash: img.hash }, select: { id: true } }));
      if (dupHash) {
        out.skipped++;
        continue;
      }
      await prisma.photoInbox
        .create({
          data: {
            origin: 'naver',
            imageUrl: it.image,
            thumbUrl: it.thumb,
            pageUrl: it.pageUrl,
            viaArticleUrl: it.viaArticleUrl,
            title: it.title || null,
            caption: it.caption || null,
            provider: it.author,
            sourceType: it.sourceType,
            license: it.license || null,
            credit: it.credit,
            takenAt: it.takenAt ? new Date(`${it.takenAt}T12:00:00+09:00`) : null,
            peopleIds: matched.map((p) => p.id).join(','),
            hash: img.hash,
          },
        })
        .then(() => out.added++)
        .catch(() => out.skipped++); // 동시에 같은 사진이 들어온 경우(유니크 충돌)
    }
    await prisma.person.update({ where: { id: person.id }, data: { lastCollectedAt: new Date() } });
  }

  // 정당 홈페이지 사진 게시판(민주당 포토갤러리·개혁신당 사진자료) — 정당이 직접 배포한 사진이라
  // 등록 인물 이름이 없어도 수신함에 넣고, 이름이 맞는 등록 인물만 자동 태그 (2026-10-09: 등록 인물이 적어 이름 조건이면 0장)
  out.party = 0;
  for (const load of [minjooPhotos, () => reformPhotos()]) {
    const list = await load().catch(() => []);
    for (const it of list) {
      out.found++;
      const dup =
        (await prisma.photoInbox.findUnique({ where: { imageUrl: it.image }, select: { id: true } })) ||
        (await prisma.photo.findFirst({ where: { sourceUrl: it.image }, select: { id: true } }));
      if (dup) {
        out.skipped++;
        continue;
      }
      const text = `${it.caption} ${it.title}`;
      const matched = all.filter((p) => namesOf(p).some((n) => text.includes(n)));
      await prisma.photoInbox
        .create({
          data: {
            origin: it.origin,
            imageUrl: it.image,
            thumbUrl: it.thumb,
            pageUrl: it.pageUrl,
            title: it.title || null,
            caption: it.caption || null,
            provider: it.provider,
            sourceType: it.sourceType,
            credit: it.credit,
            takenAt: it.takenAt ? new Date(`${it.takenAt}T12:00:00+09:00`) : null,
            peopleIds: matched.map((p) => p.id).join(',') || null,
          },
        })
        .then(() => {
          out.added++;
          out.party!++;
        })
        .catch(() => out.skipped++);
    }
  }
  return out;
}

export function runCollector(): Promise<CollectResult> {
  if (!running) {
    running = (async () => {
      await prisma.siteConfig.upsert({ where: { id: 'singleton' }, update: { photoCollectAt: new Date() }, create: { id: 'singleton', photoCollectAt: new Date() } });
      try {
        return await collect();
      } catch (e) {
        return { people: [], found: 0, added: 0, skipped: 0, error: e instanceof Error ? e.message : '수집 실패' };
      }
    })().finally(() => {
      running = null;
    });
  }
  return running;
}

// /api/health(10분 핑)에서 — 주기가 됐으면 백그라운드로 한 번
export function ensurePhotoCollect() {
  if (running) return;
  prisma.siteConfig
    .findUnique({ where: { id: 'singleton' }, select: { photoCollectMinutes: true, photoCollectAt: true } })
    .then((c) => {
      const minutes = c?.photoCollectMinutes ?? 60;
      if (minutes <= 0) return null;
      const last = c?.photoCollectAt?.getTime() ?? 0;
      if (Date.now() - last < minutes * 60_000 - 2 * 60_000) return null;
      return runCollector();
    })
    .catch(() => {});
}

// 수신함 승인 — 파일을 우리 저장소로 복사하고 사진 뱅크에 등록
export async function approveInboxItem(id: string, userId: string, override?: { peopleIds?: string[]; tagNames?: string[]; title?: string; credit?: string; sourceType?: string; license?: string }) {
  const it = await prisma.photoInbox.findUnique({ where: { id } });
  if (!it || it.status !== 'PENDING') throw new Error('이미 처리된 항목입니다');
  const stored = await storeRemoteImage(it.imageUrl);
  if (await prisma.photo.findUnique({ where: { hash: stored.hash }, select: { id: true } })) {
    await prisma.photoInbox.update({ where: { id }, data: { status: 'REJECTED', decidedAt: new Date() } });
    throw new Error('이미 사진 뱅크에 있는 사진이라 반려 처리했습니다');
  }
  const peopleIds = override?.peopleIds ?? (it.peopleIds ? it.peopleIds.split(',').filter(Boolean) : []);
  const tagNames = override?.tagNames ?? [];
  const photo = await prisma.photo.create({
    data: {
      url: stored.url,
      filename: stored.filename,
      title: override?.title ?? it.caption,
      uploaderId: userId,
      sourceType: (override?.sourceType as any) ?? it.sourceType,
      license: override?.license ?? it.license,
      sourceUrl: it.imageUrl,
      viaArticleUrl: it.viaArticleUrl,
      takenAt: it.takenAt,
      photographer: it.provider,
      credit: override?.credit ?? it.credit,
      hash: stored.hash,
      people: { connect: peopleIds.map((pid) => ({ id: pid })) },
      tags: { connect: tagNames.map((name) => ({ name })) },
    },
  });
  await prisma.photoInbox.update({ where: { id }, data: { status: 'APPROVED', decidedAt: new Date(), photoId: photo.id } });
  return photo;
}
