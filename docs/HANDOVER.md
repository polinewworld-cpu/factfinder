# 팩트파인더 2.0 인수인계서 (공개용)

최종 정리: 2026-10-09
이 문서는 **공개 저장소**에 있으므로 비밀번호·API 키·개인 이메일은 적지 않는다. 비밀값은 Render 환경변수(이름만 아래 §3)와 운영자 로컬 문서(`factfinder-인수인계서.md`, .gitignore)에만 있다.

---

## 1. 개요

| 항목 | 내용 |
|---|---|
| 서비스 | 팩트파인더 — 정치·사회 인터넷신문 (옛 사이트 factfinder.tv, 다다미디어 PHP CMS → 2.0으로 이관 중) |
| 코드 | GitHub `polinewworld-cpu/factfinder` (main 브랜치, 푸시하면 Render 자동 배포) |
| 운영 주소(임시) | https://factfinder-85w9.onrender.com — 도메인 전환 후 https://www.factfinder.tv |
| 기술 | Next.js 14 (App Router) · Prisma 5.18 · PostgreSQL 17 (Supabase, US East Ohio) · NextAuth(구글 로그인, JWT) · Tailwind |
| 호스팅 | Render 무료(Ohio, 메모리 512MB). 15분 무접속 시 잠들어서 cron-job.org가 10분마다 `/api/health` 호출 |
| 파일 저장 | Supabase Storage 버킷 `uploads`(비공개) → `/api/blob/<파일명>`으로 서빙(스트리밍). 무료 1GB, 옛 기사 사진 약 340MB 사용 |
| 백업 | GitHub Actions `db-backup.yml` — 매일 새벽 pg_dump → AES-256 암호화 → Actions artifact 30일 보관 |
| 작업 폴더 | 운영자 PC `C:\Users\zoohy\Documents\factfinder` |

## 2. 외부 서비스·계정 (계정은 회사 구글 계정 기준)

- **Render**: 웹 서비스 `srv-dakvb5u7bikc73dqg3fg`, 환경변수는 Render 대시보드 → Environment
- **Supabase**: 프로젝트 "2.0 DB"(Ohio). 예전 서울 프로젝트는 폐기됨
- **구글 클라우드**: OAuth 클라이언트 "팩트파인더 2.0", GA4 Data API용 서비스 계정(프로젝트 z-board-510613)
- **GA4**: 속성 558113690, 측정 ID G-HBX6WJSHM5 (factfinder.tv 도메인에서만 스크립트 켜짐)
- **구글 애드센스**: 사이트 코드 번호 `ca-pub-1922059581667762` = 파트너 명의 계정(이미 factfinder.tv 승인, 사장님 결정으로 그대로 사용 — 수익 계좌 무관). 회사 계정이 이 계정의 "관리" 사용자로 등록돼 있음. 회사 계정 자체 번호 pub-5435039189673790은 예비
- **KG이니시스**: 후원 결제(MID는 Render 환경변수). PC 표준결제 + 모바일
- **제미나이 API**: 방문 분석·동향 보고·뉴스레터 인사말
- **cron-job.org**: 10분마다 `/api/health`
- **정글2 네이버 검색 중계**(Cloudflare Worker `naver-news-proxy`): 사진 뱅크의 네이버 "제공" 사진 기사 찾기에 사용(키 불필요, 정글2 한도 공유)

## 3. 환경변수 (Render) — 이름과 용도만

| 이름 | 용도 |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Supabase (pooler 6543 / 5432) |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | 로그인. 도메인 전환 때 `https://www.factfinder.tv`로 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 구글 로그인 |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | 파일 저장소 |
| `INICIS_MID`, `INICIS_SIGN_KEY` 등 | 이니시스 결제 (도메인 전환 후 signKey 재발급 권장) |
| `GA_PROPERTY_ID`, `GA_SERVICE_ACCOUNT_JSON` | 방문 분석 |
| `GEMINI_API_KEY`, (`GEMINI_MODEL`) | 자동 분석·인사이트·인사말 (기본 gemini-3.6-flash, 붐비면 3.5-flash-lite) |
| `YOUTUBE_API_KEY` | 정치신세계 라이브 수집 |
| `RESEND_API_KEY`, `NEWSLETTER_FROM_EMAIL` | **미설정** — 뉴스레터 메일 발송 |
| (선택) `FLICKR_API_KEY`, `DVIDS_API_KEY`, `NAVER_CLIENT_ID/SECRET`, `NAVER_SEARCH_PROXY` | 사진 뱅크 외부 검색(플리커·DVIDS는 보류) |

