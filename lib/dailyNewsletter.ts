import { prisma } from '@/lib/prisma';
import { generateText, geminiReady } from '@/lib/gemini';
import { esc, buildNewsletterHtml, kstDate, pickArticles, selectedArticles } from '@/lib/newsletter';
import { splitLinked } from '@/lib/linkMarkup';
import { pastOhLetters } from '@/lib/analyticsSnapshot';
import { recentForeignReports } from '@/lib/foreignNews';

// 팩트파인더 아침 브리핑(일간) — 2026-10-10 기획: 정치신세계 어제 방송(보통 2회)을 다음 날 아침에 간단히 정리해 보내고,
// 어제 기사가 있으면 기사를, 없으면 오진실 기자·김정신 특파원의 가장 마지막 브리핑을 독자 '정신줄님' 호칭으로 바꿔 싣는다.
// 규칙: 평일만 발송 · 어제 방송이 없으면 건너뜀. (아직 구독자 자동 발송은 연결하지 않음 — 편집장 본인에게만 테스트 발송)
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

// A) 제미나이가 유튜브 주소를 직접 보고 요약 — 길이·사용량 제한으로 실패할 수 있어 실패하면 빈 배열
async function summarizeByVideo(id: string, title: string): Promise<string[]> {
  if (!geminiReady()) return [];
  const model = process.env.GEMINI_VIDEO_MODEL || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const prompt = `이 영상은 정치 시사 방송 "정치신세계"의 방송입니다(제목: ${title}).
방송에서 실제로 나온 핵심 내용을 한국어로 3~5줄 요약하세요. 한 줄은 한 문장, 줄 앞에 "- "를 붙입니다.
규칙: 영상에서 확인되지 않은 내용은 쓰지 마세요. 출연자 이름이 불확실하면 쓰지 마세요. 설명·머리말 없이 줄만 출력하세요.`;
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
      const bullets = parseBullets(text);
      if (bullets.length) return bullets;
      return [];
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
  if (clean.length < 40) return [];
  if (geminiReady()) {
    try {
      const t = await generateText(
        `정치 시사 방송 "정치신세계"의 제목과 설명란입니다. 여기 적힌 내용만으로 방송 내용을 한국어 2~4줄로 요약하세요. 줄 앞에 "- ", 한 줄은 한 문장. 적혀 있지 않은 내용은 쓰지 마세요.\n제목: ${title}\n설명란:\n${clean.slice(0, 3000)}`,
        { temperature: 0.2 }
      );
      const b = parseBullets(t);
      if (b.length) return b;
    } catch {
      /* 아래 단순 발췌로 */
    }
  }
  return clean.split('\n').map((l) => l.trim()).filter((l) => l.length >= 8).slice(0, 3).map((l) => l.slice(0, 140));
}

async function summarize(id: string, title: string): Promise<Summary> {
  const cacheId = `0-bs-${id}`; // 같은 방송을 테스트·실발송에서 두 번 요약하지 않게 저장 (id '0-'은 방문 분석 최신 보고서 조회에 섞이지 않음)
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

// ── 기자 브리핑을 독자(정신줄님)용으로 ──────────────────
const A_STYLE = 'color:#0d4f55;font-weight:600;text-decoration:underline;';
const linkedHtml = (text: string, allowed: Set<string>) =>
  splitLinked(text)
    .map((p) => (p.url && allowed.has(p.url) ? `<a href="${esc(p.url)}" style="${A_STYLE}">${esc(p.text)}</a>` : esc(p.text)))
    .join('');

const toReader = (t: string) => t.replace(/편집장님[,과와\s]*(?:선배 기자님들|선배님들|선배님)/g, '정신줄님').replace(/(선배 기자님들|선배님들|선배님|편집장님)/g, '정신줄님');

// full=false면 인사(이름 줄 + 첫 문단)만, true면 브리핑 전체 — 인사는 기사가 있는 날에도 항상 싣는다 (2026-10-10)
async function personaSections(full: boolean): Promise<string> {
  const oh = (await pastOhLetters(1).catch(() => []))[0]?.ai;
  const kim = (await recentForeignReports(1).catch(() => []))[0];
  if (!oh && !kim) return '';

  const allowed = new Set<string>();
  const grab = (t?: string) => (t ?? '').replace(/\[\[[^\]|]+\|(https?:\/\/[^\]\s]+)\]\]/g, (_m, u: string) => (allowed.add(u), ''));
  const input = {
    oh: oh ? { opening: oh.opening ?? '', lines: [...(oh.chatter ?? []), ...(oh.outletComparison ?? [])], closing: oh.closing ?? '' } : null,
    kim: kim ? { intro: kim.localColor ?? '', issues: kim.overviewItems ?? [], briefs: (kim.briefs ?? []).slice(0, 6).map((b, i) => ({ i, text: b.text })), closing: kim.closing ?? '' } : null,
  };
  [input.oh?.opening, ...(input.oh?.lines ?? []), input.oh?.closing, input.kim?.intro, ...(input.kim?.issues ?? []), input.kim?.closing].forEach(grab);

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
      out = { oh: input.oh ? { ...input.oh, ...(parsed.oh ?? {}) } : null, kim: input.kim ? { ...input.kim, ...(parsed.kim ?? {}), briefs: input.kim.briefs.map((b) => ({ ...b, text: String(parsed.kim?.briefs?.find((x: any) => x.i === b.i)?.text ?? b.text) })) } : null };
    } catch {
      out = { oh: input.oh && { opening: toReader(input.oh.opening), lines: input.oh.lines.map(toReader), closing: toReader(input.oh.closing) }, kim: input.kim && { intro: toReader(input.kim.intro), issues: input.kim.issues.map(toReader), briefs: input.kim.briefs.map((b) => ({ ...b, text: toReader(b.text) })), closing: toReader(input.kim.closing) } };
    }
  }

  const para = (t: string) => (t ? `<p style="margin:0 0 8px;color:#333;font-size:14px;line-height:1.75;">${linkedHtml(t, allowed)}</p>` : '');
  const bullet = (t: string) => `<p style="margin:0 0 6px;color:#333;font-size:14px;line-height:1.7;">· ${linkedHtml(t, allowed)}</p>`;
  const h = (t: string) => `<h2 style="font-size:16px;margin:26px 0 10px;color:#111;">${esc(t)}</h2>`;
  let html = '';
  const who = (t: string) => `<p style="margin:0 0 6px;color:#111;font-size:14px;font-weight:700;line-height:1.7;">${esc(t)}</p>`;
  if (out.oh) html += h('오진실 기자의 아침 한마디') + who('정신줄님, 오진실 기자입니다.') + para(out.oh.opening) + (full ? out.oh.lines.map(bullet).join('') + para(out.oh.closing) : '');
  if (out.kim) {
    const briefs = out.kim.briefs
      .map((b) => {
        const src = kim?.briefs?.[b.i];
        return src ? `<p style="margin:0 0 6px;color:#333;font-size:14px;line-height:1.7;">· ${esc(b.text)} <a href="${esc(src.url)}" style="${A_STYLE}">${esc(src.outlet)}</a></p>` : '';
      })
      .join('');
    html += h('김정신 특파원의 해외 소식') + who('정신줄님, 김정신 특파원입니다.') + para(out.kim.intro) + (full ? out.kim.issues.map(bullet).join('') + briefs + para(out.kim.closing) : '');
  }
  return html;
}

