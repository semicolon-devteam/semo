/**
 * KB 대량 데이터 투입 스크립트
 * memory 파일들에서 추출한 팀 지식을 knowledge_base + bot_knowledge에 upsert
 * Voyage-3 (1024 dim) 임베딩 자동 생성
 */

const { Pool } = require("pg");

const pool = new Pool({
  host: "127.0.0.1", port: 15432, user: "app",
  password: "ProductionPassword2024!@#", database: "appdb", ssl: false,
});

const VOYAGE_KEY = "pa-Y0tghHW8EVRVhTRmDoIpHuuNx6JBs1sZzBwqQMgCISN";

async function genEmbeddings(texts) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: "Bearer " + VOYAGE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "voyage-3", input: texts, output_dimension: 1024 }),
  });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

// ============================================================
// 공통 KB 데이터 (knowledge_base)
// ============================================================
const KB_DATA = [
  // === TEAM ===
  { domain: "team", key: "reus", content: "전준영 (Reus). 프론트 리드/협업 매니저, 팀 리더. 전체 프로젝트 관리, 의사결정. Slack: URSQYUNQJ.", created_by: "semiclaw" },
  { domain: "team", key: "garden", content: "서정원 (Garden). 시스템 아키텍처/기술 통합 리드. 인프라 변경 최종 승인권. Slack: URU4UBX9R.", created_by: "semiclaw" },
  { domain: "team", key: "yeomso", content: "염현준 (Yeomso). 디자인총괄/UI·UX, CMO/마케팅 전권, SI 매니저. 크몽/위시캣/숨고 관리. 본업 있음(18시 퇴근, 20~21시부터 팀 업무). Slack: U01KH8V6ZHP.", created_by: "semiclaw" },
  { domain: "team", key: "roki", content: "노영록 (Roki). 서비스총괄/그로스 디렉터. 링크타/매출지킴이 담당. Slack: U08P11ZQY04.", created_by: "semiclaw" },
  { domain: "team", key: "bon", content: "bon. 랜드/오피스 풀스택 개발 전담. core-backend 담당. Slack: U09LF7ZS5GR.", created_by: "semiclaw" },
  { domain: "team", key: "kyago", content: "강용준 (kyago). 백엔드 리더. ServiceMaker MVP 완료. Slack: U02G8542V9U.", created_by: "semiclaw" },
  { domain: "team", key: "bae", content: "Bae. 신규 엔지니어 (인프라/백엔드). 신입이지만 큰 영향력. Slack: U0A54SCQS84.", created_by: "semiclaw" },
  { domain: "team", key: "harry-lee", content: "Harry Lee. 시니어 FE (쿠팡/유니티 출신). 정치판 오너십(순수익 30% 배분). 2026-02-10 합류. 코파운더 아님. Slack: U08PB15P4AV.", created_by: "semiclaw" },
  { domain: "team", key: "goni", content: "Goni. 오피스 프로젝트 서비스 운영/QA. Slack: U09NRR79YCW.", created_by: "semiclaw" },
  { domain: "team", key: "kai", content: "Kai. 견습 엔지니어. celeb-map 작업. Slack: U0A4W1U0BAN.", created_by: "semiclaw" },
  { domain: "team", key: "dwight-k", content: "dwight.k. 외부 협업자 (카카오모빌리티 FE). 매출지킴이 공동개발, 곧 독립. Slack: U01KNHM6PK3.", created_by: "semiclaw" },

  // === PROJECT (active) ===
  { domain: "project", key: "ps", content: "PS — 영상통화 앱. 지분 20%. 앱스토어 심사 대기. 담당: Reus.", created_by: "semiclaw" },
  { domain: "project", key: "gameland", content: "게임랜드 — 랜드 분리 프로젝트. 지분 25%. 활발히 개발 중. 대외비. 담당: Reus, bon.", created_by: "semiclaw" },
  { domain: "project", key: "playland", content: "플레이랜드 — 랜드 분리, Spring Boot 마이그레이션 중. 지분 25%. 대외비. 담당: Reus, bon.", created_by: "semiclaw" },
  { domain: "project", key: "office-community", content: "오피스 커뮤니티 — v1.0.33, Spring Boot 마이그레이션 중. 지분 25%. 대외비. 담당: Reus, bon, Goni(운영/QA).", created_by: "semiclaw" },
  { domain: "project", key: "jungchipan", content: "정치판 — 정치 커뮤니티 서비스. Harry Lee 오너십, 순수익 30% 배분. 숏폼/토론. SEO 중점. 담당: Harry Lee, Roki, Yeomso.", created_by: "semiclaw" },
  { domain: "project", key: "bebecare", content: "BebeCare — 임신/출산/육아 AI 슈퍼앱. UI 컴포넌트 통합 + Storybook 구축 중. 담당: Reus.", created_by: "semiclaw" },
  { domain: "project", key: "nojo-mgmt", content: "노조관리 — SI 프로젝트. 운영 전환 단계. 담당: Reus.", created_by: "semiclaw" },
  { domain: "project", key: "core-backend", content: "core-backend — 공통 백엔드. Kotlin/Spring Boot. 활발히 개발 중. 담당: bon.", created_by: "semiclaw" },
  { domain: "project", key: "point-exchanger", content: "포인트 통합 생태계 — 랜드 간 포인트 교환 시스템. ms-point-exchanger 마이크로서비스.", created_by: "semiclaw" },
  { domain: "project", key: "byebuyer", content: "바이바이어 — 개발 중. 담당: Reus.", created_by: "semiclaw" },
  { domain: "project", key: "celeb-map", content: "Celeb Map — Sprint 1 완료, 다음 스텝 대기. 담당: Kai.", created_by: "semiclaw" },
  { domain: "project", key: "axoracle", content: "AXOracle — 다크모드 제거 완료. 담당: Reus.", created_by: "semiclaw" },

  // === DECISION ===
  { domain: "decision", key: "oci-deploy", content: "2026-03-02: 신규 프로젝트는 Vercel 대신 OCI 환경 기반 배포로 전환.", created_by: "semiclaw" },
  { domain: "decision", key: "github-workflow", content: "봇 간 인계는 GitHub 이슈 라벨+폴링 방식만 사용. Slack 직접 멘션 인계 전면 금지 (2026-02-20).", created_by: "semiclaw" },
  { domain: "decision", key: "slack-output-rule", content: "최종 결과만 Slack에 보고. 중간 과정/예고성 메시지 금지. 1작업=1메시지. 위반 시 에스컬레이션 (2026-02-19).", created_by: "semiclaw" },
  { domain: "decision", key: "thread-reply", content: "채널에서 메시지 답변 시 기본적으로 스레드(reply)로 달 것 (2026-02-18).", created_by: "semiclaw" },
  { domain: "decision", key: "infra-change-control", content: "인프라 변경은 Garden 승인 필수. 모니터링/진단은 자유, 변경(코드/배포/시크릿)은 승인 후. 공용 레포 단독 수정 금지 (2026-02-18).", created_by: "semiclaw" },
  { domain: "decision", key: "design-workflow", content: "디자인 산출물은 반드시 HTML 프로토타입+인터랙티브 프리뷰 먼저. Reus 승인 후에만 구현 이슈 생성. 마크다운만 작성 후 바로 이슈 생성 금지 (2026-03-01).", created_by: "semiclaw" },
  { domain: "decision", key: "security-contract", content: "계약/금액 정보는 업무 채널에서 절대 언급 금지. 리더 DM 또는 개발사업팀 채널에서만.", created_by: "semiclaw" },
  { domain: "decision", key: "bot-no-promise", content: "모든 봇: '하겠습니다' 패턴 금지. Tool call 없는 약속 금지. 한 거 보고해, 할 거 예고하지 마 (2026-02-24).", created_by: "semiclaw" },
  { domain: "decision", key: "reviewclaw-merge", content: "ReviewClaw는 직접 머지하지 않음. Approve 후 담당자에게 머지 승인 요청. 담당자 모르면 SemiClaw에게 확인 (2026-03-04).", created_by: "semiclaw" },
  { domain: "decision", key: "issue-rr", content: "이슈 등록: 버그/단순수정→SemiClaw 등록→WorkClaw 인계. 기획 필요→PlanClaw 기획→이슈 생성→WorkClaw. 한 기능에 한 이슈, 중복 금지.", created_by: "semiclaw" },

  // === PROCESS ===
  { domain: "process", key: "github-workflow-process", content: "작업 인계: 요청 접수→SemiClaw GitHub 이슈 생성+bot:* 라벨→담당 봇 폴링 감지→작업 수행. Projects 보드 등록 필수. 권한 문제 시 bot:blocked 라벨.", created_by: "semiclaw" },
  { domain: "process", key: "bot-info-sharing", content: "봇 간 정보 공유: #bot-ops에서 멘션 질의. 태그: [bot:info-req], [bot:info-res], [bot:info-unknown]. 누구에게 물을지 모르면 SemiClaw에게 먼저.", created_by: "semiclaw" },
  { domain: "process", key: "weekly-report", content: "매주 금요일 14:00 주간 리포트→#개발사업팀. 매주 목요일 14:00 담당자별 컨텍스트 DM 수집.", created_by: "semiclaw" },
  { domain: "process", key: "team-checkin", content: "매일 평일 12~18시 하루 2~3명 DM 안부 체크인. 크론잡: 13:00, 15:30. 특이사항 발견 시 Reus 보고.", created_by: "semiclaw" },
  { domain: "process", key: "calendar-routine", content: "매일 오전 10시 오늘+내일 일정 확인→참석자 리마인드 DM. 어제 미팅 후 참석자에게 결과 물어보기.", created_by: "semiclaw" },
  { domain: "process", key: "wishket-crawl", content: "매일 9:00 위시캣 프로젝트 크롤링→40점 이상→Slack 전송 (#wishket-alert, @yeomso). 현재 BASIC 등급.", created_by: "semiclaw" },

  // === INFRA ===
  { domain: "infra", key: "central-db", content: "PostgreSQL 16. Docker container pg16-primary on 10.0.0.91. Bastion: 152.70.244.169 (opc@semi-vpn). DB: appdb, User: app. pgvector 0.8.0 설치. SSH key: oci_dev_rsa.", created_by: "semiclaw" },
  { domain: "infra", key: "github-org", content: "GitHub org: semicolon-devteam. Projects 보드 #1. gh-aw (GitHub Agentic Workflows) 엔진 사용. 봇별 팀 멘션 설정.", created_by: "semiclaw" },
  { domain: "infra", key: "slack-channels", content: "#bot-ops(C0AFBQ209E0): 봇 간 소통. #개발사업팀(C020RQTNPFY): 리더 보고. #platform-land(C0AEFRMN0E9): 랜드 개발.", created_by: "semiclaw" },
  { domain: "infra", key: "tech-stack", content: "주요 기술 스택: TypeScript, React/Next.js (FE), Kotlin/Spring Boot (BE), React Native (모바일), HCL/Terraform (인프라), Supabase, PostgreSQL, pgvector.", created_by: "semiclaw" },
  { domain: "infra", key: "bot-architecture", content: "8개 봇 팀: SemiClaw(PM), WorkClaw(개발), PlanClaw(기획), ReviewClaw(리뷰), DesignClaw(디자인), GrowthClaw(그로스), InfraClaw(인프라), ReusClaw(별개PC). 각각 독립 OpenClaw 인스턴스.", created_by: "semiclaw" },
  { domain: "infra", key: "semo-kb", content: "KB(Knowledge Base): semo 스키마, PostgreSQL. knowledge_base(공통), bot_knowledge(봇별), ontology(도메인 정의). Voyage-3 임베딩(1024dim), HNSW 인덱스.", created_by: "semiclaw" },
];

