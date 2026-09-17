import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { allowRequest, clientIp } from '@/lib/rateLimit';

// 기사 "추천" 버튼 — 로그인 불필요. 중복 방지는 클라이언트(localStorage) + 서버 쿠키(기사당 1회) 이중으로,
// 스크립트로 연타하는 것 자체는 IP당 분당 횟수 제한으로 막는다 (완벽한 차단은 아니지만 방지선 강화, 2026-09-17)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieKey = `rec_${params.id}`;
  if (req.cookies.get(cookieKey)) {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: { recommendCount: true },
    });
    return NextResponse.json({ recommendCount: article?.recommendCount ?? 0, alreadyRecommended: true });
  }

  if (!allowRequest(`recommend_${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요' }, { status: 429 });
  }

  const updated = await prisma.article.update({
    where: { id: params.id },
    data: { recommendCount: { increment: 1 } },
  });

  const res = NextResponse.json({ recommendCount: updated.recommendCount });
  res.cookies.set(cookieKey, '1', { maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: 'lax' });
  return res;
}
