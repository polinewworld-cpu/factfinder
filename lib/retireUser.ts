import { prisma } from '@/lib/prisma';

// 기사가 있는 계정을 "삭제"할 때 쓰는 값 (2026-10-10 사장님: 삭제는 영원히, 나간 기사엔 기자 이름만 남으면 됨)
//  · 계정 행은 기사 글쓴이로 필요해서 남기되 목록·로그인에서 영구히 빠짐(ghost=true, 되살리기 없음)
//  · 바이라인은 그대로 — 표시 이름(닉네임 우선)을 name에 옮겨 둠
//  · 닉네임은 비워서 같은 이름으로 새 회원·새 유령기자를 등록할 수 있게(예전엔 숨긴 계정이 이름을 계속 차지했음)
//  · 정산 계좌·옛 기자 연결 이메일은 지움
export async function retiredUserData(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, nickname: true } });
  return {
    ghost: true,
    name: u?.nickname?.trim() || u?.name || '',
    nickname: null,
    legacyClaimEmail: null,
    bankName: null,
    bankAccount: null,
    accountHolder: null,
  };
}

// 유령기자·옛 기자 [삭제] — 쓴 기사·후원·사진·댓글 기록이 하나도 없으면 행까지 지우고, 있으면 위 방식으로 영구 정리
export async function deleteOrRetire(userId: string): Promise<{ deleted: boolean; articleCount: number }> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { _count: { select: { articles: true, reporterDonations: true, donations: true, photos: true, comments: true, pollVotes: true } } },
  });
  if (!u) return { deleted: true, articleCount: 0 };
  const c = u._count;
  if (c.articles + c.reporterDonations + c.donations + c.photos + c.comments + c.pollVotes === 0) {
    const removed = await prisma.user.delete({ where: { id: userId } }).then(() => true, () => false);
    if (removed) return { deleted: true, articleCount: 0 };
  }
  await prisma.user.update({ where: { id: userId }, data: await retiredUserData(userId) });
  return { deleted: false, articleCount: c.articles };
}
