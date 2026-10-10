import { prisma } from '@/lib/prisma';
import { authorName } from '@/lib/byline';
import type { AnalyticsReport } from '@/lib/gaReport';
import type { MediaWatch } from '@/lib/mediaWatch';

// 제미나이 전략·정성 분석 (2026-10-08) — 숫자 보고서(GA) + 이번 주 실제 기사 제목들을 넘겨
// "무엇이 왜 읽혔고 다음 주 무엇을 언제 쓸지"를 편집국 관점으로 받는다. 매일 아침 보고서와 함께 자동 생성.
// 2026-10-09: 일반론("중도 관점을 보여라") 대신 매체 동향(lib/mediaWatch.ts — 조선·중앙·동아·매일·서울신문·한국경제 1면·많이 본·댓글 많은 뉴스)
// 근거의 구체적 기사 아이디어(키워드·제목 예시·근거·추천 기자·연결할 옛 기사)로 개편.
// Render 환경변수: GEMINI_API_KEY(비밀값), GEMINI_MODEL(선택, 기본 gemini-3.6-flash)
// 개인정보는 보내지 않음(집계 수치·기사 제목·기자 필명만).

export type ArticleIdea = {
  priority: number; // 1·2·3순위
  keyword: string;
  issue: string;
  headline: string; // 제목 예시
  angle: string; // 쓸 각도
  evidence: string; // 근거(어느 매체 몇 면·몇 위)
  reporter?: string; // 옛 보고서 호환 — 2026-10-09 사장님 지시로 추천 기자는 만들지 않음
  related?: { id: string; title: string; date: string | null }[]; // (옛 보고서 호환) 연결할 우리 옛 기사 — 10-09 사장님 지시로 표시 안 함
  refs?: { outlet: string; title: string; url: string }[]; // 이 이슈의 대표 기사(다른 언론) — 서버가 매체 동향에서 골라 붙임
};

export type GeminiAnalysis = {
  headline: string;
  ideas?: ArticleIdea[];
  outletComparison?: string[];
  opening?: string; // 오진실 기자의 첫 인사(선배님들~ 하고 너스레 떠는 수다) 두세 문장
  closing?: string; // 오진실 기자의 마무리 인사 한두 문장
  chatter?: string[]; // 오진실 기자의 수다 — 한국 뉴스 중 눈에 띄는 비정치 이슈 한마디씩(중요도 순 아님)
  whatWorked: string[];
  whatDidnt: string[];
  topicStrategy?: string[]; // 옛 보고서 호환(더 이상 만들지 않음)
  scheduleStrategy: string[];
  channelStrategy: string[];
  reporterNotes: string[];
  nextWeekActions: string[];
};

const LIST = { type: 'ARRAY', items: { type: 'STRING' } };
const IDEA = {
  type: 'OBJECT',
  properties: {
    priority: { type: 'INTEGER' },
    keyword: { type: 'STRING' },
    issue: { type: 'STRING' },
    headline: { type: 'STRING' },
    angle: { type: 'STRING' },
    evidence: { type: 'STRING' },
  },
  required: ['priority', 'keyword', 'issue', 'headline', 'angle', 'evidence'],
};
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    ideas: { type: 'ARRAY', items: IDEA },
    outletComparison: LIST,
    chatter: LIST,
    opening: { type: 'STRING' },
    closing: { type: 'STRING' },
    whatWorked: LIST,
    whatDidnt: LIST,
    scheduleStrategy: LIST,
    channelStrategy: LIST,
    reporterNotes: LIST,
    nextWeekActions: LIST,
  },
  required: ['headline', 'ideas', 'outletComparison', 'whatWorked', 'whatDidnt', 'scheduleStrategy', 'channelStrategy', 'reporterNotes', 'nextWeekActions'],
};

export function geminiConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

const isFront = (page?: string) => /^A?1면$/.test(page ?? '');