## 4. 배포·DB 변경 방식

- `npm run build` 안에서 `prisma/migrate-safe.mjs` → `prisma migrate deploy`. **`db push --accept-data-loss` 쓰지 않음.** 데이터를 지우는 변경은 마이그레이션 파일에 명시적으로 쓴 것만 일어남.
- 마이그레이션: `0_init` … `13_indexes` (8 애드센스 설정, 9 사진 뱅크, 10 수신함, 11 유령기자, 12 신분증 테이블 삭제, 13 조회 색인).
- 빈 DB(새 고객사 등)는 폴더 이름순 정렬('10_'이 '9_'보다 앞) 때문에 그대로 적용하면 실패 → `migrate-safe.mjs`가 schema.prisma로 한 번에 만들고 전부 적용됨으로 기록(2026-10-09).
- 새 스키마 변경 순서: `schema.prisma` 수정 → `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`로 SQL 확인 → `prisma/migrations/<번호>_<이름>/migration.sql` 저장 → 커밋·푸시.
- 로컬 `next build`는 `.env.local`(옛 서울 DB)을 먼저 읽어 prerender 단계에서 DB 오류가 남 → `.env` 값을 환경변수로 넣고 빌드하면 끝까지 확인 가능.
- Render 빌드가 실패하면 이전 버전이 계속 서비스됨(데이터 영향 없음).

## 5. 옛 사이트 이관 (완료분)

- 옛 기사 3,018건 크롤링·이관 (`scripts/legacy-import.mjs`: crawl → parse → images → import). `Article.legacyId` = 옛 idx.
- 카테고리 규칙: 경제·법률 → 정치, 과학-IT → 사회, 시끌시끌·웅성웅성 등 → 문화, 후원하기 → 후원하기.
- 옛 사진은 Supabase로 옮김(관리자 "옛 사진 옮기기", 메뉴에서는 숨김·주소로는 열림).
- 옛 주소 리다이렉트: `/news/view.php?idx=N`·`/article/N` → 새 기사, `list.php`·mcode → 카테고리, `/data/...` → 옮긴 사진 (`next.config.js`, `app/page.tsx` LEGACY_MCODE).
- 옛 회원은 버림. 옛 기자는 "옛 기자 연결"(구글 이메일 미리 등록 → 로그인하면 자동 승계) 또는 유령기자로 관리.
- 조회수는 이관하지 않음("과거와 결별").

## 6. 공개 사이트 기능

- **메뉴**: 전체 / 정치 / 국제 / 사회 / 문화 / 후원하기(기사 카테고리). 페이지당 60개, 페이지 번호 10개 단위.
- **정치신세계**: 유튜브 채널의 **라이브 방송·라이브 다시보기만** 카드로(프리미어·쇼츠·일반 영상 제외, `lib/youtube.ts` isLiveBroadcast). 별도 탭은 없음.
- **기사**: SEO(기사별 OG·NewsArticle JSON-LD·canonical), 듣기(TTS), 저장, 공유, 글자 크기, 후원 버튼(기사 글쓴이에게 후원).
- **후원**: 일시 후원 3천/5천/1만/2만/3만 원, 후원자 이름·연락처, 비회원 가능, 이니시스 결제. 정기 후원·취소 기능 없음(결정).
- **가입**: 구글 로그인 → 닉네임·프로필 사진 → [독자회원가입](뉴스레터 구독) / [기자회원가입](기자 신청).
- **RSS** `/rss.xml`, 사이트맵 `/sitemap.xml`, 구글 뉴스 사이트맵 `/news-sitemap.xml`, robots(관리자·내부 API만 차단, **AI 수집 봇 허용** — 결정).
- **광고·통계**: 애드센스 자동광고(관리자에서 켜기/끄기·화면 종류별), GA4, 네이버 애널리틱스 — factfinder.tv 도메인에서만 동작.
- **약관·개인정보처리방침**: `/company/terms`, `/company/privacy`(2026-10-09 개정: 외부 기고자 계좌 수집 항목). 회원 탈퇴는 내 프로필에서.
- 레이아웃: 1280px 최대 폭, 양옆 최소 여백 32px(900px 미만 20px).

