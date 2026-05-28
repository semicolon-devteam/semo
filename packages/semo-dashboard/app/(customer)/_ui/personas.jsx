'use client';
import React from 'react';
import { AGENT_BY_ID } from './agents';

/*
 * personas.jsx — 3 Persona Packs for SEMO ("One Product, Multi-Persona Experience")
 *
 * Same IA, same shell, same components. What changes per persona:
 *   - workspace name + owner label
 *   - 7-agent roster (names, roles, accessories)
 *   - copy strings (home greeting, eyebrows, CTAs, empty states)
 *   - KPI definitions (3 per persona)
 *   - activity feed events (6 samples per persona)
 *   - nudges (3 per persona)
 *   - library carousels (rows of agent ids)
 *   - knowledge categories
 *   - plan blurbs (same tier names, different audience copy)
 *
 * Engineers: this whole file is the JSON-shaped config — split into
 * `personas/*.json` and load by persona id at runtime.
 *
 * Exports: PERSONAS, PERSONA_BY_ID, PersonaCtx, PersonaProvider, usePersona,
 *          getAgent (persona-aware avatar lookup)
 */

/* ────────────────────────────────────────────────────────────────────
 * Agent rosters per persona — same avatar palette (--agent-*), same
 * accessory kinds (BotAvatar already supports them), just different
 * names + roles.
 * ──────────────────────────────────────────────────────────────────── */

const AGENTS_SHOP = [
  { id: 'jumuni',       name: '주문이',   role: '주문 응대 직원',   dept: '응대',   color: 'var(--agent-peach)',    accent: '#E07A3B', accessoryKind: 'headset' },
  { id: 'hwegyedo-ri',  name: '회계도리', role: '회계·세무 직원',   dept: '회계',   color: 'var(--agent-mint)',     accent: '#2E9670', accessoryKind: 'calc' },
  { id: 'algorim-i',    name: '알리미',   role: '마케팅·SNS 직원',  dept: '마케팅', color: 'var(--agent-lavender)', accent: '#6E5BD1', accessoryKind: 'megaphone' },
  { id: 'chae-wo',      name: '채워',     role: '재고·발주 직원',   dept: '재고',   color: 'var(--agent-coral)',    accent: '#D9543F', accessoryKind: 'box' },
  { id: 'sem-i',        name: '셈이',     role: '매출 분석 직원',   dept: '분석',   color: 'var(--agent-sky)',      accent: '#1F7AC9', accessoryKind: 'chart' },
  { id: 'dangol-i',     name: '단골이',   role: 'CS·단골 관리',     dept: 'CS',     color: 'var(--agent-butter)',   accent: '#B27418', accessoryKind: 'heart' },
  { id: 'bi-seo',       name: '비서',     role: '스케줄 직원',     dept: '스케줄', color: 'var(--agent-rose)',     accent: '#C66095', accessoryKind: 'clock' },
];

const AGENTS_PERSONAL = [
  { id: 'eui-ri',       name: '의리',     role: '보험·증권 비서',   dept: '재무',   color: 'var(--agent-peach)',    accent: '#E07A3B', accessoryKind: 'heart' },
  { id: 'hwal-do-ri',   name: '활도리',   role: '건강·운동 비서',   dept: '건강',   color: 'var(--agent-mint)',     accent: '#2E9670', accessoryKind: 'chart' },
  { id: 'mind-i',       name: '마인드',   role: '감정·일기 비서',   dept: '마음',   color: 'var(--agent-lavender)', accent: '#6E5BD1', accessoryKind: 'heart' },
  { id: 'sallim-i',     name: '살림이',   role: '가계부 비서',     dept: '재무',   color: 'var(--agent-butter)',   accent: '#B27418', accessoryKind: 'calc' },
  { id: 'chingu-jigi',  name: '친구지기', role: '관계·기념일 비서', dept: '관계',   color: 'var(--agent-rose)',     accent: '#C66095', accessoryKind: 'heart' },
  { id: 'chwimi',       name: '취미',     role: '취미·콘텐츠 비서', dept: '취미',   color: 'var(--agent-coral)',    accent: '#D9543F', accessoryKind: 'megaphone' },
  { id: 'iljeong-i',    name: '일정이',   role: '일정·할 일 비서',  dept: '일정',   color: 'var(--agent-sky)',      accent: '#1F7AC9', accessoryKind: 'clock' },
];

