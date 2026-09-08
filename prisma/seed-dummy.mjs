// 테스트용 더미 데이터 — 실제 서비스 데이터가 아님.
// 안전하게 여러 번 재실행 가능(제목 기준으로 있으면 내용만 갱신, 없으면 새로 생성).
// 실제 오픈 전엔 package.json build 스크립트에서 이 파일 실행 부분을 지워주세요.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// 요약문은 기사 본문 앞부분에서 그대로 가져온다(직접 문장을 새로 짓지 않음) — 실제 서비스 방식과 동일한 개념.
function leadExcerpt(lead, max = 80) {
  return lead.length > max ? lead.slice(0, max) + '…' : lead;
}

// 1) 더미 작성자 계정 (이메일로 upsert — 재실행해도 중복 안 됨)
const authors = {
  reporter: await prisma.user.upsert({
    where: { email: 'dummy-reporter@factfinder.test' },
    update: {},
    create: { email: 'dummy-reporter@factfinder.test', name: '김기자', role: 'REPORTER' },
  }),
  columnist: await prisma.user.upsert({
    where: { email: 'dummy-columnist@factfinder.test' },
    update: {},
    create: { email: 'dummy-columnist@factfinder.test', name: '이논설', role: 'COLUMNIST' },
  }),
  editor: await prisma.user.upsert({
    where: { email: 'dummy-editor@factfinder.test' },
    update: {},
    create: { email: 'dummy-editor@factfinder.test', name: '박편집장', role: 'CHIEF_EDITOR' },
  }),
  reader: await prisma.user.upsert({
    where: { email: 'dummy-reader@factfinder.test' },
    update: {},
    create: { email: 'dummy-reader@factfinder.test', name: '최독자', role: 'READER' },
  }),
};

// 2) 카테고리/키워드는 seed-launch.mjs가 먼저 만들어둔 걸 그대로 참조
const categories = await prisma.category.findMany();
const catId = (name) => categories.find((c) => c.name === name)?.id;
const keywordExclusive = await prisma.keyword.findUnique({ where: { name: '단독' } });
const keywordPoll = await prisma.keyword.findUnique({ where: { name: '여론' } });

// lead: 기사 본문 첫 문단(리드 문장) — 요약문은 이 문장에서 그대로 뽑아씀
const articlesData = [
  { title: '국회, 내년도 예산안 심사 돌입…쟁점 법안 조율 관심', category: '정치', author: authors.reporter, status: 'PUBLISHED', days: 1, views: 512, keyword: keywordExclusive,
    lead: '국회가 예산결산특별위원회를 열고 내년도 정부 예산안 심사에 본격 착수했다. 여야는 복지 예산 증액 폭과 사회간접자본(SOC) 사업 배정을 놓고 이견을 보이고 있어 심사 과정에서 진통이 예상된다.' },
  { title: '여야, 지방선거 룰 놓고 이견…협상 재개 예정', category: '정치', author: authors.reporter, status: 'PUBLISHED', days: 2, views: 340,
    lead: '여야가 내년도 지방선거 선거구 획정과 공천 룰을 놓고 이견을 좁히지 못하면서 협상이 잠정 중단됐다. 양측은 이번 주 안으로 실무협상을 재개하기로 했다.' },
  { title: '국회 상임위, 법안 심사 일정 조율', category: '정치', author: authors.editor, status: 'PUBLISHED', days: 0, views: 980, top: true,
    lead: '국회 각 상임위원회가 이번 주부터 계류 법안 심사 일정을 순차적으로 확정하고 있다. 여야 간사는 쟁점 법안에 대해 추가 논의가 필요하다는 데 공감대를 이뤘다.' },
  { title: '정부, 중소기업 지원책 발표…현장 반응은 엇갈려', category: '정치', author: authors.reporter, status: 'DRAFT', days: 0, views: 0,
    lead: '정부가 중소기업의 자금난 완화를 위한 특별 지원책을 발표했다. 업계에서는 환영하는 목소리와 함께 실효성에 의문을 제기하는 반응도 나왔다.' },
  { title: '아세안 정상회의 개막…역내 경제협력 논의', category: '국제', author: authors.columnist, status: 'PUBLISHED', days: 3, views: 421,
    lead: '아세안(ASEAN) 정상회의가 개막해 역내 경제협력과 공급망 안정화 방안이 주요 의제로 논의됐다. 각국 정상은 다음 회의에서 구체적인 실행 계획을 발표하기로 했다.' },
  { title: '국제유가 소폭 상승…공급 우려 반영', category: '국제', author: authors.reporter, status: 'PUBLISHED', days: 4, views: 210,
    lead: '국제유가가 주요 산유국의 감산 가능성이 제기되면서 소폭 상승했다. 시장에서는 당분간 변동성이 이어질 것으로 내다보고 있다.' },
  { title: '유엔, 기후변화 대응 보고서 발표', category: '국제', author: authors.columnist, status: 'PUBLISHED', days: 5, views: 176,
    lead: '유엔이 전 세계 기후변화 대응 현황을 담은 연례 보고서를 발표했다. 보고서는 각국의 온실가스 감축 목표 이행이 여전히 미흡하다고 지적했다.' },
  { title: '환율 변동성 확대…기업 대응 분주', category: '국제', author: authors.reporter, status: 'PUBLISHED', days: 1, views: 298, keyword: keywordPoll,
    lead: '원달러 환율 변동성이 커지면서 수출입 기업들이 대응책 마련에 분주한 모습이다. 전문가들은 당분간 환율 불확실성이 지속될 것으로 전망했다.' },
  { title: '폭염특보 확대…온열질환 주의 당부', category: '사회', author: authors.reporter, status: 'PUBLISHED', days: 0, views: 654,
    lead: '전국 대부분 지역에 폭염특보가 확대 발효되면서 보건당국이 온열질환 예방 수칙 준수를 당부했다. 특히 야외활동이 많은 시간대에는 각별한 주의가 요구된다.' },
  { title: '전국 대학 등록금 동결 기조 유지', category: '사회', author: authors.editor, status: 'PUBLISHED', days: 6, views: 145,
    lead: '전국 주요 대학들이 내년도에도 등록금을 동결하기로 했다. 다만 일부 대학은 재정난을 이유로 인상 여부를 검토 중인 것으로 알려졌다.' },
  { title: '택배노조, 처우개선 요구하며 집회', category: '사회', author: authors.reporter, status: 'PUBLISHED', days: 2, views: 388, keyword: keywordExclusive, poll: true,
    lead: '택배노조가 처우 개선과 표준계약서 이행을 촉구하며 거리 집회를 열었다. 노조 측은 사측과의 교섭이 원만히 이뤄지지 않을 경우 추가 행동에 나서겠다고 밝혔다.' },
  { title: '고령운전자 교통사고 예방대책 시행', category: '사회', author: authors.reporter, status: 'DRAFT', days: 0, views: 0,
    lead: '정부가 고령운전자 교통사고 예방을 위한 종합대책을 시행한다. 운전면허 자진반납 유도와 함께 안전교육 프로그램을 확대할 방침이다.' },
  { title: '지자체, 청년 일자리 박람회 개최', category: '사회', author: authors.columnist, status: 'PUBLISHED', days: 3, views: 233,
    lead: '지방자치단체가 지역 청년들의 취업을 돕기 위한 일자리 박람회를 개최했다. 다양한 업종의 기업이 참여해 현장 면접도 함께 진행됐다.' },
  { title: '지역 영화제 개막…관객 발길 이어져', category: '문화', author: authors.columnist, status: 'PUBLISHED', days: 2, views: 502, comments: true,
    lead: '지역 영화제가 개막해 다양한 국내외 작품이 상영되고 있다. 첫날부터 관객들의 발길이 이어지며 성황을 이뤘다.' },
  { title: '전통시장 야시장 축제 인기몰이', category: '문화', author: authors.reporter, status: 'PUBLISHED', days: 4, views: 267, comments: true,
    lead: '전통시장에서 열린 야시장 축제가 방문객들 사이에서 큰 인기를 끌고 있다. 지역 상인들은 매출 증대 효과를 기대하고 있다.' },
  { title: '청년 예술가 지원사업 참가자 모집', category: '문화', author: authors.reporter, status: 'PUBLISHED', days: 5, views: 98,
    lead: '지역 문화재단이 청년 예술가를 대상으로 한 창작 지원사업 참가자를 모집한다. 선정된 참가자에게는 창작지원금과 전시 기회가 제공된다.' },
  { title: '박물관 특별전, 다음달까지 연장', category: '문화', author: authors.columnist, status: 'PUBLISHED', days: 7, views: 187,
    lead: '박물관에서 진행 중인 특별전이 관람객들의 호응에 힘입어 다음달까지 연장 전시된다. 주말에는 도슨트 해설 프로그램도 추가 운영된다.' },
  { title: '가을 축제 시즌 본격화(작성중)', category: '문화', author: authors.columnist, status: 'AUTOSAVE', days: 0, views: 0,
    lead: '가을을 맞아 전국 각지에서 지역 축제가 본격적으로 시작된다.' },
];

