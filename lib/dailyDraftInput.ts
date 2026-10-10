import type { CastDraft, DailyDraft, PersonaDraft } from '@/lib/dailyNewsletter';

// 관리자가 고친 초안(JSON)을 받아 모양·길이를 확인해 안전하게 정리 (2026-10-10)
const str = (v: unknown, max: number) => String(v ?? '').slice(0, max);
const lines = (v: unknown, maxLines: number, maxLen: number) =>
  (Array.isArray(v) ? v : []).map((x) => str(x, maxLen).trim()).filter(Boolean).slice(0, maxLines);

function persona(v: any): PersonaDraft | null {
  if (!v || typeof v !== 'object') return null;
  return { intro: str(v.intro, 2000).trim(), lines: lines(v.lines, 30, 600), closing: str(v.closing, 1000).trim() };
}

export function sanitizeDraft(raw: any): DailyDraft | null {
  if (!raw || typeof raw !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(String(raw.dateKey))) return null;
  const casts: CastDraft[] = (Array.isArray(raw.casts) ? raw.casts : [])
    .slice(0, 6)
    .filter((c: any) => /^[\w-]{6,20}$/.test(String(c?.youtubeId)) && /^https:\/\//.test(String(c?.thumbnailUrl)))
    .map((c: any) => ({
      youtubeId: String(c.youtubeId),
      title: str(c.title, 200).trim(),
      thumbnailUrl: String(c.thumbnailUrl).slice(0, 500),
      time: str(c.time, 20),
      bullets: lines(c.bullets, 8, 400),
      source: ['video', 'description', 'none'].includes(c.source) ? c.source : 'none',
      include: c.include !== false,
    }));
  return {
    dateKey: String(raw.dateKey),
    createdAt: str(raw.createdAt, 40) || new Date().toISOString(),
    greeting: str(raw.greeting, 1000).trim(),
    full: !!raw.full,
    oh: persona(raw.oh),
    kim: persona(raw.kim),
    casts,
    articleIds: (Array.isArray(raw.articleIds) ? raw.articleIds : []).map((x: unknown) => String(x)).filter((x: string) => /^[\w-]{5,40}$/.test(x)).slice(0, 10),
  };
}