const AGENTS_WORKER = [
  { id: 'report-i',     name: '리포트',   role: '보고서 작성 동료', dept: '문서',   color: 'var(--agent-peach)',    accent: '#E07A3B', accessoryKind: 'chart' },
  { id: 'research-i',   name: '리서치',   role: '조사·요약 동료',   dept: '리서치', color: 'var(--agent-mint)',     accent: '#2E9670', accessoryKind: 'box' },
  { id: 'data-yi',      name: '데이터',   role: '데이터 분석 동료', dept: '분석',   color: 'var(--agent-sky)',      accent: '#1F7AC9', accessoryKind: 'chart' },
  { id: 'meeting-i',    name: '미팅이',   role: '회의록 동료',     dept: '미팅',   color: 'var(--agent-rose)',     accent: '#C66095', accessoryKind: 'clock' },
  { id: 'inbox-i',      name: '인박스',   role: '메일·업무 정리',   dept: '인박스', color: 'var(--agent-lavender)', accent: '#6E5BD1', accessoryKind: 'megaphone' },
  { id: 'issue-i',      name: '이슈매니저', role: '작업 트래킹 동료', dept: '트래커', color: 'var(--agent-butter)',   accent: '#B27418', accessoryKind: 'calc' },
  { id: 'sokong-i',     name: '소통이',   role: '메시지 정리 동료', dept: '커뮤니케이션', color: 'var(--agent-coral)', accent: '#D9543F', accessoryKind: 'heart' },
];

/* ────────────────────────────────────────────────────────────────────
 * Persona packs
 * ──────────────────────────────────────────────────────────────────── */

