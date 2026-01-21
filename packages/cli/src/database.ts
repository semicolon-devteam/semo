/**
 * SEMO CLI - PostgreSQL 데이터베이스 클라이언트
 *
 * 팀 코어 PostgreSQL에서 스킬, 커맨드, 에이전트 정보를 조회합니다.
 * DB 연결 실패 시 하드코딩된 폴백 데이터를 사용합니다.
 *
 * v3.14.0: Supabase → PostgreSQL 전환
 * - semo-system 의존성 제거
 * - 문서 내용을 DB에서 직접 조회
 */

import { Pool, PoolClient } from "pg";

// PostgreSQL 연결 정보 (팀 코어)
const DB_CONFIG = {
  host: process.env.SEMO_DB_HOST || "3.38.162.21",
  port: parseInt(process.env.SEMO_DB_PORT || "5432"),
  user: process.env.SEMO_DB_USER || "app",
  password: process.env.SEMO_DB_PASSWORD || "ProductionPassword2024!@#",
  database: process.env.SEMO_DB_NAME || "appdb",
  ssl: false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
};

// PostgreSQL Pool (싱글톤)
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool(DB_CONFIG);
  }
  return pool;
}

// DB 연결 가능 여부 확인
let dbAvailable: boolean | null = null;

async function checkDbConnection(): Promise<boolean> {
  if (dbAvailable !== null) return dbAvailable;

  try {
    const client = await getPool().connect();
    await client.query("SELECT 1");
    client.release();
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }

  return dbAvailable;
}

// ============================================================
// 타입 정의
// ============================================================

export interface Skill {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  content: string;
  category: string;
  package: string;
  is_active: boolean;
  is_required: boolean;
  install_order: number;
  version: string;
}

export interface SemoCommand {
  id: string;
  name: string;
  folder: string;
  content: string;
  description: string | null;
  is_active: boolean;
}

export interface Agent {
  id: string;
  name: string;
  display_name: string;
  content: string;
  package: string;
  is_active: boolean;
  install_order: number;
}

export interface Package {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  layer: string;
  package_type: string;
  version: string;
  is_active: boolean;
  is_required: boolean;
  install_order: number;
}

// ============================================================
// 폴백 데이터 (DB 연결 실패 시 사용)
// ============================================================

