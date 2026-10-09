import { prisma } from '@/lib/prisma';
import { toFrenchBrackets } from '@/lib/frenchBrackets';

// 이번 주(월~일) 범위 계산 — 뉴스레터 관리 화면의 기본 선택 범위 (기능정의서 6)
export function currentWeekRange(reference = new Date()) {
  const day = reference.getDay(); // 0(일)~6(토)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function siteBaseUrl() {
  return process.env.NEXTAUTH_URL || 'http://localhost:3411';
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 2026-10-09: 자동 "이번 주 전체" 대신 편집장이 고른 기사 + 인사말로 만든다 (관리자 → 뉴스레터 관리)
export async function selectedArticles(ids: string[]) {
  if (!ids.length) return [];
  return prisma.article.findMany({
    where: { id: { in: ids }, status: 'PUBLISHED' },
    include: { author: true, category: true },
    orderBy: { publishedAt: 'desc' },
  });
}

export async function buildNewsletter(ids: string[], greeting: string) {
  const articles = await selectedArticles(ids);
  const base = siteBaseUrl();
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '.');
  const subject = `[팩트파인더 뉴스레터] ${today}`;

  const itemsHtml = articles
    .map(
      (a) => `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid #eee;">
          <a href="${base}/article/${a.id}" style="font-size:16px;font-weight:700;color:#111;text-decoration:none;">${toFrenchBrackets(a.title)}</a>
          <p style="margin:6px 0 0;color:#666;font-size:13px;">${a.author.nickname || a.author.name}${a.category ? ` · ${a.category.name}` : ''}</p>
          ${a.excerpt ? `<p style="margin:8px 0 0;color:#444;font-size:14px;line-height:1.5;">${toFrenchBrackets(a.excerpt)}</p>` : ''}
        </td>
      </tr>`
    )
    .join('');

  const greetingHtml = greeting.trim()
    ? `<div style="margin:0 0 20px;padding:16px;background:#f7f4ee;border-radius:8px;color:#333;font-size:14px;line-height:1.7;">${esc(greeting.trim()).replace(/\n/g, '<br>')}</div>`
    : '';

  const html = `
    <div style="max-width:560px;margin:0 auto;font-family:sans-serif;">
      <h1 style="font-size:20px;">팩트파인더 뉴스레터</h1>
      <p style="color:#888;font-size:13px;">${today}</p>
      ${greetingHtml}
      <table style="width:100%;border-collapse:collapse;">${itemsHtml || '<tr><td>선택한 기사가 없습니다.</td></tr>'}</table>
      <p style="margin-top:24px;color:#aaa;font-size:11px;">이 메일은 뉴스레터를 구독 신청한 회원에게 발송되었습니다.</p>
    </div>`;

  return { articles, subject, html };
}

// 인사말 자동 작성용 — 기사 본문을 글자만 남겨 앞부분만
export function plainText(html: string, max = 1200) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
