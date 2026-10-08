import { prisma } from '@/lib/prisma';
import { authorName } from '@/lib/byline';
import type { AnalyticsReport } from '@/lib/gaReport';

// 제미나이 전략·정성 분석 (2026-10-08) — 숫자 보고서(GA) + 이번 주 실제 기사 제목들을 넘겨
// "무엇이 왜 읽혔고 다음 주 무엇을 언제 쓸지"를 편집국 관점으로 받는다. 매일 아침 보고서와 함께 자동 생성.
// Render 환경변수: GEMINI_API_KEY(비밀값), GEMINI_MODEL(선택, 기본 gemini-3.6-flash)
// 개인정보는 보내지 않음(집계 수치·기사 제목·기자 필명만).

export type GeminiAnalysis = {
  headline: string;
  whatWorked: string[];
  whatDidnt: string[];
  topicStrategy: string[];
  scheduleStrategy: string[];
  channelStrategy: string[];
  reporterNotes: string[];
  nextWeekActions: string[];
};

export function geminiConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

export async function analyzeWithGemini(report: AnalyticsReport): Promise<GeminiAnalysis> {
  const since = new Date(Date.now() - 7 * 86400_000);
  const published = await prisma.article.findMany({
    where: { status: 'PUBLISHED', publishedAt: { gte: since } },
    orderBy: { publishedAt: 'desc' },
    take: 80,
    select: { title: true, publishedAt: true, category: { select: { name: true } }, author: { select: { name: true, nickname: true } } },
  });

  const viewsByTitle = new Map(report.topArticles.map((a) => [a.title, a.views]));
  const data = {
    기간: report.period,
    요약: {
      방문자: report.summary.users,
      지난주방문자: report.summary.prev.users,
      페이지조회: report.summary.views,
      지난주페이지조회: report.summary.prev.views,
      신규방문자: report.summary.newUsers,
      평균체류초: report.summary.engagementSec,
    },
    유입경로: report.channels.map((c) => ({ 경로: c.label, 이번주: c.sessions, 지난주: c.prevSessions })),
    기기: report.devices,
    시간대별조회_28일: report.hours.map((h) => [h.hour, h.views]),
    요일별조회_28일: report.weekdays.map((d) => [['일', '월', '화', '수', '목', '금', '토'][d.day], d.views]),
    많이읽힌기사: report.topArticles.slice(0, 15).map((a) => ({ 제목: a.title, 기자: a.author, 카테고리: a.category, 조회: a.views })),
    기자별조회: report.reporters,
    카테고리별조회: report.categories,
    이번주발행기사: published.map((a) => ({
      제목: a.title,
      카테고리: a.category?.name ?? null,
      기자: authorName(a.author),
      발행: a.publishedAt?.toISOString().slice(0, 16).replace('T', ' '),
      조회: viewsByTitle.get(a.title) ?? null,
    })),
    자동계산인사이트: report.insights.map((i) => i.text),
  };

  const prompt = `당신은 한국 인터넷 정치 언론사의 편집 전략 컨설턴트입니다.
매체: 팩트파인더 — "진영주의를 벗어나 중도주의 관점으로 정치와 사회를 보는" 인터넷신문. 정치 기사 비중이 크고 기자 수가 적은 소규모 매체입니다.
아래는 최근 7일 구글 애널리틱스 집계와 이번 주 발행 기사 목록입니다(조회가 null이면 상위권 밖).

규칙:
- 숫자를 그대로 다시 읊지 말고, 숫자가 의미하는 바와 원인 가설, 다음 행동을 쓰세요.
- 기사 제목을 근거로 어떤 주제·인물·논조·제목 방식이 읽혔는지 정성적으로 해석하세요.
- 특정 정당·정치인에 대한 지지·비판 의견은 내지 말고, 독자 반응과 편집 전략 관점에서만 쓰세요.
- 자료가 적거나 불확실하면 그렇다고 밝히고 단정하지 마세요.
- 모든 항목은 한국어, 한두 문장, 구체적으로. 각 배열은 2~5개.

다음 JSON 하나만 출력하세요:
{"headline":"이번 주를 한 문장으로","whatWorked":[],"whatDidnt":[],"topicStrategy":["다음 주 다룰 주제·후속기사 제안"],"scheduleStrategy":["발행 시간·요일 전략"],"channelStrategy":["네이버·구글·SNS 등 유입 전략"],"reporterNotes":["기자별 강점·배치 제안"],"nextWeekActions":["다음 주 바로 할 일 체크리스트"]}

데이터:
${JSON.stringify(data)}`;

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`제미나이 호출 실패: ${body.error?.message ?? res.status}`);
  const text: string = body.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
  const parsed = JSON.parse(text.replace(/^```json\s*|```\s*$/g, ''));
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 6) : []);
  return {
    headline: String(parsed.headline ?? ''),
    whatWorked: arr(parsed.whatWorked),
    whatDidnt: arr(parsed.whatDidnt),
    topicStrategy: arr(parsed.topicStrategy),
    scheduleStrategy: arr(parsed.scheduleStrategy),
    channelStrategy: arr(parsed.channelStrategy),
    reporterNotes: arr(parsed.reporterNotes),
    nextWeekActions: arr(parsed.nextWeekActions),
  };
}
