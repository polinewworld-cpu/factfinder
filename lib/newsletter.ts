import { prisma } from '@/lib/prisma';

// 이번 주(월~일) 범위 계산 — 별도 지정 없으면 이 범위로 자동 발행 (기능정의서 6)
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

// 해당 주에 발행된 기사 전체 + 발췌 노출 — 관리자가 수동으로 고르지 않는 자동 생성 방식 (기능정의서 6)
export async function buildWeeklyDigest(start: Date, end: Date) {
  const articles = await prisma.article.findMany({
    where: { status: 'PUBLISHED', publishedAt: { gte: start, lte: end } },
    include: { author: true, category: true },
    orderBy: { publishedAt: 'desc' },
  });

  const base = siteBaseUrl();
  const dateLabel = `${start.toLocaleDateString('ko-KR')} ~ ${end.toLocaleDateString('ko-KR')}`;
  const subject = `[팩트파인더 주간뉴스레터] ${dateLabel}`;

  const itemsHtml = articles
    .map(
      (a) => `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid #eee;">
          <a href="${base}/article/${a.id}" style="font-size:16px;font-weight:700;color:#111;text-decoration:none;">${a.title}</a>
          <p style="margin:6px 0 0;color:#666;font-size:13px;">${a.author.name}${a.category ? ` · ${a.category.name}` : ''}</p>
          ${a.excerpt ? `<p style="margin:8px 0 0;color:#444;font-size:14px;line-height:1.5;">${a.excerpt}</p>` : ''}
        </td>
      </tr>`
    )
    .join('');

  const html = `
    <div style="max-width:560px;margin:0 auto;font-family:sans-serif;">
      <h1 style="font-size:20px;">팩트파인더 주간뉴스레터</h1>
      <p style="color:#888;font-size:13px;">${dateLabel}에 발행된 기사 모음입니다.</p>
      <table style="width:100%;border-collapse:collapse;">${itemsHtml || '<tr><td>이번 주 발행된 기사가 없습니다.</td></tr>'}</table>
      <p style="margin-top:24px;color:#aaa;font-size:11px;">이 메일은 뉴스레터를 구독 신청한 회원에게 발송되었습니다.</p>
    </div>`;

  return { articles, subject, html };
}
