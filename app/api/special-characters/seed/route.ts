import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WRITER_ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { SPECIAL_CHAR_SEED } from '@/lib/specialCharSeed';

export const dynamic = 'force-dynamic';

// 특수문자 모달을 처음 열었을 때(등록된 문자가 거의 없을 때) 프론트에서 1회성으로 호출하는 기본 세트 시딩.
// (char, category) 조합이 이미 있으면 건너뛰므로 여러 번 호출해도 안전함(idempotent) — 별도의 수동 실행이나
// 셸 접근이 필요한 시드 스크립트 없이도, 누구든 모달을 한 번 열면 자동으로 채워지도록 하기 위함.
export async function POST() {
  const user = await getCurrentUser();
  if (!user || !WRITER_ROLES.includes(user.role as any)) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  const existing = await prisma.specialCharacter.findMany({ select: { char: true, category: true } });
  const existingSet = new Set(existing.map((e) => `${e.category}::${e.char}`));
  const toCreate = SPECIAL_CHAR_SEED.filter((s) => !existingSet.has(`${s.category}::${s.char}`));

  if (toCreate.length === 0) return NextResponse.json({ created: 0 });

  await prisma.specialCharacter.createMany({ data: toCreate });
  return NextResponse.json({ created: toCreate.length });
}