// ============================================================
// 봇별 KB 데이터 (bot_knowledge)
// ============================================================
const BOT_KB_DATA = [
  // SemiClaw
  { bot_id: "semiclaw", domain: "config", key: "heartbeat-checks", content: "이메일, 캘린더, 멘션, 날씨를 로테이션으로 2-4회/일 체크. HEARTBEAT.md에 체크리스트 관리." },
  { bot_id: "semiclaw", domain: "config", key: "slack-channels", content: "#bot-ops(C0AFBQ209E0), #platform-land(C0AEFRMN0E9), #_협업(C09KNL91QBZ), #개발사업팀(C020RQTNPFY) 모니터링." },
  { bot_id: "semiclaw", domain: "config", key: "role", content: "PM/오케스트레이터. 프로젝트 현황, 팀원 정보, 일정, 의사결정, 채널/레포 매핑 담당. 전문 영역은 해당 봇에 인계." },

  // WorkClaw
  { bot_id: "workclaw", domain: "config", key: "code-style", content: "TypeScript strict mode. ESLint + Prettier. PR은 bot:workclaw 라벨로 할당." },
  { bot_id: "workclaw", domain: "config", key: "role", content: "개발 전담. 코드 작성/수정/구현, 앱스토어 배포, Fastlane/CI/CD. GitHub 이슈 기반 작업." },

  // ReviewClaw
  { bot_id: "reviewclaw", domain: "config", key: "role", content: "PR 리뷰 전담. 코드 품질 스캔, E2E 테스트, 기술 부채 탐지. Approve 후 담당자에게 머지 승인 요청 (직접 머지 금지)." },

  // PlanClaw
  { bot_id: "planclaw", domain: "config", key: "role", content: "기획 전담. PRD/Epic 작성, UX 설계, Issue Card 형식 기획서. 기획 필요 기능→이슈 생성→WorkClaw 인계." },

  // DesignClaw
  { bot_id: "designclaw", domain: "config", key: "role", content: "디자인 전담. HTML 프로토타입(TailwindCSS), Canvas 프리뷰 제공. Reus 승인 후에만 구현 이슈 생성. 마크다운만 작성 금지." },

  // InfraClaw
  { bot_id: "infraclaw", domain: "config", key: "role", content: "인프라/CI/CD/배포 전담. 모니터링/진단 자유, 변경은 Garden 승인 필수. 공용 레포 단독 수정 금지." },

  // GrowthClaw
  { bot_id: "growthclaw", domain: "config", key: "role", content: "그로스/마케팅 전담. SEO, Lighthouse, 마케팅 지표, 경쟁사 분석." },
];