const FALLBACK_SKILLS: Skill[] = [
  // Workflow Management (3개)
  {
    id: "sk-1",
    name: "workflow-start",
    display_name: "워크플로우 시작",
    description: "워크플로우 인스턴스 생성 및 시작",
    content: `---
name: workflow-start
description: 워크플로우 인스턴스 생성 및 시작
---

# workflow-start

워크플로우 인스턴스를 생성하고 시작합니다.

## Usage

\`\`\`
skill:workflow-start workflow_command="greenfield"
\`\`\`
`,
    category: "workflow",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 1,
    version: "1.0.0",
  },
  {
    id: "sk-2",
    name: "workflow-progress",
    display_name: "워크플로우 진행",
    description: "워크플로우 진행 상황 조회",
    content: `---
name: workflow-progress
description: 워크플로우 진행 상황 조회
---

# workflow-progress

진행 중인 워크플로우의 현재 상태를 조회합니다.
`,
    category: "workflow",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 2,
    version: "1.0.0",
  },
  {
    id: "sk-3",
    name: "workflow-resume",
    display_name: "워크플로우 재개",
    description: "중단된 워크플로우 재개",
    content: `---
name: workflow-resume
description: 중단된 워크플로우 재개
---

# workflow-resume

중단된 워크플로우를 재개합니다.
`,
    category: "workflow",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 3,
    version: "1.0.0",
  },

  // Discovery (1개)
  {
    id: "sk-10",
    name: "ideate",
    display_name: "아이디에이션",
    description: "아이디어 발굴 및 분석",
    content: `---
name: ideate
description: 아이디어 발굴 및 분석
---

# ideate

새로운 아이디어를 발굴하고 분석합니다.
`,
    category: "discovery",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 10,
    version: "1.0.0",
  },

  // Planning (3개)
  {
    id: "sk-20",
    name: "create-epic",
    display_name: "Epic 생성",
    description: "Epic 이슈 생성",
    content: `---
name: create-epic
description: Epic 이슈 생성
---

# create-epic

Epic 이슈를 생성합니다.
`,
    category: "planning",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 20,
    version: "1.0.0",
  },
  {
    id: "sk-21",
    name: "design-user-flow",
    display_name: "사용자 흐름 설계",
    description: "UX 사용자 흐름 다이어그램 설계",
    content: `---
name: design-user-flow
description: UX 사용자 흐름 다이어그램 설계
---

# design-user-flow

사용자 흐름을 설계합니다.
`,
    category: "planning",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 21,
    version: "1.0.0",
  },
  {
    id: "sk-22",
    name: "generate-mockup",
    display_name: "목업 생성",
    description: "UI 목업 생성",
    content: `---
name: generate-mockup
description: UI 목업 생성
---

# generate-mockup

UI 목업을 생성합니다.
`,
    category: "planning",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 22,
    version: "1.0.0",
  },

  // Solutioning (4개)
  {
    id: "sk-30",
    name: "scaffold-domain",
    display_name: "도메인 스캐폴딩",
    description: "DDD 4-layer 도메인 구조 생성",
    content: `---
name: scaffold-domain
description: DDD 4-layer 도메인 구조 생성
---

# scaffold-domain

DDD 4-layer 도메인 구조를 생성합니다.
`,
    category: "solutioning",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 30,
    version: "1.0.0",
  },
  {
    id: "sk-31",
    name: "validate-architecture",
    display_name: "아키텍처 검증",
    description: "DDD 4-layer 아키텍처 준수 검증",
    content: `---
name: validate-architecture
description: DDD 4-layer 아키텍처 준수 검증
---

# validate-architecture

아키텍처 준수 여부를 검증합니다.
`,
    category: "solutioning",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 31,
    version: "1.0.0",
  },
  {
    id: "sk-32",
    name: "generate-spec",
    display_name: "명세 생성",
    description: "Speckit 워크플로우 통합 실행",
    content: `---
name: generate-spec
description: Speckit 워크플로우 통합 실행
---

# generate-spec

명세 문서를 생성합니다.
`,
    category: "solutioning",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 32,
    version: "1.0.0",
  },
  {
    id: "sk-33",
    name: "design-tests",
    display_name: "테스트 설계",
    description: "구현 전 테스트 케이스 설계 (TDD)",
    content: `---
name: design-tests
description: 구현 전 테스트 케이스 설계 (TDD)
---

# design-tests

테스트 케이스를 설계합니다.
`,
    category: "solutioning",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 33,
    version: "1.0.0",
  },

  // Implementation (6개)
  {
    id: "sk-40",
    name: "create-sprint",
    display_name: "스프린트 생성",
    description: "Sprint 목표 설정 및 시작",
    content: `---
name: create-sprint
description: Sprint 목표 설정 및 시작
---

# create-sprint

스프린트를 생성하고 시작합니다.
`,
    category: "implementation",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 40,
    version: "1.0.0",
  },
  {
    id: "sk-41",
    name: "start-task",
    display_name: "태스크 시작",
    description: "작업 시작 (이슈 상태 변경, 브랜치 생성)",
    content: `---
name: start-task
description: 작업 시작 (이슈 상태 변경, 브랜치 생성)
---

# start-task

태스크를 시작합니다.
`,
    category: "implementation",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 41,
    version: "1.0.0",
  },
  {
    id: "sk-42",
    name: "review-task",
    display_name: "태스크 리뷰",
    description: "태스크 이슈 기반 구현 완료 리뷰",
    content: `---
name: review-task
description: 태스크 이슈 기반 구현 완료 리뷰
---

# review-task

태스크 구현을 리뷰합니다.
`,
    category: "implementation",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 42,
    version: "1.0.0",
  },
  {
    id: "sk-43",
    name: "write-code",
    display_name: "코드 작성",
    description: "코드 작성, 수정, 구현",
    content: `---
name: write-code
description: 코드 작성, 수정, 구현
---

# write-code

코드를 작성합니다.
`,
    category: "implementation",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 43,
    version: "1.0.0",
  },
  {
    id: "sk-44",
    name: "run-code-review",
    display_name: "코드 리뷰",
    description: "프로젝트 통합 코드 리뷰",
    content: `---
name: run-code-review
description: 프로젝트 통합 코드 리뷰
---

# run-code-review

코드 리뷰를 실행합니다.
`,
    category: "implementation",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 44,
    version: "1.0.0",
  },
  {
    id: "sk-45",
    name: "close-sprint",
    display_name: "스프린트 종료",
    description: "Sprint 종료 및 회고 정리",
    content: `---
name: close-sprint
description: Sprint 종료 및 회고 정리
---

# close-sprint

스프린트를 종료합니다.
`,
    category: "implementation",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 45,
    version: "1.0.0",
  },

  // Supporting (2개)
  {
    id: "sk-50",
    name: "git-workflow",
    display_name: "Git 워크플로우",
    description: "Git 커밋/푸시/PR 자동화",
    content: `---
name: git-workflow
description: Git 커밋/푸시/PR 자동화
---

# git-workflow

Git 워크플로우를 자동화합니다.
`,
    category: "supporting",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 50,
    version: "1.0.0",
  },
  {
    id: "sk-51",
    name: "notify-slack",
    display_name: "Slack 알림",
    description: "Slack 채널에 메시지 전송",
    content: `---
name: notify-slack
description: Slack 채널에 메시지 전송
---

# notify-slack

Slack에 알림을 전송합니다.
`,
    category: "supporting",
    package: "core",
    is_active: true,
    is_required: true,
    install_order: 51,
    version: "1.0.0",
  },
];