## 7. 회원·권한

| 등급 | 할 수 있는 것 |
|---|---|
| 독자 | 읽기·저장·댓글·후원 |
| 기자 | 기사 작성(편집장 승인 후 발행) + 편집실 일부 |
| 논설위원 | 기사 즉시 발행 + 편집실 일부 |
| 편집장 | 전부 |

- **편집실 권한**(2026-10-09): 기자·논설위원은 편집실에서 **동향 보고·기사 작성·사진 뱅크만**. 그 밖의 화면은 `components/AdminGate.tsx`가 막고, 관리 API도 편집장 전용.
- **유령기자**(2026-10-09 정의): 로그인 계정 없이 이름으로만 있는 필자(외부 기고자·옛 사이트 기자). 실제 데이터 = 이메일 `…@legacy.invalid` + `ghost=false` 계정. 편집장이 자기 계정으로 외부 기고를 올릴 때 글쓴이로 고르면, 바이라인·후원·정산이 그 사람 앞으로 잡힘.
- `User.ghost=true`는 "삭제해서 목록에서 숨긴" 계정(기사·이름은 유지) — 유령기자와 다른 개념.
- 등급 변경은 30초 안에 반영(로그인 출입증의 등급을 `lib/auth.ts`가 DB로 재확인). 삭제·숨김 계정은 기존 로그인도 무효.
- 공개 화면·API로 내보내는 기자 정보는 `lib/publicFields.ts`의 PUBLIC_AUTHOR_SELECT만 — `author: true`(이메일·정산 계좌 포함) 금지.

## 8. 편집실(관리자) 메뉴별 기능

**대시보드** — 오늘/전체 발행 기사(최근 7개, 누르면 기사만 뜨는 창), 승인을 기다리는 기사, 회원(최근 12), 기자(신청 대기 / 현재 기자·논설위원), 후원 누적(실제 결제된 금액만), 오늘의 기사 아이디어 상위 3.

**동향 보고**(/admin/trends, 기자 이상) — 3시간마다 자동(06~23시) + [지금 새로고침]
1. **오늘의 키워드**: 조선·중앙·동아·매일신문·서울신문·한국경제의 오늘 1면·많이 본 20·댓글 많은 20 제목에서 뽑은 키워드(같은 기사에서 나온 곁가지 단어 제거). **진보지는 넣지 않음**(사장님 지시).
2. **오늘의 기사 아이디어**: 1~3순위, 제목 예시·각도·근거 + 다른 언론 **대표 기사 최대 3개**(작은 글씨 링크). 일반론 금지, 추천 기자 없음.
3. **주요 언론 보도 동향**: 매체별로 무엇을 1면·단독으로 다뤘는지.
4. **주요 언론 지면**: 6개 매체 탭(1면·많이 본·댓글 많은) + 1면 아래 "○○ 정치 바로 가기".
- 코드: `lib/mediaWatch.ts`(네이버 언론사 페이지 수집), `lib/geminiAnalysis.ts`, `components/AnalyticsView.tsx`(view=trends). 화면 문구에 "제미나이"라는 단어를 쓰지 않음.

**방문 분석**(/admin/analytics, 편집장) — GA4 최근 7일(지난주 대비), 28일 추이, 많이 읽힌 기사(옛·새 주소 합산), 기자·카테고리·유입 경로·기기·시간대·요일, 규칙 기반 인사이트, 분석 메모. 매일 아침 자동 + [지금 새로 분석]. 섹션 제목은 크게.

**기사 작성**(/write) — 글쓴이: [이름] / [유령기자] 라디오(편집장). 유령기자는 목록에서 고르거나 그 자리에서 새로 등록. 사진은 [사진 뱅크] 버튼으로(캡션 끝에 "(크레디트)" 자동). 수정할 때 원래 카테고리 유지(덮어쓰기 버그 10-09 수정).

**전체 기사** — 최초 등록일 최신순(최종편집일은 날짜에 마우스), 삭제.

**승인 대기함** — 기자 기사 승인.

