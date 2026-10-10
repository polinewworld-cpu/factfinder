import { prisma } from '@/lib/prisma';

// 편집실 AI 페르소나(김정신 특파원·오진실 기자)의 프로필 사진 주소 — 편집장이 관리 화면에서 올림 (2026-10-10)
// AnalyticsSnapshot 표에 id '0-fa-…'로 저장(방문 분석 화면은 날짜 id 내림차순 첫 줄을 쓰므로 '0'으로 시작해 섞이지 않음).
// 'kim'은 먼저 만든 김정신 특파원이 쓰던 id('0-fa-avatar')를 그대로 써서 이미 올린 사진이 유지됨.
export const PERSONA_KEYS = ['kim', 'oh'] as const;
export type PersonaKey = (typeof PERSONA_KEYS)[number];

const ID: Record<PersonaKey, string> = { kim: '0-fa-avatar', oh: '0-fa-oh' };

export async function getPersonaAvatar(key: PersonaKey): Promise<string | null> {
  const row = await prisma.analyticsSnapshot.findUnique({ where: { id: ID[key] } });
  const url = (row?.data as any)?.url;
  return typeof url === 'string' ? url : null;
}

export async function setPersonaAvatar(key: PersonaKey, url: string) {
  await prisma.analyticsSnapshot.upsert({
    where: { id: ID[key] },
    update: { data: { url } as any, createdAt: new Date() },
    create: { id: ID[key], data: { url } as any },
  });
}
