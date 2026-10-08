import { prisma } from '@/lib/prisma';
import { gaConfigured } from '@/lib/ga';
import { buildAnalyticsReport, type AnalyticsReport } from '@/lib/gaReport';
import { analyzeWithGemini, geminiConfigured } from '@/lib/geminiAnalysis';
import { buildMediaWatch } from '@/lib/mediaWatch';

// 하루 한 번 만든 방문 분석 보고서를 DB에 저장해 두고 재사용 (2026-10-08)
// 자동화: 10분마다 오는 잠들기 방지 핑(/api/health)이 한국시간 오전 6시 이후 그날 보고서가 없으면 만들어 둔다.
// 2026-10-09: 매체 동향(오늘의 키워드·지면)과 기사 아이디어는 3시간마다(06~23시) 새로 받아 같은 보고서에 덮어쓴다.

const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const kstHour = () => new Date(Date.now() + 9 * 3600_000).getUTCHours();
const MEDIA_EVERY_MS = 3 * 3600_000 - 5 * 60_000; // 핑 간격(10분) 오차 감안

let inFlight: Promise<AnalyticsReport> | null = null;

function single(job: () => Promise<AnalyticsReport>): Promise<AnalyticsReport> {
  if (!inFlight) {
    inFlight = job().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

// 매체 동향 + 기사 아이디어를 report에 채움 — 실패해도 나머지는 그대로
async function attachMediaAndIdeas(report: AnalyticsReport) {
  report.mediaCheckedAt = new Date().toISOString();
  try {
    report.media = await buildMediaWatch();
    report.mediaError = null;
  } catch (e) {
    report.mediaError = e instanceof Error ? e.message : '매체 동향 수집 실패';
  }
  if (geminiConfigured()) {
    try {
      report.ai = await analyzeWithGemini(report, report.media ?? null);
      report.aiError = null;
    } catch (e) {
      // 새로 못 만들면 이전 아이디어는 남겨 둠
      report.aiError = e instanceof Error ? e.message : '자동 분석 실패';
    }
  }
}

async function save(report: AnalyticsReport) {
  const id = kstToday();
  await prisma.analyticsSnapshot.upsert({
    where: { id },
    update: { data: report as any, createdAt: new Date() },
    create: { id, data: report as any },
  });
  return report;
}

export function buildAndSaveToday(): Promise<AnalyticsReport> {
  return single(async () => {
    const report = await buildAnalyticsReport();
    await attachMediaAndIdeas(report);
    return save(report);
  });
}

// 오늘의 키워드·지면·기사 아이디어만 새로 (방문 숫자는 하루 한 번 그대로)
export function refreshMediaToday(): Promise<AnalyticsReport> {
  return single(async () => {
    const snap = await prisma.analyticsSnapshot.findUnique({ where: { id: kstToday() } });
    const report = snap ? (snap.data as unknown as AnalyticsReport) : await buildAnalyticsReport();
    await attachMediaAndIdeas(report);
    return save(report);
  });
}

export async function latestSnapshot() {
  return prisma.analyticsSnapshot.findFirst({ orderBy: { id: 'desc' } });
}

// /api/health에서 호출 — 기다리지 않고(응답 지연 없음) 필요할 때만 백그라운드로 생성
export function ensureDailySnapshot() {
  if (!gaConfigured() || kstHour() < 6 || inFlight) return;
  prisma.analyticsSnapshot
    .findUnique({ where: { id: kstToday() } })
    .then((snap) => {
      if (!snap) return buildAndSaveToday();
      const r = snap.data as unknown as AnalyticsReport;
      const last = Date.parse(r.mediaCheckedAt ?? r.media?.generatedAt ?? r.generatedAt);
      if (!(Date.now() - last < MEDIA_EVERY_MS)) return refreshMediaToday();
      return null;
    })
    .catch(() => {});
}
