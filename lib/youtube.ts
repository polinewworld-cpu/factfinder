import { prisma } from '@/lib/prisma';
import { toFrenchBrackets } from '@/lib/frenchBrackets';
import { preserveTitleBreaks } from '@/lib/titleLineBreak';

// 정치신세계 자동 영상 카드 — 유튜브 채널 @polinewworld의 라이브 방송만 VideoCard로 저장 (기능정의서 4.2.1, 2026-10-08부터 라이브 전용)
// 민트데스크 프로젝트에서 검증된 방식 재사용: forHandle -> 실패 시 search 폴백, 업로드 재생목록(UC->UU)으로 목록 조회.
// 실제 동작에는 YOUTUBE_API_KEY 환경변수가 필요함 (서버사이드 전용 — 클라이언트에 노출 금지).
const CHANNEL_HANDLE = 'polinewworld';
const YT_API = 'https://www.googleapis.com/youtube/v3';

export function isYoutubeConfigured() {
  return !!process.env.YOUTUBE_API_KEY;
}

async function ytFetch(path: string, params: Record<string, string>) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY 환경변수가 설정되어 있지 않습니다');
  const query = new URLSearchParams({ ...params, key: apiKey });
  const res = await fetch(`${YT_API}/${path}?${query.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`YouTube API 호출 실패 (${path}, HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function resolveChannelId(): Promise<string> {
  // 1차: forHandle API
  try {
    const data = await ytFetch('channels', { part: 'id', forHandle: CHANNEL_HANDLE });
    const id = data.items?.[0]?.id;
    if (id) return id;
  } catch {
    /* 폴백으로 진행 */
  }
  // 2차 폴백: search API
  const searchData = await ytFetch('search', {
    part: 'snippet',
    q: `@${CHANNEL_HANDLE}`,
    type: 'channel',
    maxResults: '1',
  });
  const id = searchData.items?.[0]?.snippet?.channelId ?? searchData.items?.[0]?.id?.channelId;
  if (!id) throw new Error(`채널을 찾을 수 없습니다: @${CHANNEL_HANDLE}`);
  return id;
}

function uploadsPlaylistId(channelId: string) {
  // 채널ID(UC...)를 업로드 재생목록ID(UU...)로 치환하는 유튜브 표준 규칙
  return channelId.startsWith('UC') ? `UU${channelId.slice(2)}` : channelId;
}

type SyncResult = { synced: number; skipped: number };

// '항상 최신'을 유지하되 방문마다 유튜브 API를 부르지 않도록 최소 재동기화 간격 (2026-09-11 신설)
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5분
let lastSyncedAt = 0;
let inFlightSync: Promise<SyncResult> | null = null;

// 2026-10-08 규칙 변경(사장님 지시): 정치신세계는 "라이브 방송"만 가져온다 — 진행 중·예정 라이브 + 끝난 라이브 다시보기.
// 쇼츠·일반 업로드 영상은 저장하지 않고, 예전에 저장된 것도 동기화 때 정리(삭제)한다.
// 판별: 유튜브 videos API의 liveStreamingDetails는 라이브로 방송된(될) 영상에만 붙는다.
const isLiveBroadcast = (video: any) => !!video.liveStreamingDetails || ['live', 'upcoming'].includes(video.snippet?.liveBroadcastContent);
const UPLOAD_PAGES = 2; // 최근 업로드 100개(50×2)까지 훑어 라이브를 찾음 — 쇼츠가 많아도 라이브가 묻히지 않게

async function fetchVideoDetails(ids: string[]): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await ytFetch('videos', { part: 'snippet,contentDetails,liveStreamingDetails', id: ids.slice(i, i + 50).join(',') });
    out.push(...(data.items ?? []));
  }
  return out;
}

