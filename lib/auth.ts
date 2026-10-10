import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { usableAvatarUrl } from '@/lib/avatarGradient';
import { claimLegacyReporterOnLogin } from '@/lib/legacyReporter';

// 등급·계정 상태를 DB에서 다시 확인 (2026-10-09) — 예전엔 로그인할 때 받은 등급이 출입증(JWT)에 최대 30일 고정돼,
// 강등·삭제·유령 처리한 기자도 기존 로그인으로 계속 기사를 쓰고 발행할 수 있었음.
// 요청마다 DB를 치지 않도록 30초 동안은 기억해 둔 값을 씀.
const ROLE_TTL_MS = 30_000;
const roleCache = new Map<string, { role: string | null; at: number }>();
async function currentRole(userId: string): Promise<string | null> {
  const hit = roleCache.get(userId);
  if (hit && Date.now() - hit.at < ROLE_TTL_MS) return hit.role;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, ghost: true } });
  const role = u && !u.ghost ? u.role : null; // 삭제·유령 처리된 계정은 로그인 무효
  if (roleCache.size > 5000) roleCache.clear();
  roleCache.set(userId, { role, at: Date.now() });
  return role;
}

const providers = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    // 편집장 계정(polinewworld@gmail.com)이 스크립트로 DB에 먼저 만들어져 있어서, 실제 구글 로그인 시
    // NextAuth가 이메일은 같은데 연결된 Account가 없다며 막는 문제를 해결하기 위함.
    allowDangerousEmailAccountLinking: true,
  }),
];

// 테스트 전용 로그인 — 운영 배포에는 절대 포함하지 않음 (구글 키 없이 로그인 흐름을 검증하기 위한 용도)
if (process.env.NODE_ENV !== 'production') {
  providers.push(
    CredentialsProvider({
      id: 'test-login',
      name: 'Test Login (dev only)',
      credentials: { email: { label: 'Email', type: 'text' } },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const user = await prisma.user.upsert({
          where: { email: credentials.email },
          update: {},
          create: { email: credentials.email, name: credentials.email.split('@')[0] },
        });
        return user;
      },
    }) as any
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  // Credentials 프로바이더가 있으면 NextAuth가 database 세션을 허용하지 않으므로 jwt로 고정.
  // (구글 로그인만 쓰는 운영 환경에서도 문제없이 동작하는 표준 방식)
  session: { strategy: 'jwt' },
  // 로그인 화면을 우리 디자인(한국어)으로 — 기존 /api/auth/signin 링크도 여기로 옴, 오류도 ?error=로 여기 표시 (2026-10-10)
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (!user && token.id) {
        // DB 장애 때는 출입증 값을 그대로 씀(사이트 전체 로그아웃 방지)
        const role = await currentRole(token.id as string).catch(() => token.role as string);
        token.role = role;
      }
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        // 옛 사이트 기자가 미리 등록된 구글 이메일로 로그인하면 옛 기사·기자 등급 자동 승계 (2026-10-08)
        // 실패해도 로그인은 막지 않음
        const claimedRole = await claimLegacyReporterOnLogin((user as any).id, user.email).catch(() => null);
        if (claimedRole) token.role = claimedRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && !token.role) {
        // 삭제·유령 처리된 계정 — 로그인 안 한 것으로
        return { ...session, user: undefined } as any;
      }
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        session.user.image = usableAvatarUrl(session.user.image);
      }
      return session;
    },
  },
};
