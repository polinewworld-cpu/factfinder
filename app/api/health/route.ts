import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureDailySnapshot } from '@/lib/analyticsSnapshot';
import { ensurePhotoCollect } from '@/lib/photoCollector';
import { ensureWeeklyNewsletter } from '@/lib/newsletterAuto';
import { ensureForeignNews } from '@/lib/foreignNews';
import { postNewArticlesToSocial } from '@/lib/socialPost';

// 외부 핑 서비스(cron-job.org 등)가 주기적으로 호출 — Render 무료 인스턴스가 15분 무접속 시 잠드는 것 방지.
// DB도 가볍게 한 번 건드려서 Supabase 연결까지 깨어 있게 유지.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    // 방문 분석 보고서 하루 1회 자동 생성 — 응답은 기다리지 않음 (2026-10-08)
    ensureDailySnapshot();
    // 사진 뱅크 자동 수집기 — 관리자가 정한 주기(기본 1시간)마다 (2026-10-09)
    ensurePhotoCollect();
    // 주간 뉴스레터 — 토요일 아침 7시 이후 첫 핑에 한 번 (2026-10-10)
    ensureWeeklyNewsletter();
    // 외신 추천 — 3시간마다 (2026-10-10)
    ensureForeignNews();
    // SNS 자동 게시 — 새로 발행된 기사를 X·스레드·인스타에 (2026-10-10)
    postNewArticlesToSocial().catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
