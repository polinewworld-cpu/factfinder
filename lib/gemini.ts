// 제미나이 글 생성 공용 함수 (2026-10-09) — 뉴스레터 인사말 등 짧은 평문용.
// 붐빌 때(429·500·503) 잠깐 쉬고 재시도, 그래도 안 되면 가벼운 모델로 전환. 키: Render 환경변수 GEMINI_API_KEY
// (방문 분석의 구조화 응답은 lib/geminiAnalysis.ts가 따로 처리)

export function geminiReady() {
  return !!process.env.GEMINI_API_KEY;
}

export async function generateText(prompt: string, { temperature = 0.6 } = {}): Promise<string> {
  const models = [...new Set([process.env.GEMINI_MODEL || 'gemini-3.6-flash', 'gemini-3.5-flash-lite'])];
  let lastError = '';
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 5000));
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature } }),
        signal: AbortSignal.timeout(60_000),
      }).catch((e) => {
        lastError = e instanceof Error ? e.message : String(e);
        return null;
      });
      if (!res) continue;
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = (body.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('').trim();
        if (text) return text;
        lastError = '빈 답변';
        continue;
      }
      lastError = body.error?.message ?? `HTTP ${res.status}`;
      if (![429, 500, 503].includes(res.status)) throw new Error(`자동 작성 실패: ${lastError}`);
    }
  }
  throw new Error(`자동 작성 실패: ${lastError}`);
}
