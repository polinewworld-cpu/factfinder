import { createSign } from 'crypto';

// 구글 애널리틱스(GA4) 데이터 읽기 (2026-10-08) — 관리자 "방문 분석" 화면용, 읽기 전용.
// 인증: 구글 클라우드 서비스 계정. Render 환경변수
//   GA_PROPERTY_ID           — GA4 속성 번호(숫자)
//   GA_SERVICE_ACCOUNT_JSON  — 서비스 계정 키 JSON 파일 내용 전체(비밀값, 코드·문서에 적지 말 것)
// 서비스 계정 이메일은 GA 속성 [관리 → 속성 액세스 관리]에 "뷰어"로 추가돼 있어야 함.
// 추가 패키지 없이 Node 내장 crypto로 토큰 서명 → REST(analyticsdata v1beta) 호출.

type ServiceAccount = { client_email: string; private_key: string };

export function gaConfigured() {
  return !!process.env.GA_PROPERTY_ID && !!process.env.GA_SERVICE_ACCOUNT_JSON;
}

let cachedToken: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const sa = JSON.parse(process.env.GA_SERVICE_ACCOUNT_JSON ?? '{}') as ServiceAccount;
  if (!sa.client_email || !sa.private_key) throw new Error('GA_SERVICE_ACCOUNT_JSON 형식이 올바르지 않습니다');
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`구글 인증 실패: ${data.error_description ?? data.error ?? res.status}`);
  cachedToken = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

export type GaRow = { dims: string[]; mets: number[] };

export type GaQuery = {
  dateRanges: { startDate: string; endDate: string; name?: string }[];
  dimensions?: string[];
  metrics: string[];
  orderBy?: { metric?: string; dimension?: string; desc?: boolean };
  limit?: number;
};

export async function runReport(q: GaQuery): Promise<GaRow[]> {
  const token = await accessToken();
  const body = {
    dateRanges: q.dateRanges,
    dimensions: (q.dimensions ?? []).map((name) => ({ name })),
    metrics: q.metrics.map((name) => ({ name })),
    ...(q.orderBy
      ? {
          orderBys: [
            q.orderBy.metric
              ? { metric: { metricName: q.orderBy.metric }, desc: q.orderBy.desc ?? true }
              : { dimension: { dimensionName: q.orderBy.dimension! }, desc: q.orderBy.desc ?? false },
          ],
        }
      : {}),
    limit: q.limit ?? 10000,
  };
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA_PROPERTY_ID}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`GA 조회 실패: ${data.error?.message ?? res.status}`);
  return (data.rows ?? []).map((r: any) => ({
    dims: (r.dimensionValues ?? []).map((d: any) => d.value as string),
    mets: (r.metricValues ?? []).map((m: any) => Number(m.value)),
  }));
}
