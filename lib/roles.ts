// 회원 등급 상수 — 로그인 사용자의 등급은 lib/session.ts(getCurrentUser)에서 확인
export const ROLES = {
  READER: 'READER',
  DONOR_READER: 'DONOR_READER',
  REPORTER: 'REPORTER',
  COLUMNIST: 'COLUMNIST',
  CHIEF_EDITOR: 'CHIEF_EDITOR',
} as const;

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
