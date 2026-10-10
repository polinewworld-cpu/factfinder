import { prisma } from '@/lib/prisma';
import { authorName } from '@/lib/byline';
import type { AnalyticsReport } from '@/lib/gaReport';
import type { MediaWatch } from '@/lib/mediaWatch';
import { resolveMarkers } from '@/lib/linkMarkup';

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

// 아이디어마다 이 이슈의 대표 기사(다른 언론) 몇 개 — 오늘 모은 1면·많이 본·댓글 많은·지면 기사 중 제목에 키워드가 있는 것,
// 매체가 겹치지 않게 최대 3개(1면 → 많이 본 → 댓글 많은 → 나머지 지면 순) (2026-10-09: "연결할 우리 기사" 대신)
export function refsForKeyword(media: MediaWatch | null | undefined, keyword: string) {
  const pool = (media?.outlets ?? []).flatMap((o) => [
    ...o.newspaper.filter((x) => /^A?1면$/.test(x.page ?? '')).map((x) => ({ outlet: o.name, title: x.title, url: x.url, rank: 0 })),
    ...o.popular.map((x) => ({ outlet: o.name, title: x.title, url: x.url, rank: 1 })),
    ...o.commented.map((x) => ({ outlet: o.name, title: x.title, url: x.url, rank: 2 })),
    ...o.newspaper.filter((x) => !/^A?1면$/.test(x.page ?? '')).map((x) => ({ outlet: o.name, title: x.title, url: x.url, rank: 3 })),
  ]);
  // 제목에선 한자 약칭으로 쓰는 경우가 많음 — "북한"은 "北"도, "이재명"은 "李"도
  const ABBR: Record<string, string> = { 북한: '北', 미국: '美', 중국: '中', 일본: '日', 이재명: '李', 윤석열: '尹', 노무현: '盧', 문재인: '文', 검찰: '檢', 여당: '與', 야당: '野', 러시아: '露' };
  if (keyword.length < 2) return [];
  const terms = [keyword, ...(ABBR[keyword] ? [ABBR[keyword]] : [])];
  const picked: { outlet: string; title: string; url: string }[] = [];
  for (const r of [...pool].filter((x) => terms.some((t) => x.title.includes(t))).sort((x, y) => x.rank - y.rank)) {
    if (picked.some((p) => p.outlet === r.outlet || p.title === r.title)) continue;
    picked.push({ outlet: r.outlet, title: r.title, url: r.url });
    if (picked.length >= 3) break;
  }
  return picked;
}

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
    openingGreeting: { type: 'STRING' },
    openingIssue: { type: 'STRING' },
    openingCare: { type: 'STRING' },
    closing: { type: 'STRING' },
    whatWorked: LIST,
    whatDidnt: LIST,
    scheduleStrategy: LIST,
    channelStrategy: LIST,
    reporterNotes: LIST,
    nextWeekActions: LIST,
  },
  required: ['headline', 'ideas', 'outletComparison', 'openingGreeting', 'openingIssue', 'openingCare', 'whatWorked', 'whatDidnt', 'scheduleStrategy', 'channelStrategy', 'reporterNotes', 'nextWeekActions'],
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

  // 글 속 구절에 링크를 달 수 있는 기사 목록(번호 = [[구절|번호]]의 번호). 주소는 서버가 번호로만 연결 → AI가 주소를 지어낼 수 없음
  const linkPool: { outlet: string; title: string; url: string }[] = [];
  const linkSeen = new Set<string>();
  for (const o of media?.outlets ?? []) {
    for (const x of [...o.newspaper.filter((i) => isFront(i.page)), ...o.popular, ...o.commented, ...o.newspaper.filter((i) => !isFront(i.page)).slice(0, 10)]) {
      if (!x.url || linkSeen.has(x.url) || linkPool.length >= 120) continue;
      linkSeen.add(x.url);
      linkPool.push({ outlet: o.name, title: x.title, url: x.url });
    }
  }
  const dataForPrompt = { ...data, 링크가능기사: linkPool.map((x, i) => ({ 번호: i, 매체: x.outlet, 제목: x.title })) };
  const kstHourNow = new Date(Date.now() + 9 * 3600_000).getUTCHours();
  const prompt = `당신은 한국 인터넷 정치 언론사 "팩트파인더" 편집국의 오진실 기자입니다. 편집장님과 선배 기자님들께 아침 동향을 챙겨 드리는 막내 같은 후배라고 생각하세요.
말투(중요): 딱딱한 보고서체 금지. **수다스럽고 따뜻한** 존댓말로, 선배들 옆에 붙어 앉아 너스레 떨며 말하듯 씁니다. 호칭은 "편집장님", "선배님들"입니다. "~이에요", "~해요", "~거든요", "~세요"를 자연스럽게 섞고, 위트는 한 스푼만(과하거나 가볍지 않게). 이유를 곁들여 권하고 강조할 건 강조합니다. 예) "이 이슈는 세 매체가 동시에 1면에 올렸어요. 이런 이유로 오늘은 이 건부터 더 챙겨보세요.", "여기가 포인트예요, 이건 꼭 강조하셔야 해요."
귀엽고 따뜻하게(필수): 편집장님과 선배님들을 살뜰히 챙기는 멘트를 **반드시** 넣습니다. 첫 인사(opening)와 마무리(closing)에는 식사·커피·건강·휴식·날씨 같은 걸 챙기는 말을 꼭 넣고, 수다(chatter)와 매체 동향 줄 중 최소 두세 줄에는 끝에 짧은 챙김 한마디를 붙입니다. 예) "비 소식 있으니 우산 챙기세요~", "점심 거르지 마시고요 ㅎㅎ", "목 아프실 땐 따뜻한 차 한 잔 하세요". 애교는 은은하게, 과하지 않게(이모티콘 금지, "ㅎㅎ" 정도만 허용). 챙김 멘트가 구체적인 사실(통계·사건)을 단정하지는 않게 합니다.
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

첫 인사는 세 칸으로 나눠 씁니다(합쳐서 보고 맨 앞 정감 있는 이야기가 됩니다).
- openingGreeting: "선배님들~" 하고 부르며 너스레 떠는 인사 한 문장. 지금 한국시간은 ${kstHourNow}시니 아침·낮·저녁을 맞추세요. 자기소개는 화면에 따로 나오니 넣지 마세요.
- openingIssue(**필수, 핵심**): 오늘 가장 눈에 띄는 구체적 이슈 하나를 **'누가/무엇이/어떻게 됐다'는 사실로 한두 문장** 씁니다. 사실은 데이터 속 기사 제목에 있는 것만 쓰고, 핵심 구절은 [[구절|번호]]로 링크합니다. 인사말·기분·자기 이야기로 채우지 마세요. 예) "오늘 아침엔 [[탕비실 믹스커피 하루 2개 제한|12]]이 동아일보 댓글 1위에 올랐더라고요, 대표님 글에 직장인들 갑론을박이 뜨겁대요."
- openingCare: 그 이슈나 오늘 날씨·시간대와 이어지는 귀엽고 따뜻한 챙김 멘트 한 문장(식사·커피·건강·휴식 등). 예) "커피 줄어든다니 선배님들은 오늘 한 잔 꼭 챙겨 드세요~" (단 막연한 응원보다, 시간대에 맞는 구체적 메뉴 추천이나 일반 상식 수준의 생활 건강 팁을 담으면 더 좋아요)
마무리 인사(closing): 보고 맨 끝에 붙이는 후배다운 귀엽고 따뜻한 한두 문장(챙김 멘트 필수). 편집장님과 선배 기자님들을 챙기는 말입니다. 예) "오늘도 다들 점심 거르지 마세요. 저는 아이디어 몇 개 더 주워 올게요, 파이팅이에요!" 날씨·건강·식사 같은 가벼운 안부는 좋지만 구체적인 사실(통계·사건)을 지어내진 마세요.
**정보가치(중요)**: "점심 챙겨 드세요"처럼 막연한 응원으로 끝내지 말고, 실제로 쓸모 있는 한마디를 담으세요. 예) 시간대·날씨에 맞는 **구체적인 메뉴 추천**(비 오는 날 칼칼한 국물, 쌀쌀하면 따뜻한 국밥·칼국수, 더우면 냉면·콩국수, 오후엔 당 떨어질 때 견과류 등)이나 **일반적으로 알려진 생활 건강 정보**(장시간 앉아 있을 땐 한 시간에 한 번 스트레칭, 환절기엔 물 자주 마시기, 목이 칼칼하면 따뜻한 물·도라지차, 눈 피로엔 20분마다 먼 곳 보기 등). 메뉴·건강 팁은 일반 상식 수준으로, 의학적 단정·치료 효능 주장·특정 통계 수치는 쓰지 마세요.
예) "오늘 비가 오니 점심은 칼칼한 순두부찌개 어떠세요? 오래 앉아 계셨으면 일어나 어깨 한 번 돌려주시고요. 저는 아이디어 몇 개 더 주워 올게요!"

링크(중요): 수다(chatter)·매체 비교(outletComparison)·맨 위 요약(headline)의 문장에서 **핵심 구절**(사건·인물·이슈 이름)은 [[구절|번호]] 형식으로 감쌉니다. 번호는 데이터의 "링크가능기사" 목록에 있는 해당 기사 번호만 쓰세요(목록에 없는 기사는 링크하지 않습니다). 수다는 **한 줄마다 반드시 하나 이상**, 매체 비교는 항목마다 하나 이상 링크를 답니다. 예) "[[믹스커피 제한 소식|12]] 보셨나요, 직장인들 갑론을박이 뜨겁더라고요." 구절은 짧게(2~12자), 문장을 통째로 감싸지 마세요.

절대 규칙:
- 인물·기관·사건·법안 같은 고유명사가 없는 일반론 문장 금지. ("중도 관점을 보여라", "신뢰도를 높여라", "회의를 열어라" 같은 말은 쓰지 말 것)
- 데이터에 없는 사실을 지어내지 말 것. 근거는 위 데이터에서만.
- 팩트파인더는 보수 성향 언론으로 **집권 더불어민주당 정부와 대통령에 대한 비판적 시각이 기본 편집 기조**입니다. 기사 아이디어의 각도(angle)와 요약은 정부·대통령의 책임, 해명이 필요한 대목, 말과 행동의 불일치를 먼저 보는 방향으로 잡으세요. 단, 국민의힘 등 특정 정당을 지지·옹호하는 문장은 쓰지 말고, 근거는 데이터의 사실에서만 끌어오며 확인되지 않은 것은 단정하지 마세요. "중립을 지키라"는 식의 기계적 균형 조언은 쓰지 마세요.
- 기자 이름을 추천·지목하지 말 것(누가 쓸지는 편집장이 정함). reporterNotes는 항상 빈 배열.
- 방문자 데이터가 없으면(방문자 0) whatWorked·whatDidnt·scheduleStrategy·channelStrategy는 빈 배열.${hasVisits ? '' : ' 지금이 그 경우입니다.'}
- nextWeekActions: ideas를 실행하는 구체적 취재·작성 할 일 3~5개(사람 이름 없이).
- headline(맨 위 한 줄 요약): "오늘 가장 먼저 쓸 기사는 무엇이고 왜인가"를 한 문장으로.
- 모든 문장은 한국어, 한두 문장.

데이터:
${JSON.stringify(dataForPrompt)}`;

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
          generationConfig: { temperature: 0.5, maxOutputTokens: 16000, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
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
          lastError = body.candidates?.[0]?.finishReason === 'MAX_TOKENS' ? '답변이 너무 길어 중간에 잘렸습니다' : '답변 형식 오류';
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
  const link = (t: string) => resolveMarkers(t, (k) => linkPool[Number(k)]?.url);

  const refsFor = (keyword: string) => refsForKeyword(media, keyword);
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
    headline: link(String(parsed.headline ?? '')),
    ideas,
    outletComparison: arr(parsed.outletComparison).map(link),
    chatter: arr(parsed.chatter).map(link),
    opening: link([parsed.openingGreeting, parsed.openingIssue, parsed.openingCare].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ') || String(parsed.opening ?? '').trim()),
    closing: String(parsed.closing ?? '').trim(),
    whatWorked: arr(parsed.whatWorked),
    whatDidnt: arr(parsed.whatDidnt),
    scheduleStrategy: arr(parsed.scheduleStrategy),
    channelStrategy: arr(parsed.channelStrategy),
    reporterNotes: [],
    nextWeekActions: arr(parsed.nextWeekActions),
  };
}
