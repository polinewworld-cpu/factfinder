import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 외부 핑 서비스(cron-job.org 등)가 주기적으로 호출 — Render 무료 인스턴스가 15분 무접속 시 잠드는 것 방지.
// DB도 가볍게 한 번 건드려서 Supabase 연결까지 깨어 있게 유지.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