**사진 뱅크**(/admin/photo-bank, 기자 이상; 기자용 /photos도 같은 화면)
- 출처가 확인된 사진만. 출처 유형: 공공누리 / 정당·의원실 배포 / 퍼블릭 도메인 / CC / 자체 촬영. (AI 재구성·생성 기능은 삭제)
- 저장 차단: 크레디트·캡션·촬영자에 연합·뉴시스·뉴스1·AP·로이터·AFP·EPA·게티. 크레디트 자동("사진=○○").
- **검색 하나로 내 뱅크 + 외부(안전한 사진만)**: 위키미디어(사람 이름은 위키데이터로 영문 이름·"이 사진의 인물" 등록 사진 우선, 이름이 실제로 들어간 사진만), 네이버 뉴스 "제공" 사진(캡션의 "○○ 제공" — 의원실·정당 → 정당·의원실 배포, 정부기관 → 공공누리, 언론사·기자 제외; 통신사의 "재판매 및 DB 금지" 꼬리표는 **무시** — 사장님 결정). [뱅크로 가져오기]/[가져와서 넣기].
- 필터(출처·상황 태그·인물 모두/한 명이라도·촬영일·미사용/최근 7일 제외), 정렬(등록·촬영·덜 쓴 순). 출처 미입력(옛 갤러리) 사진은 목록엔 보이지만 기사에는 못 넣음.
- 관리: 사진 바깥 빈 곳 드래그로 여러 장 선택 → 캡션 일괄·출처 일괄·삭제(편집장). 상세: 크레디트 복사·정보 수정·워터마크 지우기·사용된 기사.
- **수신함**(편집장): 자동 수집기(기본 1시간, 화면에서 주기 변경) — 민주당 포토갤러리·개혁신당 사진자료(이름 없어도 수집, 등록 인물은 자동 태그) + 네이버 "등록 인물 + 제공"(인물 5명씩 돌아가며). 수신함은 원본 링크만 저장, **승인할 때만** 파일을 2000px·JPEG로 줄여 저장. 국민의힘은 홈페이지에 사진 게시판이 없음, 새미래민주당은 홈페이지 주소 미확인.
- 인물 목록·상황 태그 관리(편집장). 사용 이력은 기사 저장 때 기록.
- 코드: `components/PhotoBank.tsx`, `lib/photoBank*.ts`, `lib/externalPhotos.ts`, `lib/partySources.ts`, `lib/photoCollector.ts`, `lib/remoteImage.ts`.

**광고 관리** — 탭: 배너 / 줄광고 / 애드센스(켜기/끄기, 홈·기사·그 밖 화면별, 광고 밀도는 애드센스 사이트 바로가기 — 다른 구글 계정으로 열려 "액세스 거부"가 뜨면 프로필에서 회사 계정으로 전환).

**회원/기자관리** — 탭: 기자관리(실제 기자·논설위원·편집장) / 기자 신청 대기 / **유령기자**(이름·직함·프로필 사진·정산 계좌) / 옛 기자 연결 / 회원관리. 각 줄 [편집](닉네임·사진·자기소개·정산 계좌) [삭제](기사 있으면 숨김 처리).

**후원내역** — 탭: 후원내역(기간·기자 검색) / 기자별 정산내역.
- **원고료 = 후원 정산**: 기자별 후원 합계에서 **30% 공제**한 금액을 지급(사장님 결정). 정산하는 날 미정산 건이 전부 체크된 채 열림 → 표의 **입금 계좌**로 이체 → [정산 완료]. 계좌는 표에서 바로 넣기/고치기. 유령기자 기사로 들어온 후원도 자동으로 그 사람 몫.

**뉴스레터 관리** — 최근 30일 기사 고르기 + 인사말([인사말 작성]이 고른 기사를 요약) + 미리보기. **메일 발송은 Resend 키가 없어 아직 미리보기만.**

## 9. 자동화 (모두 `/api/health` 10분 핑이 계기)

| 작업 | 주기 |
|---|---|
| 방문 분석(GA 숫자·인사이트) | 하루 1번(한국시간 06시 이후 첫 핑) |
| 동향 보고(키워드·지면·기사 아이디어) | 06~23시 3시간마다 |
| 사진 수집기 | 관리자 설정(기본 60분, 0=끔) |
| DB 백업 | GitHub Actions 매일 새벽 |
| 정치신세계 유튜브 동기화 | 홈·정치신세계 접속 시 5분 간격(라이브 검색은 30분), 화면은 기다리지 않음 |