const bodyHtml = (lead) =>
  `<p>${lead}</p>` +
  `<p>(테스트용 더미 기사 — 실제 취재 내용이 아니며, 레이아웃과 기능 확인을 위해 자동 생성되었습니다.)</p>`;

let created = 0;
let updated = 0;
for (const a of articlesData) {
  const data = {
    title: a.title,
    content: bodyHtml(a.lead),
    excerpt: leadExcerpt(a.lead),
    coverImageUrl: `https://picsum.photos/seed/${encodeURIComponent(a.title)}/800/450`,
    status: a.status,
    viewCount: a.views,
    isFrontpageTop: !!a.top,
    authorId: a.author.id,
    categoryId: catId(a.category),
    publishedAt: a.status === 'PUBLISHED' ? daysAgo(a.days) : null,
    keywords: a.keyword ? { set: [{ id: a.keyword.id }] } : undefined,
  };

  let article = await prisma.article.findFirst({ where: { title: a.title } });
  if (article) {
    article = await prisma.article.update({ where: { id: article.id }, data });
    updated++;
  } else {
    article = await prisma.article.create({ data });
    created++;
  }

  if (a.poll) {
    const existingPoll = await prisma.poll.findUnique({ where: { articleId: article.id } });
    if (!existingPoll) {
      await prisma.poll.create({
        data: {
          articleId: article.id,
          question: '이 사안에 대해 어떻게 생각하시나요?',
          options: {
            create: [
              { text: '찬성한다', order: 0 },
              { text: '반대한다', order: 1 },
              { text: '잘 모르겠다', order: 2 },
            ],
          },
        },
      });
    }
  }

  if (a.comments) {
    const existingComments = await prisma.comment.count({ where: { articleId: article.id } });
    if (existingComments === 0) {
      await prisma.comment.createMany({
        data: [
          { articleId: article.id, userId: authors.reader.id, content: '좋은 기사 잘 봤습니다.' },
          { articleId: article.id, userId: authors.editor.id, content: '추가 취재가 더 필요해 보이네요.' },
        ],
      });
    }
  }
}

console.log(`더미 데이터 확인 완료 (신규 ${created}건, 갱신 ${updated}건)`);
await prisma.$disconnect();
