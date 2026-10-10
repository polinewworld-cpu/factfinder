import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/siteTags';

// 기사 발행 시 SNS 자동 게시 (2026-10-10) — X, 스레드, 인스타그램. 텔레그램·카카오 단톡방은 제외.
// 방식: 발행된 지 3시간 안 된 기사 중 아직 안 올린 것을 찾아 올림(기사 발행 직후 + 10분 핑 때 둘 다 호출, 중복 방지는 기록으로).
// 채널을 켜고 끄는 값과 기사별 게시 기록은 AnalyticsSnapshot 표를 키-값 저장소로 재사용: '0-sp-config', '0-sp-<기사id>'.
// 키(환경변수)가 없는 채널은 켜져 있어도 건너뜀. 처음엔 모두 꺼져 있고 /admin/social 에서 켠다.

export type Channel = 'x' | 'threads' | 'instagram';
export const CHANNELS: { key: Channel; label: string; env: string[] }[] = [
  { key: 'x', label: 'X (트위터)', env: ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'] },
  { key: 'threads', label: '스레드', env: ['THREADS_USER_ID', 'THREADS_ACCESS_TOKEN'] },
  { key: 'instagram', label: '인스타그램', env: ['IG_USER_ID', 'IG_ACCESS_TOKEN'] },
];

const CONFIG_ID = '0-sp-config';
const WINDOW_MS = 3 * 3600_000; // 발행 후 3시간 안의 기사만 올림 — 켜자마자 옛 기사가 쏟아지지 않게
const MAX_TRIES = 3;

export type SocialConfig = Record<Channel, boolean>;
type Result = { ok: boolean; id?: string; error?: string; tries: number };
type Record_ = Partial<Record<Channel, Result>>;

export const channelReady = (c: Channel) => !!CHANNELS.find((x) => x.key === c)?.env.every((k) => process.env[k]);

export async function getSocialConfig(): Promise<SocialConfig> {
  const row = await prisma.analyticsSnapshot.findUnique({ where: { id: CONFIG_ID } });
  const d = (row?.data ?? {}) as Partial<SocialConfig>;
  return { x: !!d.x, threads: !!d.threads, instagram: !!d.instagram };
}

export async function setSocialConfig(cfg: SocialConfig) {
  await prisma.analyticsSnapshot.upsert({
    where: { id: CONFIG_ID },
    update: { data: cfg as any, createdAt: new Date() },
    create: { id: CONFIG_ID, data: cfg as any },
  });
}

// ── 글 만들기 ──
const plain = (html: string) =>
  html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();

// X는 한글 한 글자를 2로 세고 주소는 23으로 셈(한도 280)
const xWeight = (s: string) => Array.from(s).reduce((n, ch) => n + (ch.charCodeAt(0) > 0x10ff ? 2 : 1), 0);
function clip(s: string, max: number, weight = (t: string) => t.length) {
  if (weight(s) <= max) return s;
  let out = s;
  while (out.length && weight(out + '…') > max) out = out.slice(0, -1);
  return out.trimEnd() + '…';
}

type Art = { id: string; title: string; excerpt: string | null; content: string; coverImageUrl: string | null };
const articleUrl = (a: Art) => `${SITE_URL}/article/${a.id}`;
const summary = (a: Art) => (a.excerpt?.trim() || plain(a.content).slice(0, 200)).trim();

function xText(a: Art) {
  const head = clip(a.title.trim(), 120, xWeight);
  const room = 280 - 23 - 4 - xWeight(head) - 4; // 주소(23) + 줄바꿈 여유
  const sum = room > 30 ? clip(summary(a), room, xWeight) : '';
  return `${head}${sum ? `\n\n${sum}` : ''}\n\n${articleUrl(a)}`;
}
const threadsText = (a: Art) => `${a.title.trim()}\n\n${clip(summary(a), 300)}`.slice(0, 480); // 주소는 link_attachment로 따로 붙임
const instaCaption = (a: Art) => `${a.title.trim()}\n\n${clip(summary(a), 600)}\n\n전문은 프로필 링크의 팩트파인더에서 읽어보세요.`.slice(0, 2000);

function imageUrl(a: Art) {
  const u = a.coverImageUrl;
  if (!u) return null;
  if (u.startsWith('/api/blob/')) return `${SITE_URL}${u}${u.includes('?') ? '&' : '?'}w=1080&f=jpg`; // 인스타는 JPEG만
  return /^https?:/i.test(u) ? u : `${SITE_URL}${u}`;
}

// ── 채널별 전송 ──
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

async function postX(a: Art): Promise<string> {
  const url = 'https://api.twitter.com/2/tweets';
  const oauth: Record<string, string> = {
    oauth_consumer_key: process.env.X_API_KEY!,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: process.env.X_ACCESS_TOKEN!,
    oauth_version: '1.0',
  };
  const base = ['POST', enc(url), enc(Object.keys(oauth).sort().map((k) => `${enc(k)}=${enc(oauth[k])}`).join('&'))].join('&');
  oauth.oauth_signature = crypto.createHmac('sha1', `${enc(process.env.X_API_SECRET!)}&${enc(process.env.X_ACCESS_SECRET!)}`).update(base).digest('base64');
  const auth = 'OAuth ' + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
  const res = await fetch(url, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: xText(a) }) });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`X ${res.status} ${j?.detail || j?.title || ''}`.trim());
  return String(j?.data?.id ?? '');
}

