import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

const providers = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
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
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};