// ── 메일 만들기 ───────────────────────────────────────
export type DailyResult = {
  skip?: string;
  subject: string;
  html: string;
  info: { broadcasts: number; summarySources: string[]; articles: number; usedPersonas: boolean };
};

export async function buildDailyNewsletter(dateKey = kstDate()): Promise<DailyResult> {
  const { start, end } = dailyWindow(dateKey);
  const casts = await prisma.videoCard.findMany({ where: { kind: 'LIVE', publishedAt: { gte: start, lt: end } }, orderBy: { publishedAt: 'asc' }, take: 4 });
  const empty = { broadcasts: 0, summarySources: [] as string[], articles: 0, usedPersonas: false };
  if (!casts.length) return { skip: '어제 정치신세계 방송이 없어 건너뜁니다', subject: '', html: '', info: empty };

  const sums: Summary[] = [];
  for (const c of casts) sums.push(await summarize(c.youtubeId, c.title)); // 한 편씩(긴 영상이라 동시에 돌리지 않음)

  const ids = await pickArticles(start, end, 5);
  const articles = await selectedArticles(ids);

  const h = (t: string) => `<h2 style="font-size:16px;margin:26px 0 10px;color:#111;">${esc(t)}</h2>`;
  const castHtml =
    h('어제의 정치신세계') +
    casts
      .map((c, i) => {
        const url = `https://www.youtube.com/watch?v=${c.youtubeId}&utm_source=newsletter&utm_medium=email&utm_campaign=daily`;
        const time = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit', hour12: true }).format(c.publishedAt);
        const bullets = sums[i].bullets.map((b) => `<p style="margin:0 0 5px;color:#333;font-size:14px;line-height:1.7;">· ${esc(b)}</p>`).join('');
        return `<div style="margin:0 0 22px;padding:0 0 18px;border-bottom:1px solid #eee;">
          <a href="${esc(url)}"><img src="${esc(c.thumbnailUrl)}" alt="" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:8px;margin:0 0 10px;border:0;"></a>
          <a href="${esc(url)}" style="font-size:17px;line-height:1.45;font-weight:700;color:#111;text-decoration:none;">${esc(c.title)}</a>
          <p style="margin:6px 0 10px;color:#999;font-size:12px;">${esc(time)} 방송</p>
          ${bullets || '<p style="margin:0 0 8px;color:#999;font-size:13px;">요약을 만들지 못했습니다. 영상으로 확인해 주세요.</p>'}
          <a href="${esc(url)}" style="display:inline-block;margin-top:6px;color:#ec1561;font-weight:700;font-size:13px;text-decoration:none;">▶ 방송 보러 가기</a>
        </div>`;
      })
      .join('');

  // 두 기자의 인사는 항상, 브리핑 전체는 어제 기사가 없을 때만
  const personas = await personaSections(!articles.length);
  const label = dailyLabel(dateKey);
  const greeting = '정신줄님, 좋은 아침입니다. 팩트파인더입니다.\n어제 정치신세계 방송과 소식을 정리해 드립니다.';
  const html = buildNewsletterHtml(articles, greeting, {
    title: `팩트파인더 아침 · ${label}`,
    campaign: `daily-${dateKey.replace(/-/g, '')}`,
    subtitle: '정치신세계 · 아침 브리핑',
    beforeArticles: castHtml + (articles.length ? personas + h('어제의 기사') : ''),
    afterArticles: articles.length ? '' : personas,
  });
  const subject = `[팩트파인더 아침] ${label} — 정치신세계 어제 방송: ${casts[0].title.replace(/\s+/g, ' ').slice(0, 40)}`;
  return { subject, html, info: { broadcasts: casts.length, summarySources: sums.map((s) => s.source), articles: articles.length, usedPersonas: !!personas && !articles.length } };
}
