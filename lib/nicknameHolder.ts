import { prisma } from '@/lib/prisma';

// 닉네임이 이미 쓰이고 있을 때 "누가" 쓰는지 알려줌 (2026-10-10)
// 숨긴(ghost) 옛 사이트 기자 계정도 닉네임을 계속 차지해서, 회원 목록 어디에도 없는데 "이미 있다"고만 나오던 문제.
// 옛 기자 임시 계정(…@legacy.invalid)이면 그 기사를 새 회원 계정으로 합칠 수 있게 정보를 같이 돌려준다.
export async function nicknameHolder(nickname: string, excludeUserId: string) {
  const holder = await prisma.user.findFirst({
    where: { nickname, NOT: { id: excludeUserId } },
    select: { id: true, name: true, email: true, ghost: true, _count: { select: { articles: true } } },
  });
  if (!holder) return null;
  const legacy = holder.email.endsWith('@legacy.invalid');
  const articles = holder._count.articles;
  const where = legacy
    ? `${holder.ghost ? '목록에서 숨긴 ' : ''}옛 사이트 기자·기고자 계정 "${holder.name}"(기사 ${articles.toLocaleString()}건)`
    : `다른 회원 "${holder.name}"`;
  return {
    message: `"${nickname}" 닉네임은 ${where}이 쓰고 있습니다`,
    conflict: { id: holder.id, name: holder.name, legacy, hidden: holder.ghost, articleCount: articles },
  };
}
