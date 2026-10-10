import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { buildNewsletter, personalize, subscribers as subscriberList } from '@/lib/newsletter';
import { gmailStatus, sendGmailBatch } from '@/lib/gmail';

// 뉴스레터 실제 발송 — 편집장이 고른 기사 + 인사말, 옵트인한 회원 전체 대상 (기능정의서 6, 2026-10-09 선택 발송으로 변경)
// 발송은 지메일 API(편집실에서 [지메일 연결] 필요, 2026-10-10). 구독자마다 수신거부 링크가 다른 메일을 한 통씩.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 발송할 수 있습니다' }, { status: 403 });
  }

  if (!(await gmailStatus()).connected) {
    return NextResponse.json({ error: '지메일이 연결되지 않았습니다 (뉴스레터 관리 → 지메일 연결)' }, { status: 400 });
  }
  const { ids, greeting } = await req.json().catch(() => ({}));
  const [{ subject, html, articles }, subscribers] = await Promise.all([
    buildNewsletter(Array.isArray(ids) ? ids.map(String) : [], String(greeting ?? '')),
    subscriberList(),
  ]);

  if (articles.length === 0) return NextResponse.json({ error: '보낼 기사를 하나 이상 고르세요' }, { status: 400 });
  if (subscribers.length === 0) return NextResponse.json({ error: '구독자가 없습니다' }, { status: 400 });

  const { sent, failed, firstError } = await sendGmailBatch(subscribers, (to) => ({ subject, html: personalize(html, to.unsubscribeUrl) }));
  // 기록용 기간 = 고른 기사들의 발행일 범위
  const dates = articles.map((a) => (a.publishedAt ?? a.createdAt).getTime());
  await prisma.newsletterSend.create({
    data: { weekStart: new Date(Math.min(...dates)), weekEnd: new Date(Math.max(...dates)), recipientCount: sent, failedCount: failed, subject, status: sent ? 'SENT' : 'FAILED', note: firstError },
  });

  return NextResponse.json({ sent, failed, total: subscribers.length, firstError });
}
