// Resend(https://resend.com) API를 통한 이메일 발송 (기능정의서 6)
// 무료 요금제(월 3,000건 수준)로 초기 구독자 규모라면 사실상 무료 운영 가능 — 정확한 금액은 구독자 수 기준으로 재확인 필요.
// 실제 발송에는 RESEND_API_KEY, NEWSLETTER_FROM_EMAIL 환경변수가 필요함. 설정 전에는 발송 시도 시 에러를 반환.
export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY && !!process.env.NEWSLETTER_FROM_EMAIL;
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NEWSLETTER_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error('이메일 발송 설정(RESEND_API_KEY, NEWSLETTER_FROM_EMAIL 환경변수)이 되어있지 않습니다');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`이메일 발송 실패 (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

// 여러 명에게 개별 발송 (수신자끼리 이메일 주소가 노출되지 않도록 건별 발송) — 동시 처리 개수를 제한해 요청 폭주 방지
export async function sendEmailBatch(
  recipients: string[],
  { subject, html }: { subject: string; html: string },
  concurrency = 10
) {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i += concurrency) {
    const chunk = recipients.slice(i, i + concurrency);
    const results = await Promise.allSettled(chunk.map((to) => sendEmail({ to, subject, html })));
    for (const r of results) {
      if (r.status === 'fulfilled') sent += 1;
      else failed += 1;
    }
  }
  return { sent, failed };
}
