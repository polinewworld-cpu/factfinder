import { prisma } from '@/lib/prisma';

// 옛 사이트 기자 승계 (2026-10-08)
// 옛 기사는 로그인 불가 임시 기자 계정(…@legacy.invalid)에 들어 있다. 실제 계정으로 합치면
// 기사·후원 지정이 옮겨지고, 독자 등급이면 기자로 올려 "기자 지위"를 그대로 이어받게 한다.

export const LEGACY_EMAIL = { endsWith: '@legacy.invalid' };
export const isLegacyAccount = (email?: string | null) => !!email && email.endsWith('@legacy.invalid');

export async function mergeLegacyReporter(legacyId: string, targetId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } });
  const [articles] = await prisma.$transaction([
    prisma.article.updateMany({ where: { authorId: legacyId }, data: { authorId: targetId } }),
    prisma.donation.updateMany({ where: { reporterId: legacyId }, data: { reporterId: targetId } }),
    prisma.user.delete({ where: { id: legacyId } }),
    // 독자(또는 옛 후원독자)였다면 기자로 — 편집장·논설위원 등 이미 높은 등급은 그대로
    ...(target && (target.role === 'READER' || target.role === 'DONOR_READER')
      ? [prisma.user.update({ where: { id: targetId }, data: { role: 'REPORTER' } })]
      : []),
  ]);
  return articles.count;
}

// 로그인할 때마다 호출 — 미리 등록해 둔 구글 이메일과 같으면 자동 승계하고, 바뀐 등급을 돌려줌
export async function claimLegacyReporterOnLogin(userId: string, email?: string | null) {
  if (!email || isLegacyAccount(email)) return null;
  const legacy = await prisma.user.findMany({
    where: { ...{ email: LEGACY_EMAIL }, legacyClaimEmail: email.toLowerCase() },
    select: { id: true },
  });
  if (legacy.length === 0) return null;
  for (const l of legacy) await mergeLegacyReporter(l.id, userId);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role ?? null;
}