export async function analyzeWithGemini(report: AnalyticsReport, media: MediaWatch | null): Promise<GeminiAnalysis> {
  const since = new Date(Date.now() - 7 * 86400_000);
  const [published] = await Promise.all([
    prisma.article.findMany({
      where: { status: 'PUBLISHED', publishedAt: { gte: since } },
      orderBy: { publishedAt: 'desc' },
      take: 80,
      select: { title: true, publishedAt: true, category: { select: { name: true } }, author: { select: { name: true, nickname: true } } },
    }),
  ]);
  const hasVisits = report.summary.users > 0;

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
    매체동향: media
      ? {
          매체별: media.outlets.map((o) => ({
            매체: o.name,
            지면날짜: o.paperDate,
            일면: o.newspaper.filter((i) => isFront(i.page)).map((i) => i.title),
            주요지면: o.newspaper
              .filter((i) => /^A?[2-6]면$/.test(i.page ?? ''))
              .slice(0, 15)
              .map((i) => `${i.page} ${i.title}`),
            많이본뉴스: o.popular.slice(0, 10).map((i) => `${i.rank}위 ${i.title}`),
            댓글많은뉴스: o.commented.slice(0, 10).map((i) => `${i.rank}위 ${i.title}`),
          })),
          키워드: media.keywords.map((k) => ({
            키워드: k.word,
            다룬매체: k.outlets,
            기사수: k.articles,
            일면매체수: k.front,
            많이본: k.popular,
            댓글많은: k.commented,
            팩트파인더_최근7일: k.oursWeek,
            팩트파인더_전체: k.oursAll,
          })),
        }
      : null,
  };

  const kstHourNow = new Date(Date.now() + 9 * 3600_000).getUTCHours();
  const prompt = `당신은 한국 인터넷 정치 언론사 "팩트파인더" 편집국의 오진실 기자입니다. 편집장님과 선배 기자님들께 아침 동향을 챙겨 드리는 막내 같은 후배라고 생각하세요.
말투(중요): 딱딱한 보고서체 금지. **수다스럽고 따뜻한** 존댓말로, 선배들 옆에 붙어 앉아 너스레 떨며 말하듯 씁니다. 호칭은 "편집장님", "선배님들"입니다. "~이에요", "~해요", "~거든요", "~세요"를 자연스럽게 섞고, 위트는 한 스푼만(과하거나 가볍지 않게). 이유를 곁들여 권하고 강조할 건 강조합니다. 예) "이 이슈는 세 매체가 동시에 1면에 올렸어요. 이런 이유로 오늘은 이 건부터 더 챙겨보세요.", "여기가 포인트예요, 이건 꼭 강조하셔야 해요."
단, 아래 headline(맨 위 요약)·evidence·outletComparison·nextWeekActions·issue·angle은 이 말투로 쓰되, ideas[].headline(실제로 달 기사 제목 예시)만은 평범한 기사 제목체로 씁니다.
매체: 팩트파인더 — 정치 기사 중심의 소규모 인터넷신문. 기자 수가 적어 하루 몇 건만 씁니다.
아래 데이터: ① 구글 애널리틱스 최근 7일 집계(방문자 ${report.summary.users}명) ② 팩트파인더 이번 주 발행 기사 ③ 매체동향 — 조선·중앙·동아·매일신문·서울신문·한국경제의 오늘 신문 1면·주요 지면, 네이버 많이 본 뉴스·댓글 많은 뉴스, 그리고 키워드 집계(팩트파인더가 그 키워드로 쓴 기사 수 포함).

가장 중요한 일: "ideas" — 오늘·이번 주 팩트파인더가 실제로 쓸 기사 5~7개.
- priority 1: 여러 매체가 1면·많이 본·댓글 많은 뉴스로 다뤘는데 팩트파인더 최근 7일 기사가 없는 이슈
- priority 2: 한두 매체만 1면·단독으로 강하게 다뤘거나 댓글이 몰린(논쟁적인) 이슈 중 우리가 안 쓴 것
- priority 3: 팩트파인더 전체(옛 기사)에 쌓인 주제와 이어지는 후속 기사감
- keyword: 키워드 집계의 단어 그대로(가능하면). issue: 어떤 사건인지 한 줄(인물·기관·사건명 포함)
- headline: 실제로 달 수 있는 기사 제목(30자 안팎). angle: 다른 매체 기사와 차별화할 구체적 취재·분석 각도
- evidence: 근거를 숫자로 — 예) "조선·동아 1면, 중앙 많이 본 뉴스 2위, 댓글 많은 뉴스 3개 매체"
"outletComparison": 같은 이슈를 6개 매체가 어떻게 다르게 다뤘는지 3~5개 — 1면 배치 여부, 어느 매체만 다뤘는지, 제목에서 드러나는 초점 차이를 매체 이름과 함께.

수다(chatter): 위 두 가지와 별개로, 한국 뉴스(네이버 많이 본·댓글 많은·지면) 중 **정치 말고 눈에 띄는 이슈**(연예·스포츠·생활·날씨·사건사고·문화·음식·유행 등)를 4~6줄, 한 줄씩 너스레 떨듯 자연스럽게 언급합니다. 중요도 순이 아니라 그냥 "어, 이거 눈에 띄네" 하고 대충 재미있게. 예) "오늘 점심 메뉴 고민하시는 분들, 김밥 값 얘기가 댓글창을 달구고 있어요. 저도 괜히 편의점 앞에서 서성였네요." 데이터의 제목에 있는 사실만 말하고 지어내지 마세요. 정치 기사는 여기 넣지 마세요.

첫 인사(opening): 보고 맨 앞 인사 2~3문장. "선배님들~" 하고 부르며 **수다스럽게 너스레를 떨고** 따뜻하게 시작합니다. 자기소개(오진실 기자입니다)도 넣으세요. 지금 한국시간은 ${kstHourNow}시니 아침·낮·저녁 인사를 시간대에 맞게 하세요. 예) "선배님들~ 좋은 아침이에요! 진실이 출근했습니다. 커피는 한 잔씩 하셨죠? 저는 아침부터 뉴스 훑느라 눈이 벌써 반짝반짝이에요." 구체적인 사실(통계·사건)은 지어내지 말고 안부·분위기 위주로 씁니다.
마무리 인사(closing): 보고 맨 끝에 붙이는 후배다운 따뜻한 한두 문장. 편집장님과 선배 기자님들을 챙기는 말입니다. 예) "오늘도 다들 점심 거르지 마세요. 저는 아이디어 몇 개 더 주워 올게요, 파이팅이에요!" 날씨·건강·식사 같은 가벼운 안부는 좋지만 구체적인 사실(통계·사건)을 지어내진 마세요.

절대 규칙:
- 인물·기관·사건·법안 같은 고유명사가 없는 일반론 문장 금지. ("중도 관점을 보여라", "신뢰도를 높여라", "회의를 열어라" 같은 말은 쓰지 말 것)
- 데이터에 없는 사실을 지어내지 말 것. 근거는 위 데이터에서만.
- 특정 정당·정치인 지지·비판 의견은 내지 말고 편집·취재 관점에서만.
- 기자 이름을 추천·지목하지 말 것(누가 쓸지는 편집장이 정함). reporterNotes는 항상 빈 배열.
- 방문자 데이터가 없으면(방문자 0) whatWorked·whatDidnt·scheduleStrategy·channelStrategy는 빈 배열.${hasVisits ? '' : ' 지금이 그 경우입니다.'}
- nextWeekActions: ideas를 실행하는 구체적 취재·작성 할 일 3~5개(사람 이름 없이).
- headline(맨 위 한 줄 요약): "오늘 가장 먼저 쓸 기사는 무엇이고 왜인가"를 한 문장으로.
- 모든 문장은 한국어, 한두 문장.

데이터:
${JSON.stringify(data)}`;

  // 제미나이가 붐빌 때("high demand" 등) 잠깐 쉬고 재시도, 그래도 안 되면 가벼운 모델로 자동 전환 (2026-10-08)
  const models = [...new Set([process.env.GEMINI_MODEL || 'gemini-3.6-flash', 'gemini-3.5-flash-lite'])];
  let text = '';
  let lastError = '';
  outer: for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 8000));
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          // responseSchema로 형식을 강제 — 문장 속 따옴표 등으로 JSON이 깨지는 것 방지
          generationConfig: { temperature: 0.5, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
        }),
        signal: AbortSignal.timeout(120_000),
      }).catch((e) => {
        lastError = e instanceof Error ? e.message : String(e);
        return null;
      });
      if (!res) continue;
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        text = body.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
        try {
          JSON.parse(text.replace(/^```json\s*|```\s*$/g, ''));
          break outer;
        } catch {
          lastError = '답변 형식 오류';
          text = '';
          continue; // 형식이 깨졌으면 다시 요청
        }
      }
      lastError = body.error?.message ?? `HTTP ${res.status}`;
      // 붐빔·일시 오류(429·500·503)만 재시도, 키 오류 등은 바로 중단
      if (![429, 500, 503].includes(res.status)) break outer;
    }
  }
  if (!text) throw new Error(`자동 분석 호출 실패: ${lastError}`);
  const parsed = JSON.parse(text.replace(/^```json\s*|```\s*$/g, ''));
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 6) : []);

  // 아이디어마다 이 이슈의 대표 기사(다른 언론) 몇 개 — 오늘 모은 1면·많이 본·댓글 많은·지면 기사 중 제목에 키워드가 있는 것,
  // 매체가 겹치지 않게 최대 3개(1면 → 많이 본 → 댓글 많은 → 나머지 지면 순) (2026-10-09: "연결할 우리 기사" 대신)
  const pool = (media?.outlets ?? []).flatMap((o) => [
    ...o.newspaper.filter((x) => /^A?1면$/.test(x.page ?? '')).map((x) => ({ outlet: o.name, title: x.title, url: x.url, rank: 0 })),
    ...o.popular.map((x) => ({ outlet: o.name, title: x.title, url: x.url, rank: 1 })),
    ...o.commented.map((x) => ({ outlet: o.name, title: x.title, url: x.url, rank: 2 })),
    ...o.newspaper.filter((x) => !/^A?1면$/.test(x.page ?? '')).map((x) => ({ outlet: o.name, title: x.title, url: x.url, rank: 3 })),
  ]);
  // 제목에선 한자 약칭으로 쓰는 경우가 많음 — "북한"은 "北"도, "이재명"은 "李"도
  const ABBR: Record<string, string> = { 북한: '北', 미국: '美', 중국: '中', 일본: '日', 이재명: '李', 윤석열: '尹', 노무현: '盧', 문재인: '文', 검찰: '檢', 여당: '與', 야당: '野', 러시아: '露' };
  const refsFor = (keyword: string) => {
    if (keyword.length < 2) return [];
    const terms = [keyword, ...(ABBR[keyword] ? [ABBR[keyword]] : [])];
    const picked: { outlet: string; title: string; url: string }[] = [];
    for (const r of [...pool].filter((x) => terms.some((t) => x.title.includes(t))).sort((x, y) => x.rank - y.rank)) {
      if (picked.some((p) => p.outlet === r.outlet || p.title === r.title)) continue;
      picked.push({ outlet: r.outlet, title: r.title, url: r.url });
      if (picked.length >= 3) break;
    }
    return picked;
  };
  const ideas: ArticleIdea[] = (Array.isArray(parsed.ideas) ? parsed.ideas : []).slice(0, 8).map((i: any) => {
    const keyword = String(i.keyword ?? '').trim();
    return {
      priority: Math.min(3, Math.max(1, Number(i.priority) || 3)),
      keyword,
      issue: String(i.issue ?? ''),
      headline: String(i.headline ?? ''),
      angle: String(i.angle ?? ''),
      evidence: String(i.evidence ?? ''),
      refs: refsFor(keyword),
    };
  });
  ideas.sort((a, b) => a.priority - b.priority);

  return {
    headline: String(parsed.headline ?? ''),
    ideas,
    outletComparison: arr(parsed.outletComparison),
    chatter: arr(parsed.chatter),
    opening: String(parsed.opening ?? '').trim(),
    closing: String(parsed.closing ?? '').trim(),
    whatWorked: arr(parsed.whatWorked),
    whatDidnt: arr(parsed.whatDidnt),
    scheduleStrategy: arr(parsed.scheduleStrategy),
    channelStrategy: arr(parsed.channelStrategy),
    reporterNotes: [],
    nextWeekActions: arr(parsed.nextWeekActions),
  };
}
