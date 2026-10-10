import { NextRequest, NextResponse } from 'next/server';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { greetingPrompt, selectedArticles } from '@/lib/newsletter';
import { generateText, geminiReady } from '@/lib/gemini';

// 뉴스레터 인사말 자동 작성 (2026-10-09) — 고른 기사들의 내용을 간략히 정리한 인사말 초안. 편집장이 고쳐 쓰는 용도.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '편집장만 쓸 수 있습니다' }, { status: 403 });
  if (!geminiReady()) return NextResponse.json({ error: '자동 작성 키(GEMINI_API_KEY)가 설정되지 않았습니다' }, { status: 400 });

  const { ids } = await req.json().catch(() => ({}));
  const articles = await selectedArticles(Array.isArray(ids) ? ids.map(String).slice(0, 20) : []);
  if (!articles.length) return NextResponse.json({ error: '기사를 하나 이상 고르세요' }, { status: 400 });

  const prompt = greetingPrompt(articles); // 토요일 자동 발송과 같은 지시문 (lib/newsletter.ts)

  try {
    const greeting = (await generateText(prompt)).replace(/\*\*/g, '').trim();
    return NextResponse.json({ greeting });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '자동 작성에 실패했습니다' }, { status: 502 });
  }
}
