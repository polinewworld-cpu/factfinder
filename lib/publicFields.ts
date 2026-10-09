import type { Prisma } from '@prisma/client';
import { stripHtml } from '@/lib/stripHtml';

// 공개 화면·공개 API로 내보내는 기자 정보 (2026-10-09 보안 점검)
// `author: true`로 통째로 넘기면 이메일·정산 계좌(bankName/bankAccount/accountHolder)·옛 기자 연결 이메일까지
// 방문자 브라우저(HTML 안 데이터)로 그대로 실려 나간다 — 공개용은 반드시 이 select만 쓸 것.
export const PUBLIC_AUTHOR_SELECT = {
  id: true,
  name: true,
  nickname: true,
  role: true,
  writerTitle: true,
  image: true,
} as const satisfies Prisma.UserSelect;

// 기사 카드(홈·카테고리·키워드·검색·저장한 기사)에 필요한 필드만 — 본문 전체(content)는 카드에 안 쓰므로
// DB에서는 받되 아래 toCardArticle에서 사진 없는 카드 배경 문장용 앞부분만 남긴다.
export const CARD_ARTICLE_SELECT = {
  id: true,
  title: true,
  cardTitle: true,
  content: true,
  excerpt: true,
  hoverText: true,
  themeTags: true,
  coverImageUrl: true,
  coverFocalX: true,
  coverFocalY: true,
  coverFeatureFocalX: true,
  coverFeatureFocalY: true,
  coverSecondFocalX: true,
  coverSecondFocalY: true,
  publishedAt: true,
  author: { select: PUBLIC_AUTHOR_SELECT },
  keywords: { select: { name: true } },
  category: { select: { name: true } },
} as const satisfies Prisma.ArticleSelect;

type CardRow = Prisma.ArticleGetPayload<{ select: typeof CARD_ARTICLE_SELECT }>;

// 카드가 본문을 쓰는 곳은 "사진 없는 카드"의 움직이는 배경 문장(최대 11줄×70자)뿐 — 그만큼만 남김
const CARD_TEXT_MAX = 1500;
export function toCardArticle<T extends CardRow>(a: T): T {
  return { ...a, content: a.coverImageUrl ? null : stripHtml(a.content ?? '').slice(0, CARD_TEXT_MAX) } as T;
}