const FALLBACK_COMMANDS: SemoCommand[] = [
  {
    id: "cmd-1",
    name: "help",
    folder: "SEMO",
    content: `# /SEMO:help

SEMO 도움말을 표시합니다.

## Usage

\`\`\`
/SEMO:help
\`\`\`
`,
    description: "SEMO 도움말",
    is_active: true,
  },
  {
    id: "cmd-2",
    name: "dry-run",
    folder: "SEMO",
    content: `# /SEMO:dry-run

명령을 실행하지 않고 라우팅 결과만 확인합니다.

## Usage

\`\`\`
/SEMO:dry-run {프롬프트}
\`\`\`
`,
    description: "명령 검증 (라우팅 시뮬레이션)",
    is_active: true,
  },
  {
    id: "cmd-3",
    name: "greenfield",
    folder: "SEMO-workflow",
    content: `# /SEMO-workflow:greenfield

BMad Method Greenfield Workflow를 시작합니다.

## Purpose

새로운 프로젝트를 처음부터 구축하는 4-Phase 워크플로우입니다.

\`\`\`
Phase 1: Discovery (Optional) - 아이디어 발굴 및 분석
Phase 2: Planning (Required) - PRD/Epic 생성 및 UX 설계
Phase 3: Solutioning (Required) - 아키텍처 및 명세 작성
Phase 4: Implementation (Required) - 스프린트 기반 개발
\`\`\`

## Usage

\`\`\`
/SEMO-workflow:greenfield
\`\`\`
`,
    description: "Greenfield 워크플로우 시작",
    is_active: true,
  },
];

const FALLBACK_AGENTS: Agent[] = [
  {
    id: "agent-1",
    name: "orchestrator",
    display_name: "Orchestrator",
    content: `---
name: orchestrator
description: SEMO 메인 오케스트레이터
---

# Orchestrator Agent

사용자 요청을 분석하고 적절한 Agent/Skill로 라우팅합니다.

## Routing Table

| Intent | Agent/Skill |
|--------|-------------|
| 코드 작성 | write-code |
| Git 커밋 | git-workflow |
| 테스트 작성 | write-test |
`,
    package: "core",
    is_active: true,
    install_order: 1,
  },
];

const FALLBACK_PACKAGES: Package[] = [
  {
    id: "pkg-core",
    name: "semo-core",
    display_name: "SEMO Core",
    description: "원칙, 오케스트레이터",
    layer: "standard",
    package_type: "standard",
    version: "3.14.0",
    is_active: true,
    is_required: true,
    install_order: 10,
  },
  {
    id: "pkg-skills",
    name: "semo-skills",
    display_name: "SEMO Skills",
    description: "19개 핵심 스킬",
    layer: "standard",
    package_type: "standard",
    version: "3.14.0",
    is_active: true,
    is_required: true,
    install_order: 20,
  },
];

