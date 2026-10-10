import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getCurrentUser } from '@/lib/session';
import GoogleSignInButton from './GoogleSignInButton';

// 로그인 화면 (2026-10-10) — NextAuth 기본 화면(영어 "Sign in with Google", 회색 빈 화면) 대신.
// lib/auth.ts pages.signIn = '/login'. 기존 /api/auth/signin 링크도 모두 여기로 옴. 처음 로그인하면 자동 가입 → 닉네임 설정 화면.
export const metadata: Metadata = { title: '로그인 - 팩트파인더', robots: { index: false } };
export const dynamic = 'force-dynamic';

// NextAuth가 ?error= 로 알려주는 실패 사유
const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: '이 이메일은 다른 방식으로 이미 가입되어 있습니다. 처음 가입한 방법으로 로그인해 주세요.',
  AccessDenied: '로그인이 허용되지 않았습니다. 다른 구글 계정으로 시도해 주세요.',
  OAuthCallback: '구글 로그인 중 문제가 생겼습니다. 다시 시도해 주세요.',
  OAuthSignin: '구글 로그인 화면을 열지 못했습니다. 잠시 후 다시 시도해 주세요.',
  Callback: '로그인 처리 중 문제가 생겼습니다. 다시 시도해 주세요.',
  SessionRequired: '로그인이 필요한 화면입니다.',
};

// 로그인 후 돌아갈 곳 — 같은 사이트 주소만 (외부 주소로 튕기지 않게)
function safeCallback(raw?: string | null) {
  if (!raw) return '/';
  try {
    const u = new URL(raw, 'http://x');
    if (raw.startsWith('/') && !raw.startsWith('//')) return u.pathname + u.search;
    const site = new URL(process.env.NEXTAUTH_URL || 'http://localhost:3411');
    return u.host === site.host ? u.pathname + u.search : '/';
  } catch {
    return '/';
  }
}

const PERKS = [
  { icon: '🔖', title: '기사 저장', desc: '다시 읽고 싶은 기사를 모아 둡니다' },
  { icon: '✉️', title: '토요일 뉴스레터', desc: '한 주 주요 기사를 아침에 받아봅니다' },
  { icon: '💬', title: '댓글', desc: '기사에 의견을 남깁니다' },
  { icon: '✍️', title: '기자 신청', desc: '팩트파인더 기자로 함께합니다' },
];

export default async function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string; error?: string } }) {
  // 돌아갈 곳: 지정한 주소 → 없거나 사이트 첫 화면이면 직전에 보던 페이지(Referer) → 홈
  let callbackUrl = safeCallback(searchParams.callbackUrl);
  if (callbackUrl === '/') {
    const ref = safeCallback(headers().get('referer'));
    if (!ref.startsWith('/login') && !ref.startsWith('/api/auth')) callbackUrl = ref;
  }
  if (await getCurrentUser()) redirect(callbackUrl);
  // ?error=google 은 예전 /api/auth/signin/google 링크로 들어온 것일 뿐 실패가 아님
  const code = searchParams.error && searchParams.error !== 'google' ? searchParams.error : null;
  const error = code ? ERRORS[code] ?? '로그인에 실패했습니다. 다시 시도해 주세요.' : null;

  return (
    <main className="px-4 py-10 sm:py-16">
      <div className="max-w-[440px] mx-auto">
        <div className="rounded-3xl border border-gray-200 bg-white shadow-[0_12px_40px_-12px_rgba(236,21,97,0.25)] overflow-hidden">
          <div className="px-8 pt-9 pb-7 text-center" style={{ background: 'linear-gradient(160deg, #fff0f6 0%, #ffffff 70%)' }}>
            <span className="inline-block rounded-md px-3 py-1 text-white text-lg font-extrabold tracking-tight" style={{ background: '#ff247d' }}>
              팩트파인더
            </span>
            <h1 className="mt-5 text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--title)' }}>
              로그인하고 함께 읽어요
            </h1>
            <p className="mt-2 text-sm text-gray-500">진영에 기대지 않는 중도의 시선</p>
          </div>

          <div className="px-8 pb-8">
            {error && <p className="mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}
            <GoogleSignInButton callbackUrl={callbackUrl} />
            <p className="mt-3 text-center text-xs text-gray-400">처음이면 구글 계정으로 바로 가입됩니다. 비밀번호를 따로 만들 필요가 없습니다.</p>

            <ul className="mt-7 grid grid-cols-2 gap-3">
              {PERKS.map((p) => (
                <li key={p.title} className="rounded-xl bg-gray-50 px-3 py-3">
                  <span className="text-lg" aria-hidden="true">{p.icon}</span>
                  <b className="block mt-1 text-sm text-gray-900">{p.title}</b>
                  <span className="block text-xs text-gray-500 leading-snug">{p.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-gray-400 leading-relaxed">
          로그인하면 팩트파인더{' '}
          <a href="/company/terms" className="underline hover:text-gray-600">이용약관</a>과{' '}
          <a href="/company/privacy" className="underline hover:text-gray-600">개인정보처리방침</a>에 동의하는 것으로 봅니다.
        </p>
      </div>
    </main>
  );
}