const PACK_SHOP = {
  id: 'shop',
  label: '소상공인',
  longLabel: '소상공인 · 1인 사장님',
  icon: 'store',
  accent: '--agent-peach',
  ownerLabel: '사장님',
  workspace: { name: '정민 카페', subtitle: 'Customer · 소상공인' },
  agents: AGENTS_SHOP,
  home: {
    eyebrow: 'Today · 오전 9:47',
    greetingTitle: '안녕하세요 정민 사장님.',
    greetingSubtitle: '오늘 직원들이 이런 일을 했어요.',
    feedTitle: '활동 피드',
    nudgeTitle: '오늘 사장님이 해주셔야 할 일',
    workingTitle: '지금 일하고 있어요',
    weekKB: '이번 주 가게 지식',
    weekKBSub: '새 노드 8개 · 새 연결 23개',
    planLabel: '응대 사용량',
    stats: [
      { label: '오늘 응대',     value: '36건',        delta: +12, hint: '주문이 · 단골이',  chart: 'bar',  data: [14, 18, 12, 22, 19, 28, 36] },
      { label: '어제 매출',     value: '₩412,000',    delta: +8,  hint: '셈이가 분석함',     chart: 'line', data: [320, 280, 360, 410, 340, 412] },
      { label: '새 가게 지식',   value: '8건',          delta: null, hint: '3명이 함께 채움', chart: 'network' },
    ],
    feed: {
      now: [
        { agent: 'jumuni',  verb: '카카오톡 문의에 답했어요', target: '단골 김미영 님',
          detail: "시그니처 메뉴 '더치 라떼' 추천 + 단골 할인 안내. 답변 만족도 ★★★★★",
          time: '2분 전', status: 'working' },
        { agent: 'dangol-i', verb: '단골 손님을 알아봤어요', target: '이번 달 5번째 방문',
          detail: '박지호 님이 오후 2시쯤 오실 예정. 평소 따뜻한 아메리카노 + 베이글.',
          time: '8분 전' },
      ],
      morning: [
        { agent: 'hwegyedo-ri', verb: '5월 4주차 매출 리포트를 만들었어요', target: '가게 지식에 저장',
          detail: '총 매출 ₩2,148,000 (+15%). 화요일 매출이 평균 대비 22% 높았어요.', time: '9:32' },
        { agent: 'algorim-i',   verb: '인스타 게시물 초안을 만들었어요', target: "'신메뉴 더치 라떼'",
          detail: '해시태그 7개 + 사진 3장 후보. 게시 전에 한 번 검토해주세요.', time: '9:14' },
        { agent: 'chae-wo',     verb: '우유 재고 부족을 알렸어요', target: '발주 초안 준비됨',
          detail: '저지방 우유 2팩 남음 · 내일 오전 소진 예상. 평소 거래처에 자동 발주서 작성 완료.', time: '8:47' },
      ],
      yesterday: [
        { agent: 'sem-i',       verb: '어제의 인사이트를 만들었어요', target: "'오후 3-5시가 가장 한가해요'",
          detail: '이 시간대에 단골 할인 알림을 보내면 매출 +18% 효과 예상.', time: '어제 18:00' },
      ],
    },
    nudges: [
      { agentId: 'jumuni',  title: '단골 김미영 님 환불 요청',
        detail: '어제 케이크 상태가 이상하다고 하셨어요. 주문이가 답변 초안을 만들어뒀어요.',
        primary: '승인하고 응대', secondary: '내가 답하기' },
      { agentId: 'algorim-i', title: '신메뉴 게시물 검토',
        detail: '알리미가 인스타용 초안 1개를 준비했어요.',
        primary: '미리보기', secondary: '수정 요청' },
      { agentId: 'chae-wo',  title: '우유 발주 (저지방 2팩)',
        detail: '평소 거래처로 자동 발주 가능.',
        primary: '발주하기', secondary: '나중에' },
    ],
    working: [
      { agentId: 'jumuni',      task: '카카오톡 응대 중',  detail: '3개 대화' },
      { agentId: 'hwegyedo-ri', task: '오늘 매출 정산 중', detail: '62%', progress: 62 },
      { agentId: 'algorim-i',   task: 'SNS 모니터링 중',  detail: '대기' },
    ],
  },
  team: {
    title: '내 직원',
    subtitle: '7명 채용 중',
    ctaNew: '새 직원 채용',
    filters: ['전체', '일하는 중', '응대', '회계·분석', '마케팅', '재고·발주'],
    emptyHire: '120+ 직원이 라이브러리에 있어요',
  },
  knowledge: {
    title: '가게 지식',
    subtitle: 'KB',
    weekBlurb: '봇들이 일을 시작하면 여기에 가게 지식이 쌓여요.',
    categories: ['메뉴', '손님·단골', '응대·CS', '매출·재무', '마케팅', '재고·발주', '운영', '미팅·일정'],
    sampleNodeTitle: '김미영 (단골)',
    sampleNodeFields: [
      ['첫 방문',       '2023년 11월'],
      ['누적 방문',     '48회'],
      ['평균 객단가',   '₩9,500'],
      ['좋아하는 메뉴', '더치 라떼, 베이글'],
    ],
  },
  library: {
    title: '채용',
    subtitle: '120+ 직원',
    heroEyebrow: 'Hire',
    heroTitle: '새 직원을 만나보세요',
    searchPlaceholder: '원하는 일을 검색하세요 — 예: 매출 리포트, 카톡 응대',
    audienceChips: ['전체', '카페', '미용실', '쇼핑몰', '컨설턴트', '음식점'],
    audienceActive: '카페',
    rows: [
      { eyebrow: 'Picked for you',    title: '카페 사장님께 추천하는 직원' },
      { eyebrow: 'Customer Care',     title: '응대·CS 직원' },
      { eyebrow: 'Numbers',           title: '회계·분석 직원' },
    ],
    cta: '채용하기',
  },
  plan: {
    audience: '1인 사장님의 시작',
    tip: '연간 결제 시 한 달치 절약돼요.',
  },
};