## 10. 결정 사항 (사장님)

- 옛 회원·조회수는 이관하지 않음. 정기 후원·후원 취소 기능 없음.
- 매체 동향 대상은 보수·경제지 6곳, 진보지 제외. 화면에 "제미나이" 단어 안 씀. 추천 기자 안 넣음.
- AI 수집 봇 차단 안 함(노출 이득). 도메인 전환 때 Cloudflare의 AI 봇 차단 기본값을 끌 것.
- 애드센스는 파트너 명의 기존 번호 유지.
- 사진 뱅크: AI 재구성 기능 삭제, 통신사 "DB 금지" 꼬리표 무시, 플리커·DVIDS 보류.
- 유령기자 신분증 사진 기능 삭제(계좌만).
- 원고료는 후원 합계 30% 공제 방식.

## 11. 남은 과제

**도메인 전환(다음 주 예정)**
1. 직전에 옛 사이트 새 기사 마저 가져오기(legacy-import) → 옛 사진 옮기기
2. Cloudflare 연결(무료, 사진 캐시로 Supabase 전송량 절약, AI 봇 차단 끄기, Bot Fight Mode 켜기)
3. Render 사용자 도메인, `NEXTAUTH_URL` 변경, 구글 OAuth 승인 주소 추가, cron-job.org 주소 변경
4. (선택) 서치콘솔·네이버에 sitemap.xml 한 번 알리기 — 도메인이 그대로라 재등록·검색제휴 신고는 불필요. 옛 기사 주소는 301로 새 주소 연결, 소유 확인 태그도 새 사이트에 있음 (2026-10-10 정정)
5. 이니시스 signKey 재발급 → Render, 다다미디어 결제 페이지 중지

**기능**
- 뉴스레터 메일 발송 연결(Resend 무료 키) + 토요일 아침 자동 발송 — 가입 화면에서 약속한 기능
- 새미래민주당 홈페이지 사진 수집(주소 필요), 부처(공공누리) 사이트 수집
- 인물 목록 확충(자동 태그용), 옛 갤러리 사진 25장 출처 정리
- 동향 보고 2단계: 정글2 추천 묶음 연동(정글2 DB 읽기 키 필요)
- 카카오 공유 버튼("차차")

**보안·운영**
- 운영자 로컬 문서에 과거 DB 비밀번호·OAuth 비밀키가 평문으로 남아 있음 → 도메인 전환 뒤 Supabase DB 비밀번호·구글 OAuth 비밀키 교체 권장
- 저장 공간(1GB) 70% 넘으면 정리·유료 검토

## 12. 주요 파일 지도

| 영역 | 파일 |
|---|---|
| 권한·레이아웃 | `app/admin/layout.tsx`, `components/AdminGate.tsx`, `components/AdminSidebar.tsx`, `components/AdminTabs.tsx` |
| 기사 | `app/write/page.tsx`, `app/api/articles/**`, `app/article/[id]/page.tsx`, `lib/byline.ts`, `lib/authorResolve.ts`, `lib/ghostWriter.ts` |
| 동향·방문 | `lib/mediaWatch.ts`, `lib/geminiAnalysis.ts`, `lib/ga.ts`, `lib/gaReport.ts`, `lib/analyticsSnapshot.ts`, `components/AnalyticsView.tsx` |
| 사진 뱅크 | §8 참고 |
| 후원·정산 | `app/admin/donations/page.tsx`, `app/api/admin/donations`, `app/api/admin/payout-info`, `lib/inicis.ts`, `app/api/donations/**` |
| 광고 | `lib/siteTags.ts`, `components/AdSenseLoader.tsx`, `app/admin/adsense/page.tsx`, `public/ads.txt` |
| 뉴스레터 | `app/admin/newsletter/page.tsx`, `lib/newsletter.ts`, `lib/gemini.ts`, `app/api/newsletter/**` |
| 이관 | `scripts/legacy-import.mjs`, `next.config.js`(리다이렉트), `app/data/[...path]` |
| 이미지 서빙 | `app/api/blob/[filename]/route.ts`, `lib/blobStorage.ts`, `lib/remoteImage.ts` |
| 자동화 | `app/api/health/route.ts`, `.github/workflows/db-backup.yml` |
