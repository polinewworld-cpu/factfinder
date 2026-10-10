import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validUnsubscribe } from '@/lib/newsletter';
import { SITE_URL } from '@/lib/siteTags';

// 뉴스레터 수신거부 (2026-10-10) — 메일 하단 링크(GET)와 메일 프로그램의 [구독 취소] 버튼(POST, 한 번에 해지) 둘 다
export const dynamic = 'force-dynamic';

async function unsubscribe(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u') ?? '';
  const t = req.nextUrl.searchParams.get('t') ?? '';
  if (!validUnsubscribe(u, t)) return false;
  await prisma.user.updateMany({ where: { id: u }, data: { newsletterOptIn: false } });
  return true;
}

export async function GET(req: NextRequest) {
  const ok = await unsubscribe(req);
  return NextResponse.redirect(`${SITE_URL}/newsletter/unsubscribed${ok ? '' : '?error=1'}`, 303);
}

export async function POST(req: NextRequest) {
  const ok = await unsubscribe(req);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