const PACK_PERSONAL = {
  id: 'personal',
  label: '개인',
  longLabel: '개인 · 일상을 돕는 비서팀',
  icon: 'heart',
  accent: '--agent-rose',
  ownerLabel: '님',
  workspace: { name: '지원의 일상',  subtitle: 'Customer · 개인' },
  agents: AGENTS_PERSONAL,
  home: {
    eyebrow: 'Today · 오전 9:47',
    greetingTitle: '안녕하세요 지원 님.',
    greetingSubtitle: '오늘 비서들이 이런 걸 챙겨두었어요.',
    feedTitle: '오늘의 정리',
    nudgeTitle: '오늘 결정해주실 것들',
    workingTitle: '지금 챙기고 있어요',
    weekKB: '이번 주 나의 기록',
    weekKBSub: '새 노드 12개 · 새 연결 31개',
    planLabel: '대화 사용량',
    stats: [
      { label: '이번 달 가계',  value: '-₩238,000', delta: -6,  hint: '살림이 정리',     chart: 'line', data: [180, 220, 240, 260, 250, 238] },
      { label: '운동 기록',     value: '4 / 5일',   delta: null, hint: '활도리 응원 중', chart: 'bar',  data: [1, 0, 1, 1, 0, 1, 0] },
      { label: '새 기록·메모',  value: '12건',       delta: null, hint: '마인드·일정이', chart: 'network' },
    ],
    feed: {
      now: [
        { agent: 'eui-ri',     verb: '실손보험 청구를 도와드렸어요', target: '5월 16일 진료',
          detail: '병원 영수증 사진을 인식해서 청구서 초안을 만들었어요. 마지막 확인만 해주세요.',
          time: '3분 전', status: 'working' },
        { agent: 'iljeong-i',  verb: '내일 일정을 정리했어요', target: '치과 14:30 + 부모님 통화 19:00',
          detail: '치과 출발 30분 전에 알려드릴게요.', time: '11분 전' },
      ],
      morning: [
        { agent: 'sallim-i',   verb: '5월 가계부를 정리했어요', target: "이번 달 카테고리 TOP 3",
          detail: '식비 ₩412k · 교통 ₩98k · 구독 ₩47k. 구독은 지난달보다 ₩12k 늘었어요.', time: '8:48' },
        { agent: 'hwal-do-ri', verb: '오늘 운동 루틴을 준비했어요', target: '저녁 7시 · 30분',
          detail: '어제 어깨가 무거우셨다 했으니 가벼운 스트레칭 위주로 짰어요.', time: '8:30' },
        { agent: 'chingu-jigi', verb: '친구 기념일을 챙겼어요', target: '주연이 생일 D-3',
          detail: '작년에 좋아하셨던 카페 케이크 + 손글씨 카드 조합을 추천드려요.', time: '8:12' },
      ],
      yesterday: [
        { agent: 'mind-i',     verb: '어제 감정 일기를 모았어요', target: "'오후엔 차분, 저녁엔 들뜸'",
          detail: '비슷한 패턴이 이번 주 4번. 오후 산책이 도움되었던 날과 겹쳐요.', time: '어제 23:10' },
      ],
    },
    nudges: [
      { agentId: 'eui-ri',     title: '실손보험 청구 서명',
        detail: '서류 마지막에 본인 확인만 하면 바로 접수돼요.',
        primary: '확인하고 보내기', secondary: '내가 직접' },
      { agentId: 'sallim-i',   title: '넷플릭스 구독 자동결제 ₩17,000',
        detail: '이번 달 사용 0시간. 한 달 쉬어볼까요?',
        primary: '한 달 쉬기',   secondary: '유지' },
      { agentId: 'chingu-jigi', title: '주연이 생일 선물',
        detail: '작년 후기 좋았던 옵션 3개 준비했어요.',
        primary: '미리보기',     secondary: '나중에' },
    ],
    working: [
      { agentId: 'eui-ri',      task: '병원 영수증 인식 중', detail: '서류 1건' },
      { agentId: 'sallim-i',    task: '카드내역 분류 중',  detail: '74%', progress: 74 },
      { agentId: 'hwal-do-ri',  task: '루틴 준비 중',      detail: '대기' },
    ],
  },
  team: {
    title: '내 비서팀',
    subtitle: '7명이 함께해요',
    ctaNew: '새 비서 데려오기',
    filters: ['전체', '챙기는 중', '재무', '건강', '관계', '취미·일정'],
    emptyHire: '80+ 비서가 라이브러리에 있어요',
  },
  knowledge: {
    title: '나의 기록',
    subtitle: 'My KB',
    weekBlurb: '비서들이 함께 정리하면 여기에 내 일상이 그래프로 쌓여요.',
    categories: ['가계·소비', '건강·운동', '감정·일기', '관계·기념일', '취미·콘텐츠', '여행', '일정·할 일', '문서·계약'],
    sampleNodeTitle: '주연 (친한 친구)',
    sampleNodeFields: [
      ['알게 된 날',    '2018년 3월'],
      ['지난 만남',    '4월 27일'],
      ['좋아하는 카페', '연남동 노티드'],
      ['알레르기',     '갑각류'],
    ],
  },
  library: {
    title: '비서 만나기',
    subtitle: '80+ 비서',
    heroEyebrow: 'Hire',
    heroTitle: '내 일상을 도와줄 비서를 만나보세요',
    searchPlaceholder: '도움받고 싶은 일을 검색하세요 — 예: 가계부 정리, 운동 루틴',
    audienceChips: ['전체', '재무·소비', '건강·운동', '마음·일기', '관계', '취미·여행'],
    audienceActive: '재무·소비',
    rows: [
      { eyebrow: 'Picked for you', title: '바쁜 분께 추천하는 비서' },
      { eyebrow: 'Money',          title: '돈·구독 정리 비서' },
      { eyebrow: 'Wellbeing',      title: '건강·마음 비서' },
    ],
    cta: '데려오기',
  },
  plan: {
    audience: '나의 일상을 도와주는 첫 비서',
    tip: '연간 결제 시 한 달치 절약돼요.',
  },
};

