// 로그인(NextAuth) 붙이기 전까지 임시로 "요청자 역할"을 직접 조회해서 검사.
// 다음 단계(구글 로그인)에서는 세션에서 role을 가져오는 방식으로 교체 예정.
import { prisma } from '@/lib/prisma';

export const ROLES = {
  READER: 'READER',
  DONOR_READER: 'DONOR_READER',
  REPORTER: 'REPORTER',
  COLUMNIST: 'COLUMNIST',
  CHIEF_EDITOR: 'CHIEF_EDITOR',
} as const;

export async function getUserRole(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role ?? null;
}

export async function requireRole(userId: string, allowed: string[]) {
  const role = await getUserRole(userId);
  if (!role || !allowed.includes(role)) {
    throw new Error('FORBIDDEN');
  }
  return role;
}

// intent='autosave' -> 작성 중 임시저장 상태(AUTOSAVE), 목록/피드 어디에도 노출 안 됨
// intent='submit'   -> 기자는 승인대기(DRAFT), 논설위원/편집장은 즉시발행(PUBLISHED)
export function initialStatusForRole(
  role: string,
  intent: 'autosave' | 'submit' = 'submit'
): 'AUTOSAVE' | 'DRAFT' | 'PUBLISHED' {
  if (intent === 'autosave') return 'AUTOSAVE';
  return role === ROLES.REPORTER ? 'DRAFT' : 'PUBLISHED';
}

export const WRITER_ROLES = [ROLES.REPORTER, ROLES.COLUMNIST, ROLES.CHIEF_EDITOR];
