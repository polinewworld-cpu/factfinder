import { prisma } from '@/lib/prisma';
import { generateText, geminiReady } from '@/lib/gemini';
import { refsForKeyword, type ArticleIdea } from '@/lib/geminiAnalysis';
import { resolveMarkers, stripMarkers } from '@/lib/linkMarkup';
import type { AnalyticsReport } from '@/lib/gaReport';

// 오진실 기자 항목 × — "오늘 눈에 띈 이야기"(chatter)·"오늘의 기사각"(ideas) 한 칸을 지우고 새 토픽으로 교체 (2026-10-10)
// 지운 항목은 report.dismissed에 남겨 같은 걸 다시 가져오지 않음.
const isFront = (p?: string) => /^A?1면$/.test(p ?? '');

function parseJson(text: string): any {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const a = cleaned.indexOf('{');
  const b = cleaned.lastIndexOf('}');
  return JSON.parse(a >= 0 && b > a ? cleaned.slice(a, b + 1) : cleaned);
}

export async function replaceOhItem(kind: 'chatter' | 'idea', index: number): Promise<AnalyticsReport> {
  const row = await prisma.analyticsSnapshot.findFirst({ orderBy: { id: 'desc' } });
  if (!row) throw new Error('보고서가 없습니다');
  const report = row.data as unknown as AnalyticsReport;
  const ai = report.ai;
  if (!ai) throw new Error('오진실 기자의 보고가 아직 없습니다');
  report.dismissed = report.dismissed ?? [];

  // 1) 지우기
  if (kind === 'chatter') {
    const list = ai.chatter ?? [];
    const [gone] = list.splice(index, 1);
    ai.chatter = list;
    if (gone) report.dismissed.push(gone.replace(/\[\[([^\]|]+)\|[^\]]*\]\]/g, '$1'));
  } else {
    const list = ai.ideas ?? [];
    const [gone] = list.splice(index, 1);
    ai.ideas = list;
    if (gone) report.dismissed.push(gone.keyword || gone.headline);
  }
  const save = () => prisma.analyticsSnapshot.update({ where: { id: row.id }, data: { data: report as any, createdAt: new Date() } });

  // 2) 새 토픽 가져오기
  try {
    if (!geminiReady()) throw new Error('제미나이 키가 없어 새 토픽을 만들 수 없습니다');
    const media = report.media;
    if (!media) throw new Error('오늘의 매체 동향 자료가 없어요. 새로고침을 먼저 눌러 주세요');
    const pool: { outlet: string; title: string; url: string }[] = [];
    const seen = new Set<string>();
    for (const o of media.outlets) {
      for (const x of [...o.newspaper.filter((i) => isFront(i.page)), ...o.popular, ...o.commented, ...o.newspaper.filter((i) => !isFront(i.page)).slice(0, 10)]) {
        if (!x.url || seen.has(x.url) || pool.length >= 120) continue;
        seen.add(x.url);
        pool.push({ outlet: o.name, title: x.title, url: x.url });
      }
    }
    const heads = pool.map((x, i) => `[${i}] (${x.outlet}) ${x.title}`).join('\n');
    const tone = `당신은 한국 인터넷 정치 언론사 "팩트파인더" 편집국의 오진실 기자입니다. 편집장님과 선배 기자님들께 말하는 막내 후배로, **수다스럽고 따뜻한** 존댓말("~이에요/~해요/~거든요")로 씁니다. 호칭은 "선배님들". 이모티콘 금지, 위트는 한 스푼.`;
    const dismissed = report.dismissed.slice(-30).map((d) => `- ${d}`).join('\n') || '(없음)';

    if (kind === 'chatter') {
      const have = (ai.chatter ?? []).map((c) => `- ${c.replace(/\[\[([^\]|]+)\|[^\]]*\]\]/g, '$1')}`).join('\n') || '(없음)';
      const prompt = `${tone}
아래 오늘 한국 신문·포털 기사 제목 목록에서 **정치 말고 눈에 띄는 이슈 하나**(연예·스포츠·생활·날씨·사건사고·문화·음식·유행 등)를 골라 "수다" 한 줄(1~2문장)을 쓰세요. 너스레 떨듯 자연스럽게, 끝에 짧은 챙김 한마디를 붙이면 좋아요. 제목에 있는 사실만 말하고 지어내지 마세요. 핵심 구절(2~12자)은 [[구절|번호]]로 한 번 이상 감싸세요(번호는 목록의 번호 그대로).
이미 있는 수다와 이전에 지운 주제는 피하세요.
이미 있는 수다:
${have}
지운 주제:
${dismissed}
출력은 JSON 객체 하나만(설명·코드블록 금지): {"line": "수다 한 줄"}

기사 제목 목록:
${heads}`;
      const parsed = parseJson(await generateText(prompt, { temperature: 0.6 }));
      const line = resolveMarkers(String(parsed?.line ?? '').trim(), (k) => pool[Number(k)]?.url);
      if (!stripMarkers(line)) throw new Error('새 토픽을 만들지 못했어요');
      ai.chatter!.splice(Math.min(index, ai.chatter!.length), 0, line);
    } else {
      const kw = media.keywords.slice(0, 25).map((k) => ({ 키워드: k.word, 다룬매체: k.outlets, 기사수: k.articles, 일면매체수: k.front, 팩트파인더_최근7일: k.oursWeek }));
      const have = (ai.ideas ?? []).map((i) => `- ${i.keyword}: ${i.headline}`).join('\n') || '(없음)';
      const prompt = `${tone}
팩트파인더는 보수 성향 언론으로 **집권 더불어민주당 정부와 대통령에 대한 비판적 시각이 기본 편집 기조**입니다(특정 정당 지지·옹호 문장은 금지, 기계적 중립 조언 금지).
아래 키워드 집계와 기사 제목 목록에서 **오늘 팩트파인더가 쓸 만한 새 기사 아이디어 하나**를 만드세요. 여러 매체가 다뤘는데 우리가 최근 7일 안 쓴 이슈를 우선합니다. 정부·대통령의 책임, 해명이 필요한 대목, 말과 행동의 불일치를 먼저 보는 각도로 잡으세요.
- priority: 1(여러 매체가 다뤘는데 우리가 안 쓴 이슈)·2(한두 매체가 강하게 다뤘거나 댓글이 몰린 이슈)·3(우리 옛 기사와 이어지는 후속감) 중 하나
- keyword: 키워드 집계의 단어 그대로(가능하면). issue: 어떤 사건인지 한 줄(인물·기관·사건명 포함, 위 말투)
- headline: 실제로 달 수 있는 평범한 기사 제목(30자 안팎, 수다체 금지). angle: 다른 매체와 차별화할 구체적 취재·분석 각도(위 말투)
- evidence: 근거를 숫자로 — 예) "조선·동아 1면, 중앙 많이 본 뉴스 2위"
데이터에 없는 사실을 지어내지 마세요. 기자 이름은 지목하지 마세요.
이미 있는 아이디어와 이전에 지운 주제는 피하세요.
이미 있는 아이디어:
${have}
지운 주제:
${dismissed}
출력은 JSON 객체 하나만(설명·코드블록 금지): {"priority": 1, "keyword": "", "issue": "", "headline": "", "angle": "", "evidence": ""}

키워드 집계:
${JSON.stringify(kw)}

기사 제목 목록:
${heads}`;
      const p = parseJson(await generateText(prompt, { temperature: 0.5 }));
      const keyword = String(p?.keyword ?? '').trim();
      if (!keyword || !String(p?.headline ?? '').trim()) throw new Error('새 토픽을 만들지 못했어요');
      const idea: ArticleIdea = {
        priority: Math.min(3, Math.max(1, Number(p.priority) || 3)),
        keyword,
        issue: String(p.issue ?? ''),
        headline: String(p.headline ?? ''),
        angle: String(p.angle ?? ''),
        evidence: String(p.evidence ?? ''),
        refs: refsForKeyword(media, keyword),
      };
      ai.ideas!.splice(Math.min(index, ai.ideas!.length), 0, idea);
    }
    await save();
    return report;
  } catch (e) {
    await save(); // 지우기는 반영해 둠
    throw e;
  }
}
