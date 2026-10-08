import { prisma } from '@/lib/prisma';
import { gaConfigured } from '@/lib/ga';
import { buildAnalyticsReport, type AnalyticsReport } from '@/lib/gaReport';
import { analyzeWithGemini, geminiConfigured } from '@/lib/geminiAnalysis';

// 하루 한 번 만든 방문 분석 보고서를 DB에 저장해 두고 재사용 (2026-10-08)
// 자동화: 10분마다 오는 잠들기 방지 핑(/api/health)이 한국시간 오전 6시 이후 그날 보고서가 없으면 만들어 둔다.

const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const kstHour = () => new Date(Date.now() + 9 * 3600_000).getUTCHours();

let inFlight: Promise<AnalyticsReport> | null = null;

export async function buildAndSaveToday(): Promise<AnalyticsReport> {
  if (!inFlight) {
    inFlight = (async () => {
      const report = await buildAnalyticsReport();
      // 숫자 보고서에 제미나이 전략 분석을 덧붙임 — 실패해도 숫자 보고서는 저장
      if (geminiConfigured()) {
        try {
          report.ai = await analyzeWithGemini(report);
        } catch (e) {
          report.ai = null;
          report.aiError = e instanceof Error ? e.message : '제미나이 분석 실패';
        }
      }
      const id = kstToday();
      await prisma.analyticsSnapshot.upsert({
        where: { id },
        update: { data: report as any, createdAt: new Date() },
        create: { id, data: report as any },
      });
      return report;
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export async function latestSnapshot() {
  return prisma.analyticsSnapshot.findFirst({ orderBy: { id: 'desc' } });
}

// /api/health에서 호출 — 기다리지 않고(응답 지연 없음) 필요할 때만 백그라운드로 생성
export function ensureDailySnapshot() {
  if (!gaConfigured() || kstHour() < 6 || inFlight) return;
  prisma.analyticsSnapshot
    .findUnique({ where: { id: kstToday() }, select: { id: true } })
    .then((exists) => (exists ? null : buildAndSaveToday()))
    .catch(() => {});
}
