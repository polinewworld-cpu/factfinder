import './globals.css';
import Header from '@/components/Header';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-white text-gray-900 min-h-screen">
        <Header />
        {children}
      </body>
    </html>
  );
}
