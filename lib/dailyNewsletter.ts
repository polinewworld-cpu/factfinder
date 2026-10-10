import { prisma } from '@/lib/prisma';
import { generateText, geminiReady } from '@/lib/gemini';
import { esc, buildNewsletterHtml, kstDate, pickArticles, selectedArticles } from '@/lib/newsletter';
import { stripMarkers } from '@/lib/linkMarkup';
import { pastOhLetters } from '@/lib/analyticsSnapshot';
import { recentForeignReports } from '@/lib/foreignNews';
import { getPersonaAvatar } from '@/lib/persona';
import { SITE_URL } from '@/lib/siteTags';

// 팩트파인더 아침 브리핑(일간) — 2026-10-10 기획: 정치신세계 어제 방송(보통 2회)을 다음 날 아침에 간단히 정리해 보내고,
// 어제 기사가 있으면 기사를, 없으면 오진실 기자·김정신 특파원의 가장 마지막 브리핑을 독자 '정신줄님' 호칭으로 바꿔 싣는다.
// 두 기자의 글(프로필 사진 포함)이 맨 앞, 그다음 정치신세계 방송, 그다음 어제 기사.
// 규칙: 평일만 발송 · 어제 방송이 없으면 건너뜀. 메일은 "초안"(DailyDraft)으로 먼저 만들어 관리자가 문장을 고친 뒤 보낸다.
// (아직 구독자 자동 발송은 연결하지 않음 — 편집장 본인에게만 테스트 발송)
const DAY = 86400_000;

function prevWeekdayKey(key: string) {
  let t = new Date(`${key}T00:00:00Z`);
  do {
    t = new Date(t.getTime() - DAY);
  } while (t.getUTCDay() === 0 || t.getUTCDay() === 6);
  return t.toISOString().slice(0, 10);
}

// 어제 8시 ~ 오늘 8시(월요일은 지난 금요일 8시부터 — 금요일·주말 방송까지)
export function dailyWindow(dateKey: string) {
  return { start: new Date(`${prevWeekdayKey(dateKey)}T08:00:00+09:00`), end: new Date(`${dateKey}T08:00:00+09:00`) };
}

export function dailyLabel(dateKey: string) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()]})`;
}

// "오후 3:23" — 서버 ICU 설정에 따라 영어("PM 3:23")로 나오는 일이 있어 직접 만든다
function kstClock(d: Date) {
  const k = new Date(d.getTime() + 9 * 3600_000);
  const h = k.getUTCHours();
  return `${h < 12 ? '오전' : '오후'} ${((h + 11) % 12) + 1}:${String(k.getUTCMinutes()).padStart(2, '0')}`;
}

// ── 초안 모양 ────────────────────────────────────────
export type PersonaDraft = { intro: string; lines: string[]; closing: string };
export type CastDraft = { youtubeId: string; title: string; thumbnailUrl: string; time: string; bullets: string[]; source: 'video' | 'description' | 'none'; include: boolean };
export type DailyDraft = {
  dateKey: string;
  createdAt: string;
  greeting: string;
  full: boolean; // 기자 브리핑 전체(lines·closing)를 싣는지 — 어제 기사가 없을 때만 true, false면 인사(intro)만
  oh: PersonaDraft | null;
  kim: PersonaDraft | null;
  casts: CastDraft[];
  articleIds: string[];
};
// 글 속 링크는 마크다운 형식 [구절](https://…)로 보관 — 관리자가 문장을 고칠 때도 읽기 쉽다.

const draftId = (dateKey: string) => `0-dd-${dateKey}`;
export async function loadDraft(dateKey: string): Promise<DailyDraft | null> {
  const row = await prisma.analyticsSnapshot.findUnique({ where: { id: draftId(dateKey) } });
  return row ? (row.data as unknown as DailyDraft) : null;
}
export async function saveDraft(draft: DailyDraft) {
  await prisma.analyticsSnapshot.upsert({ where: { id: draftId(draft.dateKey) }, update: { data: draft as any, createdAt: new Date() }, create: { id: draftId(draft.dateKey), data: draft as any } });
}

// ── 방송 요약 ────────────────────────────────────────
type Summary = { bullets: string[]; source: 'video' | 'description' | 'none' };

function parseBullets(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-•*·▪]|\d+[.)])\s*/, '').replace(/\*\*/g, '').trim())
    .filter((l) => l.length >= 8)
    .map((l) => l.slice(0, 140))
    .slice(0, 6);
}

const BOILERPLATE_RULE = '채널 소개·구독/좋아요 안내·후원 안내·"팩트파인더는 ~를 지향한다" 같은 매체 소개 문구는 방송 내용이 아니니 요약에서 반드시 제외하세요.';

// A) 제미나이가 유튜브 주소를 직접 보고 요약 — 길이·사용량 제한으로 실패할 수 있어 실패하면 빈 배열
async function summarizeByVideo(id: string, title: string): Promise<string[]> {
  if (!geminiReady()) return [];
  const model = process.env.GEMINI_VIDEO_MODEL || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const prompt = `이 영상은 정치 시사 방송 "정치신세계"의 방송입니다(제목: ${title}).
