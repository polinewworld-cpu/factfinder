import { NextRequest, NextResponse } from 'next/server';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { selectedArticles, plainText } from '@/lib/newsletter';
import { generateText, geminiReady } from '@/lib/gemini';
import { toFrenchBrackets } from '@/lib/frenchBrackets';

// 뉴스레터 인사말 자동 작성 (2026-10-09) — 고른 기사들의 내용을 간략히 정리한 인사말 초안. 편집장이 고쳐 쓰는 용도.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '편집장만 쓸 수 있습니다' }, { status: 403 });
  if (!geminiReady()) return NextResponse.json({ error: '자동 작성 키(GEMINI_API_KEY)가 설정되지 않았습니다' }, { status: 400 });

  const { ids } = await req.json().catch(() => ({}));
  const articles = await selectedArticles(Array.isArray(ids) ? ids.map(String).slice(0, 20) : []);
  if (!articles.length) return NextResponse.json({ error: '기사를 하나 이상 고르세요' }, { status: 400 });

  const list = articles
    .map((a, i) => `[${i + 1}] 제목: ${toFrenchBrackets(a.title)}\n본문(앞부분): ${plainText(a.content, articles.length > 10 ? 600 : 1200)}`)
    .join('\n\n');

  const prompt = `당신은 인터넷신문 "팩트파인더"(정치·사회 중심)의 편집장입니다. 구독자에게 보내는 뉴스레터 맨 앞 인사말을 쓰세요.
아래는 이번 뉴스레터에 담는 기사들입니다. 각 기사의 핵심을 간략히 정리해 인사말에 녹이세요.

형식:
- 첫 문장: 구독자에게 건네는 짧은 인사 (예: "구독자 여러분, 안녕하세요. 팩트파인더입니다.")
- 이어서 2~3개 문단: 기사들의 핵심 내용을 한두 문장씩, 비슷한 주제는 묶어서 자연스럽게
- 마지막 문장: 짧은 맺음말
- 전체 400~700자, 존댓말, 평문(마크다운·글머리표·이모지·따옴표 강조 없이)

규칙: 기사에 없는 사실을 만들지 말 것. 특정 정당·정치인을 지지하거나 비난하는 표현 없이 담담하게. 과장 금지.

기사:
${list}`;

  try {
    const greeting = (await generateText(prompt)).replace(/\*\*/g, '').trim();
    return NextResponse.json({ greeting });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '자동 작성에 실패했습니다' }, { status: 502 });
  }
}
