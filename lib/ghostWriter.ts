import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import type { WriterKind } from '@prisma/client';

// 로그인 없는 필자 (2026-10-10 사장님 재정의) — 계정은 이메일 …@legacy.invalid, 종류는 User.writerKind
//  · 비회원 기자(NONMEMBER): 원고를 보내면 편집장이 올리고 글쓴이·직함·사진만 바꿔 줌 → 글쓰기 고르기 창에 나옴, 원고료 정산 대상
//  · 돌아올 기자(RETURNING): 예전에 로그인해 쓰던 기자 → 가입·로그인하면 옛 기사와 연결(옛 기자 연결 화면)
//  · 유령기자(GHOST): 과거 1회성, 끊어진 기자 → 지난 기사에 이름만 남음. 새로 등록하지 않음
// 실제로 로그인하는 기자는 writerKind 없음. (User.ghost=true는 "삭제한" 계정 — 기사엔 이름만 남고 어디에도 안 나옴)
// 이름 중복 허용 (2026-10-10 사장님) — 같은 이름이 여럿이어도 됨

export const LOGINLESS_SUFFIX = '@legacy.invalid';
export const isLoginlessEmail = (email?: string | null) => !!email && email.endsWith(LOGINLESS_SUFFIX);

export const WRITER_KINDS: WriterKind[] = ['NONMEMBER', 'RETURNING', 'GHOST'];
export const WRITER_KIND_LABEL: Record<WriterKind, string> = { NONMEMBER: '비회원 기자', RETURNING: '돌아올 기자', GHOST: '유령기자' };

/** 삭제하지 않은 로그인 없는 필자 (종류 무관) */
export const LOGINLESS_WHERE = { email: { endsWith: LOGINLESS_SUFFIX }, ghost: false } as const;
export const kindWhere = (kind: WriterKind) => ({ ...LOGINLESS_WHERE, writerKind: kind });

export const MEMO_MAX = 20; // 편집장 메모(구분용) 글자 수 (2026-10-10)

export async function createNonMemberWriter(name: string, writerTitle?: string | null, image?: string | null, memo?: string | null) {
  const clean = name.trim().slice(0, 30);
  if (!clean) throw new Error('이름을 입력하세요');
  return prisma.user.create({
    data: {
      email: `writer-${randomBytes(6).toString('hex')}${LOGINLESS_SUFFIX}`,
      name: clean,
      nickname: clean,
      role: 'REPORTER',
      writerKind: 'NONMEMBER',
      writerTitle: writerTitle?.trim() || null,
      image: image?.trim() || null,
      writerMemo: memo?.trim().slice(0, MEMO_MAX) || null,
    },
  });
}

// 글쓰기 화면에서 고른 id가 비회원 기자인지
export async function validNonMemberWriterId(id: unknown): Promise<string | null> {
  if (typeof id !== 'string' || !id) return null;
  const u = await prisma.user.findFirst({ where: { id, ...kindWhere('NONMEMBER') }, select: { id: true } });
  return u?.id ?? null;
}