const PACK_WORKER = {
  id: 'worker',
  label: '직장인',
  longLabel: '직장인 · 팀',
  icon: 'building',
  accent: '--agent-sky',
  ownerLabel: '님',
  workspace: { name: '재훈의 데스크', subtitle: 'Customer · 직장인' },
  agents: AGENTS_WORKER,
  home: {
    eyebrow: 'Today · 오전 9:47',
    greetingTitle: '안녕하세요 재훈 님.',
    greetingSubtitle: '오늘 동료 AI 들이 이런 일을 정리해뒀어요.',
    feedTitle: '오늘 정리된 일',
    nudgeTitle: '내 결정이 필요한 일',
    workingTitle: '지금 처리 중',
    weekKB: '이번 주 업무 노트',
    weekKBSub: '새 노드 27개 · 새 연결 64개',
    planLabel: '월 토큰 사용량',
    stats: [
      { label: '정리된 메일·메시지', value: '142건', delta: +18, hint: '인박스 + 소통이', chart: 'bar',  data: [22, 28, 31, 26, 34, 38, 42] },
      { label: '문서 초안',         value: '6편',    delta: +2,   hint: '리포트가 작성',   chart: 'line', data: [2, 3, 4, 3, 5, 6] },
      { label: '회의록·노트',        value: '11편',   delta: null, hint: '미팅이 + 노트',   chart: 'network' },
    ],
    feed: {
      now: [
        { agent: 'meeting-i',  verb: '회의록 초안을 만들었어요', target: '제품 주간 · 09:00 회의',
          detail: '결정 4건 · 액션 7건 · 다음 회의 안건 3건. 본인 발언 인용 정확도 97%.',
          time: '5분 전', status: 'working' },
        { agent: 'inbox-i',    verb: '인박스를 분류했어요', target: '오전 메일 47통',
          detail: '읽음 정리 32 · 답신 초안 9 · 회의 요청 3 · 행동 필요 3.', time: '15분 전' },
      ],
      morning: [
        { agent: 'research-i', verb: '경쟁사 자료를 정리했어요', target: "'B사 가격 정책 변경 정리'",
          detail: '주요 변경 3가지 + 우리 영향 추정 + 의사결정 카드 1장. 출처 6개 인용.', time: '8:54' },
        { agent: 'data-yi',    verb: '주간 KPI 대시보드를 새로 그렸어요', target: "'5월 4주차'",
          detail: 'MAU +4.8% · 잔존율 D7 +2.1pp. 그래프 캡션은 한 번 봐주세요.', time: '8:36' },
        { agent: 'issue-i',    verb: '내 이슈 상태를 정리했어요', target: '진행 6 · 검토 2 · 블록 1',
          detail: '블록 1건 = 디자인 검토 대기 24시간 초과. 슬랙 멘션 초안 준비됨.', time: '8:14' },
      ],
      yesterday: [
        { agent: 'sokong-i',   verb: '어제 슬랙을 요약했어요', target: '#product · 52건',
          detail: '결정 3건 · 멘션 받은 항목 4건. 새벽 대화는 모두 #design 채널.', time: '어제 23:12' },
      ],
    },
    nudges: [
      { agentId: 'meeting-i', title: '회의록 검토 후 공유',
        detail: '결정 사항 4건 확인 후 #product 채널에 자동 공유 가능.',
        primary: '검토 후 공유', secondary: '내가 직접' },
      { agentId: 'issue-i',   title: '디자인 검토 24h 초과 1건',
        detail: '담당자에게 친절한 리마인드 초안 준비됨.',
        primary: '리마인드 보내기', secondary: '나중에' },
      { agentId: 'research-i', title: '경쟁사 자료 결정 카드',
        detail: '우리 가격 정책 대응 옵션 3가지 정리됨.',
        primary: '의사결정 미팅 잡기', secondary: '나중에' },
    ],
    working: [
      { agentId: 'meeting-i',  task: '회의록 정리 중',  detail: '79%', progress: 79 },
      { agentId: 'data-yi',    task: 'KPI 쿼리 실행',  detail: '대기' },
      { agentId: 'inbox-i',    task: '메일 분류 중',   detail: '대기' },
    ],
  },
  team: {
    title: '내 동료팀',
    subtitle: '7명이 함께 일해요',
    ctaNew: '새 동료 추가',
    filters: ['전체', '처리 중', '문서·노트', '데이터', '커뮤니케이션', '트래커'],
    emptyHire: '60+ 동료가 라이브러리에 있어요',
  },
  knowledge: {
    title: '업무 노트',
    subtitle: 'Work KB',
    weekBlurb: '동료들이 함께 정리한 회의·문서·결정이 그래프로 쌓여요.',
    categories: ['프로젝트', '결정 기록', '회의록', 'KPI·데이터', '경쟁사·시장', '제품·기능', '팀·사람', '문서·계약'],
    sampleNodeTitle: '5월 4주차 제품 주간 회의',
    sampleNodeFields: [
      ['일시',         '5월 28일 09:00'],
      ['참석',         '6명'],
      ['결정',         '4건'],
      ['관련 KPI',     'MAU · D7 잔존'],
    ],
  },
  library: {
    title: '동료 만나기',
    subtitle: '60+ 동료',
    heroEyebrow: 'Hire',
    heroTitle: '내 업무를 도와줄 동료를 만나보세요',
    searchPlaceholder: '도움받고 싶은 일을 검색하세요 — 예: 회의록 정리, 경쟁사 리서치',
    audienceChips: ['전체', '제품 매니저', '디자이너', '개발자', '마케터', '리서처'],
    audienceActive: '제품 매니저',
    rows: [
      { eyebrow: 'Picked for you', title: '제품 매니저에게 추천하는 동료' },
      { eyebrow: 'Writing',        title: '문서·보고서 동료' },
      { eyebrow: 'Numbers',        title: '데이터·KPI 동료' },
    ],
    cta: '데려오기',
  },
  plan: {
    audience: '바쁜 1인의 업무 보조',
    tip: '연간 결제 시 한 달치 절약돼요.',
  },
};