export async function syncVideoCards(): Promise<SyncResult> {
  lastSyncedAt = Date.now();
  const channelId = await resolveChannelId();
  const playlistId = uploadsPlaylistId(channelId);

  const videoIds: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < UPLOAD_PAGES; page++) {
    const playlistData = await ytFetch('playlistItems', {
      part: 'contentDetails',
      playlistId,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    videoIds.push(...(playlistData.items ?? []).map((item: any) => item.contentDetails?.videoId).filter(Boolean));
    pageToken = playlistData.nextPageToken;
    if (!pageToken) break;
  }

  let synced = 0;
  let skipped = 0;

  if (videoIds.length > 0) {
    const details = await fetchVideoDetails(videoIds);
    const nonLiveIds = details.filter((v) => !isLiveBroadcast(v)).map((v) => v.id);
    if (nonLiveIds.length) await prisma.videoCard.deleteMany({ where: { youtubeId: { in: nonLiveIds } } });

    for (const video of details.filter(isLiveBroadcast)) {
      try {
        const kind = 'LIVE' as const;
        const existing = await prisma.videoCard.findUnique({ where: { youtubeId: video.id } });
        const title = preserveTitleBreaks(existing?.title, toFrenchBrackets(video.snippet.title));
        await prisma.videoCard.upsert({
          where: { youtubeId: video.id },
          update: {
            title,
            thumbnailUrl: video.snippet.thumbnails?.high?.url ?? video.snippet.thumbnails?.default?.url ?? '',
            kind,
            publishedAt: new Date(video.snippet.publishedAt),
          },
          create: {
            youtubeId: video.id,
            title,
            thumbnailUrl: video.snippet.thumbnails?.high?.url ?? video.snippet.thumbnails?.default?.url ?? '',
            kind,
            publishedAt: new Date(video.snippet.publishedAt),
          },
        });
        synced += 1;
      } catch {
        skipped += 1;
      }
    }
  }

  // 진행 중/예정 라이브는 업로드 재생목록에 아직 안 잡힐 수 있어 별도로 확인 (기능정의서 4.2.1 warning 1)
  try {
    const liveData = await ytFetch('search', {
      part: 'snippet',
      channelId,
      eventType: 'live',
      type: 'video',
      maxResults: '5',
    });
    for (const item of liveData.items ?? []) {
      const videoId = item.id?.videoId;
      if (!videoId) continue;
      const existing = await prisma.videoCard.findUnique({ where: { youtubeId: videoId } });
      const title = preserveTitleBreaks(existing?.title, toFrenchBrackets(item.snippet.title));
      await prisma.videoCard.upsert({
        where: { youtubeId: videoId },
        update: {
          title,
          thumbnailUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url ?? '',
          kind: 'LIVE',
          publishedAt: new Date(item.snippet.publishedAt),
        },
        create: {
          youtubeId: videoId,
          title,
          thumbnailUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url ?? '',
          kind: 'LIVE',
          publishedAt: new Date(item.snippet.publishedAt),
        },
      });
      synced += 1;
    }
  } catch {
    /* 라이브 확인 실패는 전체 동기화를 막지 않음 */
  }

  // 규칙 변경 전에 저장된 쇼츠·일반 영상 정리 — 최근 100개 밖의 옛 카드도 유튜브에 라이브 여부를 물어 확인한 뒤 처리
  const legacyCards = await prisma.videoCard.findMany({ where: { kind: { not: 'LIVE' } }, select: { youtubeId: true } });
  if (legacyCards.length) {
    const details = await fetchVideoDetails(legacyCards.map((c) => c.youtubeId));
    const liveIds = details.filter(isLiveBroadcast).map((v) => v.id);
    if (liveIds.length) await prisma.videoCard.updateMany({ where: { youtubeId: { in: liveIds } }, data: { kind: 'LIVE' } });
    await prisma.videoCard.deleteMany({ where: { kind: { not: 'LIVE' } } }); // 남은 것 = 라이브 아님(또는 유튜브에서 삭제된 영상)
  }

  return { synced, skipped };
}

// 방문자가 정치신세계 탭을 열거나 브라우저를 새로고침할 때 호출.
// force면 최소 간격 없이 유튜브에서 다시 가져와, 수동 새로고침 버튼을 대체한다.
// 실패해도 페이지 렌더링을 막지 않도록 항상 조용히 무시한다.
export async function ensureVideoCardsFresh(force = false): Promise<void> {
  if (!isYoutubeConfigured()) return;
  if (!force && Date.now() - lastSyncedAt < MIN_SYNC_INTERVAL_MS) return;
  if (!inFlightSync) {
    inFlightSync = syncVideoCards()
      .catch(() => ({ synced: 0, skipped: 0 }))
      .finally(() => {
        inFlightSync = null;
      });
  }
  await inFlightSync;
}