// ============================================================
// DB 조회 함수
// ============================================================

/**
 * 활성 스킬 목록 조회
 */
export async function getActiveSkills(): Promise<Skill[]> {
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    console.warn("⚠️ DB 연결 실패, 폴백 스킬 목록 사용 (19개)");
    return FALLBACK_SKILLS.filter((s) => s.is_active);
  }

  try {
    const result = await getPool().query(`
      SELECT id, name, display_name, description, content, category, package,
             is_active, is_required, install_order, version
      FROM semo.skills
      WHERE is_active = true
      ORDER BY install_order
    `);
    return result.rows;
  } catch (error) {
    console.warn("⚠️ 스킬 조회 실패, 폴백 데이터 사용:", error);
    return FALLBACK_SKILLS.filter((s) => s.is_active);
  }
}

/**
 * 스킬 이름 목록만 조회
 */
export async function getActiveSkillNames(): Promise<string[]> {
  const skills = await getActiveSkills();
  return skills.map((s) => s.name);
}

/**
 * 커맨드 목록 조회
 */
export async function getCommands(): Promise<SemoCommand[]> {
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    console.warn("⚠️ DB 연결 실패, 폴백 커맨드 목록 사용");
    return FALLBACK_COMMANDS.filter((c) => c.is_active);
  }

  try {
    const result = await getPool().query(`
      SELECT id, name, folder, content, description, is_active
      FROM semo.commands
      WHERE is_active = true
    `);
    return result.rows;
  } catch (error) {
    console.warn("⚠️ 커맨드 조회 실패, 폴백 데이터 사용:", error);
    return FALLBACK_COMMANDS.filter((c) => c.is_active);
  }
}

/**
 * 에이전트 목록 조회
 */
export async function getAgents(): Promise<Agent[]> {
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    console.warn("⚠️ DB 연결 실패, 폴백 에이전트 목록 사용");
    return FALLBACK_AGENTS.filter((a) => a.is_active);
  }

  try {
    const result = await getPool().query(`
      SELECT id, name, display_name, content, package, is_active, install_order
      FROM semo.agents
      WHERE is_active = true
      ORDER BY install_order
    `);
    return result.rows;
  } catch (error) {
    console.warn("⚠️ 에이전트 조회 실패, 폴백 데이터 사용:", error);
    return FALLBACK_AGENTS.filter((a) => a.is_active);
  }
}

/**
 * 패키지 목록 조회
 */
export async function getPackages(layer?: string): Promise<Package[]> {
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    console.warn("⚠️ DB 연결 실패, 폴백 패키지 목록 사용");
    const fallback = FALLBACK_PACKAGES.filter((p) => p.is_active);
    return layer ? fallback.filter((p) => p.layer === layer) : fallback;
  }

  try {
    let query = `
      SELECT id, name, display_name, description, layer, package_type,
             version, is_active, is_required, install_order
      FROM semo.packages
      WHERE is_active = true
    `;
    const params: string[] = [];

    if (layer) {
      query += ` AND layer = $1`;
      params.push(layer);
    }

    query += ` ORDER BY install_order`;

    const result = await getPool().query(query, params);
    return result.rows;
  } catch (error) {
    console.warn("⚠️ 패키지 조회 실패, 폴백 데이터 사용:", error);
    const fallback = FALLBACK_PACKAGES.filter((p) => p.is_active);
    return layer ? fallback.filter((p) => p.layer === layer) : fallback;
  }
}

/**
 * 카테고리별 스킬 개수 조회
 */
export async function getSkillCountByCategory(): Promise<Record<string, number>> {
  const skills = await getActiveSkills();
  const counts: Record<string, number> = {};

  for (const skill of skills) {
    counts[skill.category] = (counts[skill.category] || 0) + 1;
  }

  return counts;
}

/**
 * DB 연결 종료
 */
export async function closeConnection(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbAvailable = null;
  }
}

/**
 * DB 연결 상태 확인
 */
export async function isDbConnected(): Promise<boolean> {
  return checkDbConnection();
}
