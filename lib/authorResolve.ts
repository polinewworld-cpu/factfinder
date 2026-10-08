import { prisma } from '@/lib/prisma';

// 글쓴이 지정 (2026-10-08) — 편집장이 글쓰기 화면 "글쓴이" 칸에 이름을 적으면 그 사람 이름으로 기사가 나가고,
// 후원·정산도 그 사람 앞으로 쌓인다(외부 기고 등).
//  · 같은 이름(닉네임 우선)의 기존 회원·기자가 있으면 그 계정
//  · 없으면 로그인 불가 "기고자 계정"(…@legacy.invalid, 기자 등급)을 새로 만들어 연결 — 옛 기자와 같은 방식이라
//    나중에 그 사람이 가입하면 관리자 [옛 기자 연결]에서 이메일 등록·연결로 승계 가능
export async function resolveAuthorByName(rawName: unknown): Promise<string | null> {
  const name = typeof rawName === 'string' ? rawName.trim().slice(0, 30) : '';
  if (!name) return null;

  const candidates = await prisma.user.findMany({
    where: { ghost: false, OR: [{ nickname: name }, { name }] },
    select: { id: true, nickname: true, role: true },
  });
  const byNickname = candidates.filter((c) => c.nickname === name);
  const pool = byNickname.length ? byNickname : candidates;
  const writer = pool.find((c) => ['REPORTER', 'COLUMNIST', 'CHIEF_EDITOR'].includes(c.role));
  if (writer ?? pool[0]) return (writer ?? pool[0]).id;

  // 새 기고자 — 예전에 유령 처리된 같은 이름 계정이 있으면 되살려 씀
  const email = `legacy-${Buffer.from(name).toString('hex')}@legacy.invalid`;
  const user = await prisma.user.upsert({
    where: { email },
    update: { ghost: false },
    create: { email, name, nickname: name, role: 'REPORTER' },
    select: { id: true },
  });
  return user.id;
}