async function graph(url: string, params: Record<string, string>) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || j?.error) throw new Error(`${res.status} ${j?.error?.message || ''}`.trim());
  return j;
}

async function postThreads(a: Art): Promise<string> {
  const uid = process.env.THREADS_USER_ID!;
  const token = process.env.THREADS_ACCESS_TOKEN!;
  const c = await graph(`https://graph.threads.net/v1.0/${uid}/threads`, { media_type: 'TEXT', text: threadsText(a), link_attachment: articleUrl(a), access_token: token });
  const p = await graph(`https://graph.threads.net/v1.0/${uid}/threads_publish`, { creation_id: c.id, access_token: token });
  return String(p.id ?? '');
}

async function postInstagram(a: Art): Promise<string> {
  const img = imageUrl(a);
  if (!img) throw new Error('대표 사진이 없어 인스타에는 올리지 않음');
  const uid = process.env.IG_USER_ID!;
  const token = process.env.IG_ACCESS_TOKEN!;
  const c = await graph(`https://graph.facebook.com/v21.0/${uid}/media`, { image_url: img, caption: instaCaption(a), access_token: token });
  await new Promise((r) => setTimeout(r, 4000)); // 인스타가 사진을 받아 처리할 시간
  const p = await graph(`https://graph.facebook.com/v21.0/${uid}/media_publish`, { creation_id: c.id, access_token: token });
  return String(p.id ?? '');
}

const SENDERS: Record<Channel, (a: Art) => Promise<string>> = { x: postX, threads: postThreads, instagram: postInstagram };

// ── 올릴 기사 찾아 올리기 ──
let running = false;

export async function postNewArticlesToSocial() {
  if (running) return;
  running = true;
  try {
    const cfg = await getSocialConfig();
    const active = CHANNELS.filter((c) => cfg[c.key] && channelReady(c.key));
    if (!active.length) return;
    const arts = await prisma.article.findMany({
      where: { status: 'PUBLISHED', publishedAt: { gte: new Date(Date.now() - WINDOW_MS) } },
      select: { id: true, title: true, excerpt: true, content: true, coverImageUrl: true },
      orderBy: { publishedAt: 'asc' },
    });
    for (const a of arts) {
      const id = `0-sp-${a.id}`;
      const row = await prisma.analyticsSnapshot.findUnique({ where: { id } });
      const rec: Record_ = ((row?.data as any) ?? {}) as Record_;
      let changed = false;
      for (const ch of active) {
        const prev = rec[ch.key];
        if (prev?.ok || (prev?.tries ?? 0) >= MAX_TRIES) continue;
        try {
          const postId = await SENDERS[ch.key](a);
          rec[ch.key] = { ok: true, id: postId, tries: (prev?.tries ?? 0) + 1 };
        } catch (e) {
          rec[ch.key] = { ok: false, error: e instanceof Error ? e.message : '게시 실패', tries: (prev?.tries ?? 0) + 1 };
        }
        changed = true;
      }
      if (changed) {
        await prisma.analyticsSnapshot.upsert({ where: { id }, update: { data: rec as any, createdAt: new Date() }, create: { id, data: rec as any } });
      }
    }
  } finally {
    running = false;
  }
}

// 관리 화면용 — 최근 게시 기록
export async function recentSocialLog(limit = 15) {
  const rows = await prisma.analyticsSnapshot.findMany({ where: { id: { startsWith: '0-sp-', not: CONFIG_ID } }, orderBy: { createdAt: 'desc' }, take: limit });
  const ids = rows.map((r) => r.id.slice(5));
  const arts = await prisma.article.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
  const titles = new Map(arts.map((a) => [a.id, a.title]));
  return rows.map((r) => ({ articleId: r.id.slice(5), title: titles.get(r.id.slice(5)) ?? '(삭제된 기사)', result: r.data as unknown as Record_, at: r.createdAt }));
}

// 유튜브 커뮤니티 게시물은 공식 API가 없어 자동 게시가 안 됨 → 관리자 화면에서 복사해 붙여 넣게 문구·사진을 준비해 둠 (2026-10-10)
export async function recentYoutubeKits(limit = 10) {
  const arts = await prisma.article.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true, title: true, excerpt: true, content: true, coverImageUrl: true, publishedAt: true },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
  return arts.map((a) => ({
    id: a.id,
    title: a.title,
    publishedAt: a.publishedAt,
    text: `${a.title.trim()}\n\n${clip(summary(a), 300)}\n\n${articleUrl(a)}`,
    image: imageUrl(a),
  }));
}

// 시험 게시 — 연결이 되는지 확인용(편집장이 버튼을 눌렀을 때만). 올라간 글은 직접 지우면 됨
export async function testPost(ch: Channel): Promise<string> {
  if (!channelReady(ch)) throw new Error('아직 연결되지 않았습니다');
  const a: Art = { id: '', title: '[시험] 팩트파인더 자동 게시 연결 확인', excerpt: '이 글은 연결 시험용입니다. 곧 지워집니다.', content: '', coverImageUrl: null };
  if (ch === 'x') return postX({ ...a, id: 'test' });
  if (ch === 'threads') return postThreads({ ...a, id: 'test' });
  throw new Error('인스타그램은 사진이 필요해 시험 게시를 지원하지 않습니다');
}
