// 뉴스레터 수신거부 결과 (2026-10-10)
export const metadata = { title: '뉴스레터 수신거부 - 팩트파인더', robots: { index: false } };

export default function UnsubscribedPage({ searchParams }: { searchParams: { error?: string } }) {
  const failed = searchParams.error === '1';
  return (
    <main className="content" style={{ maxWidth: 560, margin: '0 auto', padding: '64px 16px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{failed ? '수신거부 링크가 올바르지 않습니다' : '뉴스레터 수신을 해지했습니다'}</h1>
      <p style={{ color: '#666', lineHeight: 1.7 }}>
        {failed
          ? '메일에 있는 링크를 다시 눌러 주시거나, 로그인 후 내 정보에서 뉴스레터 받기를 끄실 수 있습니다.'
          : '더 이상 팩트파인더 뉴스레터를 보내지 않습니다. 다시 받고 싶으시면 로그인 후 내 정보에서 켜 주세요.'}
      </p>
      <p style={{ marginTop: 24 }}>
        <a href="/" style={{ color: 'var(--accent)', fontWeight: 600 }}>팩트파인더 홈으로</a>
      </p>
    </main>
  );
}
