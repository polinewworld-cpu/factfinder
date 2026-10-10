import { prisma } from '@/lib/prisma';
import { buildNewsletter, DEFAULT_GREETING, greetingPrompt, kstDate, personalize, selectedArticles, subscribers, dailyRangeFor, dailyPicks } from '@/lib/newsletter';
import { gmailStatus, sendGmailBatch } from '@/lib/gmail';
import { generateText, geminiReady } from '@/lib/gemini';

// 매일 아침 8시 자동 발송 (2026-10-10 사장님: 주간 → 일간 전환, 완전 자동, 로그인 회원만, 지메일)
// /api/health(10분 핑)가 부를 때마다 확인 → 매일 8시~정오 사이 첫 핑에 한 번만 보냄
// (정오가 지나면 그날은 안 보냄 — 오후에 지메일을 연결했다고 갑자기 나가지 않게). 오전 8시 전에는 안 보냄(밤 9시~아침 8시 광고성 정보 시간 제한 고려).
// 같은 날 두 번 발송 방지: 보내기 전에 NewsletterSend(weekKey = 'd-날짜', 유일)를 먼저 만들어 자리를 차지함.
const SEND_HOUR_KST = 8;
const SEND_UNTIL_KST = 12;
let running = false;

export function ensureDailyNewsletter() {
  const now = new Date(Date.now() + 9 * 3600_000);
  if (running || now.getUTCHours() < SEND_HOUR_KST || now.getUTCHours() >= SEND_UNTIL_KST) return;
  running = true;
  sendDaily(kstDate())
    .catch((e) => console.error('[newsletter] 자동 발송 오류', e))
    .finally(() => {
      running = false;
    });
}

async function sendDaily(dateKey: string) {
  const weekKey = `d-${dateKey}`; // NewsletterSend.weekKey 칸에 날짜별 키로 저장
  const [config, gmail, done] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'singleton' }, select: { newsletterAuto: true, newsletterSkipWeek: true } }),
    gmailStatus(),
    prisma.newsletterSend.findUnique({ where: { weekKey }, select: { id: true } }),
  ]);
  if (done || config?.newsletterAuto === false || !gmail.connected) return; // 지메일 연결 전이면 연결한 뒤 그날 안에 보냄
  const { start, end } = dailyRangeFor(dateKey);

  // 자리 차지 — 이미 있으면(다른 요청이 먼저 시작) 여기서 멈춤
  const claim = await prisma.newsletterSend
    .create({ data: { weekKey, weekStart: start, weekEnd: end, recipientCount: 0, status: 'SENDING', auto: true } })
    .catch(() => null);
  if (!claim) return;
  const finish = (data: { status: string; recipientCount?: number; failedCount?: number; subject?: string; note?: string }) =>
    prisma.newsletterSend.update({ where: { id: claim.id }, data: { ...data, sentAt: new Date() } });

  try {
    if (config?.newsletterSkipWeek === dateKey) return finish({ status: 'SKIPPED', note: '편집장이 오늘 건너뛰기' });
    const ids = await dailyPicks(dateKey);
    if (!ids.length) return finish({ status: 'SKIPPED', note: '지난 24시간 발행 기사 없음' });
    const list = await subscribers();
    if (!list.length) return finish({ status: 'SKIPPED', note: '구독자 없음' });

    // 인사말 — AI 초안, 실패하면 기본 문구
    let greeting = DEFAULT_GREETING;
    if (geminiReady()) {
      const arts = await selectedArticles(ids);
      greeting = await generateText(greetingPrompt(arts)).then((t) => t.replace(/\*\*/g, '').trim() || DEFAULT_GREETING, () => DEFAULT_GREETING);
    }
    const { subject, html } = await buildNewsletter(ids, greeting, dateKey);
    const r = await sendGmailBatch(list, (to) => ({ subject, html: personalize(html, to.unsubscribeUrl) }));
    console.log('[newsletter] 자동 발송', dateKey, `성공 ${r.sent} 실패 ${r.failed}`, r.firstError ?? '');
    await finish({ status: r.sent ? 'SENT' : 'FAILED', recipientCount: r.sent, failedCount: r.failed, subject, note: r.firstError ?? undefined });
  } catch (e) {
    await finish({ status: 'FAILED', note: e instanceof Error ? e.message.slice(0, 300) : '발송 중 오류' }).catch(() => {});
    throw e;
  }
}