방송에서 실제로 나온 핵심 내용을 한국어로 3~5줄 요약하세요. 한 줄은 한 문장, 줄 앞에 "- "를 붙입니다.
규칙: 영상에서 확인되지 않은 내용은 쓰지 마세요. 출연자 이름이 불확실하면 쓰지 마세요. ${BOILERPLATE_RULE} 설명·머리말 없이 줄만 출력하세요.`;
  for (const cfg of [{ mediaResolution: 'MEDIA_RESOLUTION_LOW' }, {}]) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ fileData: { fileUri: `https://www.youtube.com/watch?v=${id}` } }, { text: prompt }] }],
        generationConfig: { temperature: 0.2, ...cfg },
      }),
      signal: AbortSignal.timeout(240_000),
    }).catch(() => null);
    if (!res) return [];
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = (body.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
      return parseBullets(text);
    }
    if (res.status !== 400) return []; // 400이면 화질 옵션을 빼고 한 번 더
  }
  return [];
}

// B) 방송 설명란 기반 — 가볍지만 내용이 얕음
async function summarizeByDescription(id: string, title: string): Promise<string[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${key}`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  const desc: string = (await res?.json().catch(() => null))?.items?.[0]?.snippet?.description ?? '';
  const clean = desc.replace(/https?:\/\/\S+/g, '').replace(/\s+\n/g, '\n').trim();
  if (clean.length < 40 || !geminiReady()) return [];
  try {
    const t = await generateText(
      `정치 시사 방송 "정치신세계"의 제목과 설명란입니다. 이 방송에서 다룬 **구체적인 주제**만 한국어 2~4줄로 요약하세요. 줄 앞에 "- ", 한 줄은 한 문장. 적혀 있지 않은 내용은 쓰지 마세요. ${BOILERPLATE_RULE} 방송 주제가 설명란에서 확인되지 않으면 제목 내용만 한 줄로 쓰세요.\n제목: ${title}\n설명란:\n${clean.slice(0, 3000)}`,
      { temperature: 0.2 }
    );
    return parseBullets(t);
  } catch {
    return [];
  }
}

async function summarize(id: string, title: string): Promise<Summary> {
  const cacheId = `0-bs-${id}`; // 같은 방송을 두 번 요약하지 않게 저장 (id '0-'은 방문 분석 최신 보고서 조회에 섞이지 않음)
  const cached = await prisma.analyticsSnapshot.findUnique({ where: { id: cacheId } }).catch(() => null);
  if (cached) return cached.data as unknown as Summary;
  let bullets = await summarizeByVideo(id, title);
  let source: Summary['source'] = 'video';
  if (!bullets.length) {
    bullets = await summarizeByDescription(id, title);
    source = bullets.length ? 'description' : 'none';
  }
  const out: Summary = { bullets, source };
  if (bullets.length) await prisma.analyticsSnapshot.upsert({ where: { id: cacheId }, update: { data: out as any }, create: { id: cacheId, data: out as any } }).catch(() => {});
  return out;
}

// ── 기자 브리핑을 독자(정신줄님)용 초안으로 ───────────────
const toReader = (t: string) => t.replace(/편집장님[,과와\s]*(?:선배 기자님들|선배님들|선배님)/g, '정신줄님').replace(/(선배 기자님들|선배님들|선배님|편집장님)/g, '정신줄님');
const MARK_URL = /\[\[([^\]|]+)\|(https?:\/\/[^\]\s]+)\]\]/g;
// [[구절|주소]] → [구절](주소), 형식이 깨진 표시는 글자만 남김
const toMd = (t: string) => stripMarkers((t ?? '').replace(MARK_URL, '[$1]($2)'));

async function personaDrafts(full: boolean): Promise<{ oh: PersonaDraft | null; kim: PersonaDraft | null }> {
  const oh = (await pastOhLetters(1).catch(() => []))[0]?.ai;
  const kim = (await recentForeignReports(1).catch(() => []))[0];
  if (!oh && !kim) return { oh: null, kim: null };

  const input = {
    oh: oh ? { opening: oh.opening ?? '', lines: [...(oh.chatter ?? []), ...(oh.outletComparison ?? [])], closing: oh.closing ?? '' } : null,
    kim: kim ? { intro: kim.localColor ?? '', issues: kim.overviewItems ?? [], briefs: (kim.briefs ?? []).slice(0, 6).map((b, i) => ({ i, text: b.text })), closing: kim.closing ?? '' } : null,
  };

  // 편집국 내부용 호칭(편집장님·선배님)을 독자 "정신줄님"으로 — 제미나이가 호칭만 고치고, 실패하면 단순 치환
  let out = input;
  if (geminiReady()) {
    try {
      const t = await generateText(
        `아래는 팩트파인더 편집국 내부용으로 쓴 오진실 기자·김정신 특파원의 아침 브리핑(JSON)입니다. 이걸 **독자 "정신줄님"에게 보내는 뉴스레터용**으로 호칭과 말투만 고쳐 주세요.
규칙: "편집장님", "선배님(들)", "선배 기자님들" 같은 호칭은 모두 "정신줄님"(여럿이면 "정신줄님들")으로 바꿉니다. 사실·숫자·기사 내용은 바꾸거나 더하지 마세요. 글 속 [[구절|주소]] 표시는 **한 글자도 바꾸지 말고 그대로** 두세요. 기자에게 쓰라고 시키는 내부 지시 투의 문장이 있으면 독자에게 건네는 말로 자연스럽게 바꾸거나 빼세요. 귀엽고 따뜻한 수다 말투는 유지합니다. 입력과 같은 JSON 구조로만 출력하세요(설명·코드블록 금지).
${JSON.stringify(input)}`,
        { temperature: 0.3 }
      );
      const s = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
      out = {
        oh: input.oh ? { ...input.oh, ...(parsed.oh ?? {}) } : null,
        kim: input.kim ? { ...input.kim, ...(parsed.kim ?? {}), briefs: input.kim.briefs.map((b) => ({ ...b, text: String(parsed.kim?.briefs?.find((x: any) => x.i === b.i)?.text ?? b.text) })) } : null,
      };
    } catch {
      out = {
        oh: input.oh && { opening: toReader(input.oh.opening), lines: input.oh.lines.map(toReader), closing: toReader(input.oh.closing) },
        kim: input.kim && { intro: toReader(input.kim.intro), issues: input.kim.issues.map(toReader), briefs: input.kim.briefs.map((b) => ({ ...b, text: toReader(b.text) })), closing: toReader(input.kim.closing) },
      };
    }
  }

  const ohDraft: PersonaDraft | null = out.oh ? { intro: toMd(out.oh.opening), lines: full ? (out.oh.lines as string[]).map(toMd).filter(Boolean) : [], closing: full ? toMd(out.oh.closing) : '' } : null;
  const kimDraft: PersonaDraft | null = out.kim
    ? {
        intro: toMd(out.kim.intro),
        lines: full
          ? [
              ...(out.kim.issues as string[]).map(toMd),
              ...out.kim.briefs.map((b) => {
                const src = kim?.briefs?.[b.i];
                return src ? `${stripMarkers(b.text)} [${src.outlet}](${src.url})` : '';
              }),
            ].filter(Boolean)
          : [],
        closing: full ? toMd(out.kim.closing) : '',
      }
    : null;
  return { oh: ohDraft, kim: kimDraft };
}

// ── 초안 만들기 ───────────────────────────────────────
export type DailyResultInfo = { broadcasts: number; summarySources: string[]; articles: number; usedPersonas: boolean };
export async function buildDailyDraft(dateKey = kstDate()): Promise<{ skip?: string; draft?: DailyDraft; info: DailyResultInfo }> {
  const { start, end } = dailyWindow(dateKey);
  const casts = await prisma.videoCard.findMany({ where: { kind: 'LIVE', publishedAt: { gte: start, lt: end } }, orderBy: { publishedAt: 'asc' }, take: 4 });
  const empty = { broadcasts: 0, summarySources: [] as string[], articles: 0, usedPersonas: false };
  if (!casts.length) return { skip: '어제 정치신세계 방송이 없어 건너뜁니다', info: empty };

  const castDrafts: CastDraft[] = [];
  for (const c of casts) {
    const s = await summarize(c.youtubeId, c.title); // 한 편씩(긴 영상이라 동시에 돌리지 않음)
    castDrafts.push({ youtubeId: c.youtubeId, title: c.title, thumbnailUrl: c.thumbnailUrl, time: kstClock(c.publishedAt), bullets: s.bullets, source: s.source, include: true });
  }
  const articleIds = await pickArticles(start, end, 5);
  const full = !articleIds.length;
  const { oh, kim } = await personaDrafts(full);

  const draft: DailyDraft = {
    dateKey,
    createdAt: new Date().toISOString(),
    greeting: '정신줄님, 좋은 아침입니다. 팩트파인더입니다.\n어제 정치신세계 방송과 소식을 정리해 드립니다.',
    full,
    oh,
    kim,
    casts: castDrafts,
    articleIds,
  };
  await saveDraft(draft);
  return { draft, info: { broadcasts: castDrafts.length, summarySources: castDrafts.map((c) => c.source), articles: articleIds.length, usedPersonas: !!(oh || kim) } };
}

// ── 초안 → 메일 HTML ──────────────────────────────────
const A_STYLE = 'color:#0d4f55;font-weight:600;text-decoration:underline;';
const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
// 글자는 이스케이프, [구절](주소)만 링크로
function mdHtml(text: string) {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(MD_LINK)) {
    const i = m.index ?? 0;
    out += esc(text.slice(last, i)) + `<a href="${esc(m[2])}" style="${A_STYLE}">${esc(m[1])}</a>`;
    last = i + m[0].length;
  }
  return (out + esc(text.slice(last))).replace(/\n/g, '<br>');
}

const mailAvatar = (url: string | null) => (url ? `${SITE_URL}${url.startsWith('/api/blob/') ? `${url}?w=800&f=jpg` : url}` : null);

function personaBlock(name: string, avatar: string | null, p: PersonaDraft, full: boolean) {
  const para = (t: string) => (t.trim() ? `<p style="margin:0 0 8px;color:#333;font-size:14px;line-height:1.75;">${mdHtml(t)}</p>` : '');
  const bullet = (t: string) => `<p style="margin:0 0 6px;color:#333;font-size:14px;line-height:1.7;">· ${mdHtml(t)}</p>`;
  const photo = avatar
    ? `<td style="width:68px;vertical-align:middle;padding:0 12px 0 0;"><div style="width:56px;height:56px;border-radius:50%;overflow:hidden;background:#eee;"><img src="${esc(avatar)}" alt="${esc(name)}" width="56" style="display:block;width:56px;height:auto;border:0;"></div></td>`
    : '';
  return `<div style="margin:26px 0 0;">
    <table role="presentation" style="border-collapse:collapse;margin:0 0 10px;"><tr>${photo}<td style="vertical-align:middle;">
      <div style="font-size:16px;font-weight:800;color:#111;">${esc(name)}</div>
      <div style="font-size:13px;font-weight:700;color:#555;margin-top:2px;">정신줄님, ${esc(name.includes('특파원') ? '김정신 특파원' : '오진실 기자')}입니다.</div>
    </td></tr></table>
    ${para(p.intro)}${full ? p.lines.map(bullet).join('') + para(p.closing) : ''}
  </div>`;
}

export async function renderDailyDraft(draft: DailyDraft): Promise<{ subject: string; html: string }> {
  const [ohAvatar, kimAvatar] = await Promise.all([getPersonaAvatar('oh').catch(() => null), getPersonaAvatar('kim').catch(() => null)]);
  const h = (t: string) => `<h2 style="font-size:16px;margin:26px 0 10px;color:#111;">${esc(t)}</h2>`;
  const casts = draft.casts.filter((c) => c.include);

  const personas =
    (draft.oh ? personaBlock('오진실 기자의 아침 한마디', mailAvatar(ohAvatar), draft.oh, draft.full) : '') +
    (draft.kim ? personaBlock('김정신 특파원의 해외 소식', mailAvatar(kimAvatar), draft.kim, draft.full) : '');

  const castHtml =
    (casts.length ? h('어제의 정치신세계') : '') +
    casts
      .map((c) => {
        const url = `https://www.youtube.com/watch?v=${c.youtubeId}&utm_source=newsletter&utm_medium=email&utm_campaign=daily`;
        const bullets = c.bullets.filter((b) => b.trim()).map((b) => `<p style="margin:0 0 5px;color:#333;font-size:14px;line-height:1.7;">· ${mdHtml(b)}</p>`).join('');
        return `<div style="margin:0 0 22px;padding:0 0 18px;border-bottom:1px solid #eee;">
          <a href="${esc(url)}"><img src="${esc(c.thumbnailUrl)}" alt="" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:8px;margin:0 0 10px;border:0;"></a>
          <a href="${esc(url)}" style="font-size:17px;line-height:1.45;font-weight:700;color:#111;text-decoration:none;">${esc(c.title)}</a>
          <p style="margin:6px 0 10px;color:#999;font-size:12px;">${esc(c.time)} 방송</p>
          ${bullets || '<p style="margin:0 0 8px;color:#999;font-size:13px;">요약을 만들지 못했습니다. 영상으로 확인해 주세요.</p>'}
          <a href="${esc(url)}" style="display:inline-block;margin-top:6px;color:#ec1561;font-weight:700;font-size:13px;text-decoration:none;">▶ 방송 보러 가기</a>
        </div>`;
      })
      .join('');

  const articles = await selectedArticles(draft.articleIds);
  const label = dailyLabel(draft.dateKey);
  const html = buildNewsletterHtml(articles, draft.greeting, {
    title: `팩트파인더 아침 · ${label}`,
    campaign: `daily-${draft.dateKey.replace(/-/g, '')}`,
    subtitle: '정치신세계 · 아침 브리핑',
    beforeArticles: personas + castHtml + (articles.length ? h('어제의 기사') : ''),
    afterArticles: '',
  });
  const lead = casts[0]?.title.replace(/\s+/g, ' ').slice(0, 40);
  return { subject: `[팩트파인더 아침] ${label}${lead ? ` — 정치신세계 어제 방송: ${lead}` : ''}`, html };
}
