/**
 * MCP KB Server — Tool definitions (7 tools)
 */

export const KB_TOOLS = [
  {
    name: "kb_search",
    description:
      "KB 하이브리드 검색 (벡터 유사도 + 텍스트). 팀 Knowledge Base에서 관련 항목을 검색합니다.\n\nWHEN TO USE: 팀원/프로젝트/의사결정/프로세스/인프라/KPI/봇설정/스펙/스킬 관련 질문을 받으면 반드시 이 도구로 먼저 검색하세요. KB가 팀의 Single Source of Truth(SoT)입니다. 자체 지식이나 세션 기억만으로 답변하지 마세요. KB에 결과가 없으면 'KB에 해당 정보가 없습니다. 알려주시면 등록하겠습니다.'라고 안내하세요.\nHOW: query에 자연어 질문, domain에 SoT 도메인(team/project/decision/process/infra/kpi/bot-config/spec/skill)을 지정하면 정확도가 높아집니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "검색 쿼리 (자연어 또는 키워드)",
        },
        domain: {
          type: "string",
          description:
            "KB 도메인 필터 (team, project, decision, infra, process, kpi, bot-config, spec, skill). 생략 시 전체 검색",
        },
        limit: {
          type: "number",
          description: "결과 개수 (기본: 10)",
        },
        mode: {
          type: "string",
          enum: ["semantic", "text", "hybrid"],
          description: "검색 모드 (기본: hybrid)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "kb_get",
    description:
      "KB 정확 조회. domain + key로 단일 항목을 가져옵니다.\n\nWHEN TO USE: domain과 key를 이미 알고 있을 때 kb_search 대신 사용하세요. 더 빠르고 정확합니다. 예: kb_get(domain='team', key='reus'), kb_get(domain='bot-config', key='semiclaw/identity'), kb_get(domain='skill', key='semiclaw/kb-manager').\nHOW: domain과 key를 정확히 지정합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          description: "KB 도메인 (예: team, project, decision)",
        },
        key: {
          type: "string",
          description: "항목 키",
        },
      },
      required: ["domain", "key"],
    },
  },
  {
    name: "kb_list",
    description:
      "KB 항목 목록 조회. 도메인별 엔트리 목록을 반환합니다.\n\nWHEN TO USE: 도메인 내 항목을 탐색할 때 사용하세요. 예: '팀원 목록 보여줘' → kb_list(domain='team'), '프로젝트 목록' → kb_list(domain='project').\nHOW: domain을 지정하면 해당 도메인 항목만 반환합니다. 생략 시 전체 목록.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          description: "KB 도메인 필터. 생략 시 전체 목록",
        },
        limit: {
          type: "number",
          description: "결과 개수 (기본: 50)",
        },
      },
      required: [],
    },
  },
  {
    name: "kb_upsert",
    description:
      "KB 항목 쓰기 (upsert). domain+key 기준으로 생성 또는 갱신합니다. OpenAI 임베딩이 자동 생성됩니다. metadata는 도메인별 온톨로지 스키마에 따라 작성을 권장합니다 (kb_ontology 도구로 확인 가능). 스키마 위반 시 저장은 되지만 힌트 경고가 반환됩니다. 미등록 도메인은 거부됩니다 (kb_ontology로 등록된 도메인 확인).\n\n도메인별 키 형식:\n- team: {name} (예: reus, bae)\n- project: {project-name} (예: star-spot, gameland)\n- decision: {YYYY-MM-DD}/{slug} (예: 2026-03-04/seo-dashboard-deploy). 하나의 엔트리에 전체 결정 포함.\n- process: {process-name} (예: bot-pipeline-workflow)\n- infra: {resource-name} (예: central-db, github-org)\n- kpi: {project}/current (최신 스냅샷) | {project}/target (목표) | {project}/YYYY-WNN (주간 기록)\n- bot-config: {botId}/{fileType} (예: semiclaw/identity, workclaw/agents)\n- spec: {specName} (예: semo-dashboard-spec, prd-star-spot)\n- skill: {botId}/{skillName} 또는 {botId}/{skillName}/ref-{refName}\n\nWHEN TO USE: 사용자가 팀 정보를 정정하거나 새 사실을 알려줄 때, 의사결정이 내려졌을 때, 프로세스/규칙이 변경되었을 때 반드시 이 도구로 KB에 즉시 기록하세요. '알겠습니다/기억하겠습니다'만 하고 KB에 쓰지 않는 것은 금지입니다.\nHOW: 기존 항목이 있으면 갱신, 없으면 신규 생성됩니다. domain+key로 식별합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          description: "KB 도메인 (예: decision, project)",
        },
        key: {
          type: "string",
          description: "항목 키",
        },
        content: {
          type: "string",
          description: "항목 본문 (마크다운 가능)",
        },
        metadata: {
          type: "object",
          description: "추가 메타데이터 (JSON). 도메인 온톨로지에 정의된 필드를 사용하면 검색/필터링 품질이 향상됩니다.",
        },
      },
      required: ["domain", "key", "content"],
    },
  },
  {
    name: "kb_bot_status",
    description:
      "OpenClaw 봇 상태 조회. 7개 봇의 온라인/오프라인 상태, 마지막 활동 시각 등을 반환합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "kb_ontology",
    description:
      "온톨로지 스키마 조회. KB 도메인의 JSON Schema 정의를 반환합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          description:
            "특정 도메인 스키마 조회. 생략 시 전체 도메인 목록",
        },
      },
      required: [],
    },
  },
  {
    name: "kb_digest",
    description:
      "KB 변경 다이제스트. 지정한 시각 이후 변경된 KB 항목을 반환합니다.",
    inputSchema: {
      type: "object" as const,
      properties: {
        since: {
          type: "string",
          description: "ISO 8601 타임스탬프 (예: 2026-03-20T00:00:00Z). 이 시각 이후 변경된 항목을 반환",
        },
        domain: {
          type: "string",
          description: "도메인 필터. 생략 시 전체 도메인",
        },
      },
      required: ["since"],
    },
  },
];
