import Script from 'next/script';
import { IS_LIVE_DOMAIN, GA4_IDS, NAVER_ANALYTICS_ID, CLARITY_IDS } from '@/lib/siteTags';

// 구글 애널리틱스(GA4) + 네이버 애널리틱스 + MS Clarity — 실제 도메인(factfinder.tv)에서만 로드 (2026-10-08)
export default function SiteAnalytics() {
  if (!IS_LIVE_DOMAIN) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA4_IDS[0]}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());${GA4_IDS.map((id) => `gtag('config','${id}');`).join('')}`}
      </Script>
      <Script src="https://wcs.naver.net/wcslog.js" strategy="afterInteractive" />
      <Script id="naver-wcs" strategy="afterInteractive">
        {`(function r(){if(!window.wcs){return setTimeout(r,200);}window.wcs_add=window.wcs_add||{};wcs_add["wa"]="${NAVER_ANALYTICS_ID}";wcs_do();})();`}
      </Script>
      {CLARITY_IDS.map((id) => (
        <Script key={id} id={`clarity-${id}`} strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${id}");`}
        </Script>
      ))}
    </>
  );
}
