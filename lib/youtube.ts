import { prisma } from '@/lib/prisma';

// 정치신세계 자동 영상 카드 — 유튜브 채널 @polinewworld에서 쇼츠/영상/라이브를 가져와 VideoCard로 저장 (기능정의서 4.2.1)
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

export async function syncVideoCards(): Promise<SyncResult> {
  lastSyncedAt = Date.now();
  const channelId = await resolveChannelId();
  const playlistId = uploadsPlaylistId(channelId);

  const playlistData = await ytFetch('playlistItems', {
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: '20',
  });

  const videoIds: string[] = (playlistData.items ?? [])
    .map((item: any) => item.contentDetails?.videoId)
    .filter(Boolean);

  let synced = 0;
  let skipped = 0;

  if (videoIds.length > 0) {
    const detailsData = await ytFetch('videos', {
      part: 'snippet,contentDetails,liveStreamingDetails',
      id: videoIds.join(','),
    });

    for (const video of detailsData.items ?? []) {
      try {
        const kind = classifyVideo(video);
        await prisma.videoCard.upsert({
          where: { youtubeId: video.id },
          update: {
            title: video.snippet.title,
            thumbnailUrl: video.snippet.thumbnails?.high?.url ?? video.snippet.thumbnails?.default?.url ?? '',
            kind,
            publishedAt: new Date(video.snippet.publishedAt),
          },
          create: {
            youtubeId: video.id,
            title: video.snippet.title,
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
      await prisma.videoCard.upsert({
        where: { youtubeId: videoId },
        update: {
          title: item.snippet.title,
          thumbnailUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url ?? '',
          kind: 'LIVE',
          publishedAt: new Date(item.snippet.publishedAt),
        },
        create: {
          youtubeId: videoId,
          title: item.snippet.title,
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

  return { synced, skipped };
}

// 방문자가 정치신세계 탭을 열 때마다 호출 — 마지막 동기화 후 MIN_SYNC_INTERVAL_MS가 지났으면
// 자동으로 백그라운드 재동기화하여 편집장의 수동 새로고침 없이도 '항상' 최신 상태를 유지한다.
// 실패해도 페이지 렌더링을 막지 않도록 항상 조용히 무시한다.
export async function ensureVideoCardsFresh(): Promise<void> {
  if (!isYoutubeConfigured()) return;
  if (Date.now() - lastSyncedAt < MIN_SYNC_INTERVAL_MS) return;
  if (!inFlightSync) {
    inFlightSync = syncVideoCards()
      .catch(() => ({ synced: 0, skipped: 0 }))
      .finally(() => {
        inFlightSync = null;
      });
  }
  await inFlightSync;
}

function classifyVideo(video: any): 'SHORT' | 'VIDEO' | 'LIVE' {
  const liveStatus = video.snippet?.liveBroadcastContent;
  if (liveStatus === 'live' || liveStatus === 'upcoming') return 'LIVE';

  // 쇼츠 판별은 유튜브 API가 직접 알려주지 않아 재생시간으로 추정 — 알려진 업계 관행상의 근사치.
  // 2024년 10월부터 유튜브 쇼츠 최대 길이가 60초 -> 3분(180초)으로 늘어남 — 기준도 맞춰서 조정 (2026-09-22)
  const duration = video.contentDetails?.duration as string | undefined; // ISO 8601, 예: PT45S
  if (duration) {
    const match = duration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
    const minutes = match?.[1] ? parseInt(match[1], 10) : 0;
    const seconds = match?.[2] ? parseInt(match[2], 10) : 0;
    const totalSeconds = minutes * 60 + seconds;
    if (totalSeconds > 0 && totalSeconds <= 180) return 'SHORT';
  }
  return 'VIDEO';
}