async function main() {
  console.log("=== KB 대량 데이터 투입 시작 ===\n");

  // 1. knowledge_base upsert
  console.log(`[1/3] knowledge_base: ${KB_DATA.length}건 upsert...`);
  for (const row of KB_DATA) {
    await pool.query(
      `INSERT INTO semo.knowledge_base (domain, key, content, created_by, metadata)
       VALUES ($1, $2, $3, $4, '{}')
       ON CONFLICT (domain, key) DO UPDATE SET content = $3, updated_at = NOW()`,
      [row.domain, row.key, row.content, row.created_by]
    );
  }
  console.log(`  ✅ ${KB_DATA.length}건 upsert 완료`);

  // 2. bot_knowledge upsert
  console.log(`[2/3] bot_knowledge: ${BOT_KB_DATA.length}건 upsert...`);
  for (const row of BOT_KB_DATA) {
    await pool.query(
      `INSERT INTO semo.bot_knowledge (bot_id, domain, key, content, metadata)
       VALUES ($1, $2, $3, $4, '{}')
       ON CONFLICT (bot_id, domain, key) DO UPDATE SET content = $4, updated_at = NOW()`,
      [row.bot_id, row.domain, row.key, row.content]
    );
  }
  console.log(`  ✅ ${BOT_KB_DATA.length}건 upsert 완료`);

  // 3. 임베딩 생성 (embedding이 NULL인 것만)
  console.log("[3/3] 임베딩 생성 (Voyage-3, 1024dim)...");

  // KB
  const kbNull = await pool.query("SELECT kb_id, domain, key, content FROM semo.knowledge_base WHERE embedding IS NULL ORDER BY kb_id");
  if (kbNull.rows.length > 0) {
    console.log(`  KB: ${kbNull.rows.length}건 임베딩 생성 중...`);
    // batch 10개씩
    for (let i = 0; i < kbNull.rows.length; i += 10) {
      const batch = kbNull.rows.slice(i, i + 10);
      const texts = batch.map((r) => r.domain + ": " + r.key + " — " + r.content);
      const embs = await genEmbeddings(texts);
      for (let j = 0; j < batch.length; j++) {
        await pool.query("UPDATE semo.knowledge_base SET embedding = $1 WHERE kb_id = $2",
          ["[" + embs[j].join(",") + "]", batch[j].kb_id]);
      }
      console.log(`    batch ${i/10+1}: ${batch.length}건 완료`);
    }
  }

  // Bot KB
  const bkNull = await pool.query("SELECT id, bot_id, domain, key, content FROM semo.bot_knowledge WHERE embedding IS NULL ORDER BY id");
  if (bkNull.rows.length > 0) {
    console.log(`  BotKB: ${bkNull.rows.length}건 임베딩 생성 중...`);
    const texts = bkNull.rows.map((r) => r.bot_id + "/" + r.domain + ": " + r.key + " — " + r.content);
    const embs = await genEmbeddings(texts);
    for (let j = 0; j < bkNull.rows.length; j++) {
      await pool.query("UPDATE semo.bot_knowledge SET embedding = $1 WHERE id = $2",
        ["[" + embs[j].join(",") + "]", bkNull.rows[j].id]);
    }
    console.log(`    ${bkNull.rows.length}건 완료`);
  }

  // 최종 확인
  const s1 = await pool.query("SELECT count(*) as total, count(embedding) as emb FROM semo.knowledge_base");
  const s2 = await pool.query("SELECT count(*) as total, count(embedding) as emb FROM semo.bot_knowledge");
  const domains = await pool.query("SELECT domain, count(*) as cnt FROM semo.knowledge_base GROUP BY domain ORDER BY domain");
  const bots = await pool.query("SELECT bot_id, count(*) as cnt FROM semo.bot_knowledge GROUP BY bot_id ORDER BY bot_id");

  console.log("\n=== 최종 결과 ===");
  console.log("knowledge_base:", s1.rows[0]);
  console.log("bot_knowledge:", s2.rows[0]);
  console.log("\n도메인별:");
  domains.rows.forEach((r) => console.log(`  ${r.domain}: ${r.cnt}건`));
  console.log("\n봇별:");
  bots.rows.forEach((r) => console.log(`  ${r.bot_id}: ${r.cnt}건`));

  // 벡터 검색 테스트
  console.log("\n=== 벡터 검색 테스트 ===");
  const testQueries = ["프론트엔드 개발자 누구야?", "랜드 프로젝트 현황", "봇 간 작업 인계 규칙"];
  for (const q of testQueries) {
    const qEmb = (await genEmbeddings([q]))[0];
    const res = await pool.query(
      "SELECT key, domain, 1-(embedding <=> $1::vector) as sim FROM semo.knowledge_base ORDER BY embedding <=> $1::vector LIMIT 3",
      ["[" + qEmb.join(",") + "]"]
    );
    console.log(`\n  Q: "${q}"`);
    res.rows.forEach((r) => console.log(`    ${r.domain}/${r.key}: ${(r.sim * 100).toFixed(1)}%`));
  }

  await pool.end();
  console.log("\n✅ 완료!");
}

main().catch((e) => { console.error(e); process.exit(1); });
