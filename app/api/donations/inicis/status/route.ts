import { NextResponse } from 'next/server';
import { INICIS_MID, inicisKeyStatus } from '@/lib/inicis';

// 결제 키 점검 — Render에 넣은 INICIS_SIGN_KEY가 이 상점(MID)의 키가 맞는지만 알려줌. 키 자체는 절대 응답하지 않음 (2026-10-08)
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ mid: INICIS_MID, ...inicisKeyStatus() });
}
