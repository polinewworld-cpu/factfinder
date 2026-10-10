import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

// 유령기자 (2026-10-09 사장님 정의) — 로그인 계정 없이 이름으로만 존재하는 필자.
// 편집장이 자기 계정으로 로그인한 채 외부 기고를 올릴 때 글쓴이로 고르고, 원고료 정산도 이 사람 앞으로.
// 실제 데이터 = 로그인 불가 계정(이메일 …@legacy.invalid, 기자 등급, ghost=false): 옛 사이트 임시 기자 + 글쓴이 칸으로 만든 기고자 + 새로 등록한 유령기자.
// (User.ghost=true는 "삭제해서 목록에서 숨긴" 계정 — 이름이 비슷하지만 다른 개념)

export const GHOST_EMAIL_SUFFIX = '@legacy.invalid';
export const isGhostWriterEmail = (email?: string | null) => !!email && email.endsWith(GHOST_EMAIL_SUFFIX);

export const GHOST_WHERE = { email: { endsWith: GHOST_EMAIL_SUFFIX }, ghost: false } as const;

export async function createGhostWriter(name: string, writerTitle?: string | null, image?: string | null) {
  const clean = name.trim().slice(0, 30);
  if (!clean) throw new Error('이름을 입력하세요');
  // 같은 이름이 이미 있으면 닉네임 충돌 — 숫자를 붙이지 않고 알려 줌
  const holder = await prisma.user.findFirst({ where: { nickname: clean }, select: { id: true, email: true, ghost: true } });
  if (holder?.ghost && holder.email.endsWith(GHOST_EMAIL_SUFFIX)) {
    // 목록에서 숨긴 옛 기자·기고자와 같은 이름 — 같은 사람으로 보고 되살려 씀(옛 기사도 그대로 이 유령기자 것으로, 2026-10-10)
    return prisma.user.update({
      where: { id: holder.id },
      data: { ghost: false, writerTitle: writerTitle?.trim() || null, ...(image?.trim() ? { image: image.trim() } : {}) },
    });
  }
  if (holder) {
    throw new Error(`"${clean}" 이름이 이미 있습니다. 목록에서 고르거나 다른 이름을 쓰세요`);
  }
  return prisma.user.create({
    data: {
      email: `ghost-${randomBytes(6).toString('hex')}${GHOST_EMAIL_SUFFIX}`,
      name: clean,
      nickname: clean,
      role: 'REPORTER',
      writerTitle: writerTitle?.trim() || null,
      image: image?.trim() || null,
    },
  });
}

// 글쓰기 화면에서 고른 유령기자 id가 진짜 유령기자인지
export async function validGhostWriterId(id: unknown): Promise<string | null> {
  if (typeof id !== 'string' || !id) return null;
  const u = await prisma.user.findFirst({ where: { id, ...GHOST_WHERE }, select: { id: true } });
  return u?.id ?? null;
}
