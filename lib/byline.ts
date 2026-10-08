// 기자 이름 표시 규칙 (2026-10-08)
//  · 이름 = 닉네임 우선(구글 계정 이름이 "NamHoon Kim"처럼 영문인 경우가 있어 사이트에서 정한 닉네임을 씀)
//  · 직함 = 논설위원 등급은 "논설위원", 그 외 "기자". "인터넷뉴스팀", "팩트파인더"처럼 팀·매체 이름이면 직함 없이
type Author = { name: string; nickname?: string | null; role?: string | null };

export const authorName = (a: Author) => (a.nickname?.trim() || a.name).trim();

export function bylineOf(a: Author) {
  const name = authorName(a);
  if (/(팀|파인더)$/.test(name)) return name;
  return `${name} ${a.role === 'COLUMNIST' ? '논설위원' : '기자'}`;
}

// 옛 사이트 이관용 임시 기자 계정 — 내부 이메일(…@legacy.invalid)은 화면에 보이면 안 됨
export const isLegacyEmail = (email?: string | null) => !!email && email.endsWith('@legacy.invalid');