const PERSONAS    = [PACK_SHOP, PACK_PERSONAL, PACK_WORKER];
const PERSONA_BY_ID = Object.fromEntries(PERSONAS.map(p => [p.id, p]));

/* ────────────────────────────────────────────────────────────────────
 * Context — usePersona() everywhere
 * ──────────────────────────────────────────────────────────────────── */
const PersonaCtx = React.createContext(PACK_SHOP);

function PersonaProvider({ persona, children }) {
  const pack = typeof persona === 'string'
    ? (PERSONA_BY_ID[persona] || PACK_SHOP)
    : (persona || PACK_SHOP);
  return <PersonaCtx.Provider value={pack}>{children}</PersonaCtx.Provider>;
}
function usePersona() { return React.useContext(PersonaCtx); }

/* Agent lookup by id, persona-aware. Falls back to original AGENT_BY_ID
 * (the 소상공인 roster) so existing screen-* files keep working. */
function getAgent(idOrPack, maybeId) {
  // (pack, id) signature
  if (typeof idOrPack === 'object' && idOrPack && idOrPack.agents) {
    const a = idOrPack.agents.find(x => x.id === maybeId);
    if (a) return a;
  }
  // (id) signature — try every persona
  const id = typeof idOrPack === 'string' ? idOrPack : maybeId;
  for (const p of PERSONAS) {
    const a = p.agents.find(x => x.id === id);
    if (a) return a;
  }
  return AGENT_BY_ID && AGENT_BY_ID[id];
}

export {
  PERSONAS, PERSONA_BY_ID,
  PACK_SHOP, PACK_PERSONAL, PACK_WORKER,
  PersonaCtx, PersonaProvider, usePersona, getAgent,
};
