/**
 * MCP KB Server — Tool definitions (8 tools)
 */

export const KB_TOOLS = [
  {
    name: "kb_search",
    description:
      "KB 하이브리드 검색 (벡터 유사도 + 텍스트). 팀 Knowledge Base에서 관련 항목을 검색합니다.\n\nWHEN TO USE: 팀원/프로젝트/의사결정/프로세스/인프라/KPI/봇설정/스펙/스킬 관련 질문을 받으면 반드시 이 도구로 먼저 검색하세요. KB가 팀의 Single Source of Truth(SoT)입니다. 자체 지식이나 세션 기억만으로 답변하지 마세요. KB에 결과가 없으면 'KB에 해당 정보가 없습니다. 알려주시면 등록하겠습니다.'라고 안내하세요.\nHOW: query에 자연어 질문, domain 또는 service를 지정하면 정확도가 높아집니다.\nWORKFLOW: (1) kb_ontology로 서비스/도메인 구조 파악 → (2) 적절한 domain 또는 service 선택 → (3) kb_search로 검색.\n\n도메인 구조:\n- 서비스 인스턴스: axoracle, jungchipan, playland, ps, star-spot 등 (각 서비스의 base_information/status/po/kpi/milestone 하위 키)\n- 조직 (semicolon): team/{name}, decision/{date}/{slug}, process/{name}, infra/{name}, bot-config/{botId}/{type}, skill/{botId}/{name}, spec/{name}, memory/{src}/{date}, session-log/{id}\n\nservice를 지정하면 해당 서비스 도메인 전체에서 검색합니다.",
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
            "KB 도메인 필터. 서비스 인스턴스 도메인(axoracle, jungchipan, playland 등) 또는 조직 도메인(semicolon). 생략 시 전체 검색",
        },
        service: {
          type: "string",
          description:
            "서비스(프로젝트) 필터. 해당 서비스의 모든 도메인에서 검색 (예: jungchipan → jungchipan, jungchipan.kpi, jungchipan.spec 등). domain과 동시 사용 시 domain 우선",
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
      "KB 정확 조회. domain + key로 단일 항목을 가져옵니다.\n\nWHEN TO USE: domain과 key를 이미 알고 있을 때 kb_search 대신 사용하세요. 더 빠르고 정확합니다.\n예시:\n- kb_get(domain='semicolon', key='team/reus') — 팀원 정보\n- kb_get(domain='semicolon', key='bot-config/semiclaw/identity') — 봇 설정\n- kb_get(domain='axoracle', key='base_information') — 서비스 기본 정보\n- kb_get(domain='jungchipan', key='kpi/current') — 서비스 KPI\n- kb_get(domain='semicolon', key='decision/2026-03-04/slug') — 의사결정",
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
      "KB 항목 목록 조회. 도메인별 엔트리 목록을 반환합니다.\n\nWHEN TO USE: 도메인 내 항목을 탐색할 때 사용하세요.\n예시:\n- '팀원 목록' → kb_list(domain='semicolon') + key prefix 'team/'\n- '프로젝트 목록' → kb_ontology(action='instances') 또는 kb_list(service='axoracle')\n- 'axoracle 정보' → kb_list(domain='axoracle')\nHOW: domain을 지정하면 해당 도메인 항목만 반환. service를 지정하면 해당 서비스의 모든 도메인 항목을 반환. 생략 시 전체.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          description: "KB 도메인 필터. 생략 시 전체 목록",
        },
        service: {
          type: "string",
          description:
            "서비스(프로젝트) 필터. 해당 서비스의 모든 도메인 항목 반환. domain과 동시 사용 시 domain 우선",
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
      "KB 항목 쓰기 (upsert). domain+key 기준으로 생성 또는 갱신합니다. OpenAI 임베딩이 자동 생성됩니다. 미등록 도메인은 거부됩니다 (kb_ontology로 확인). 타입별 스키마는 kb_ontology(action='schema', type='service') 로 확인 가능.\n\n도메인+키 구조:\n- 서비스 인스턴스 (domain={serviceName}): base_information, status, po, service_url, bm, tech_stack, repo, slack_channel, kpi/{slug}, milestone/{slug}\n- 조직 (domain=semicolon): team/{name}, decision/{date}/{slug}, process/{name}, infra/{name}, bot-config/{botId}/{type}, skill/{botId}/{skillName}, spec/{name}, memory/{src}/{date}, session-log/{id}\n\nWHEN TO USE: 사용자가 팀 정보를 정정하거나 새 사실을 알려줄 때, 의사결정이 내려졌을 때, 프로세스/규칙이 변경되었을 때 반드시 이 도구로 KB에 즉시 기록하세요. '알겠습니다/기억하겠습니다'만 하고 KB에 쓰지 않는 것은 금지입니다.\nHOW: 기존 항목이 있으면 갱신, 없으면 신규 생성. domain+key로 식별.",
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
      "온톨로지 조회. KB 서비스 인스턴스/도메인/타입 구조를 파악합니다.\n\nWORKFLOW: KB 검색 전 이 도구로 서비스/도메인 구조를 먼저 파악하세요.\n- action='list' (기본): 전체 도메인 목록 (서비스별 그룹핑)\n- action='show': 특정 도메인 스키마 상세\n- action='services': 등록된 서비스 인스턴스 목록 + 도메인 카운트\n- action='types': 엔트리 타입 목록 (구조적 템플릿)\n- action='instances': 서비스 인스턴스만 반환 (entity_type=service)\n- action='schema': 타입별 표준 키 스키마 조회 (type 파라미터 필수)",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["list", "show", "services", "types", "instances", "schema"],
          description:
            "조회 동작: list(전체 도메인), show(특정 도메인 상세), services(서비스 목록), types(타입 목록), instances(서비스 인스턴스만), schema(타입별 키 스키마). 기본: list",
        },
        domain: {
          type: "string",
          description:
            "action='show' 시 필수. 특정 도메인 스키마 조회",
        },
        type: {
          type: "string",
          description:
            "action='schema' 시 필수. 타입 키 (예: service, organization, kpi, milestone)",
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
  {
    name: "kb_log_query",
    description:
      "봇 쿼리 로그 기록. Slack 사용자 질문과 봇 응답을 bot_query_logs에 저장합니다.\n\nWHEN TO USE: Slack 사용자 질문에 응답한 후 이 도구를 호출하여 로그를 기록하세요. 로깅 실패는 봇 세션에 영향을 주지 않습니다 (fire-and-forget).",
    inputSchema: {
      type: "object" as const,
      properties: {
        bot_id: { type: "string", description: "봇 ID" },
        query: { type: "string", description: "사용자 질문 원문" },
        response: { type: "string", description: "봇 응답 (2000자 초과 시 자동 truncate)" },
        user_id: { type: "string", description: "Slack user ID" },
        user_name: { type: "string", description: "Slack 사용자 이름" },
        channel: { type: "string", description: "Slack 채널 이름" },
        channel_id: { type: "string", description: "Slack 채널 ID" },
        thread_id: { type: "string", description: "Slack 스레드 ID" },
        model: { type: "string", description: "사용 모델명" },
        latency_ms: { type: "number", description: "응답 지연 (ms)" },
        token_input: { type: "number", description: "입력 토큰 수" },
        token_output: { type: "number", description: "출력 토큰 수" },
        metadata: { type: "object", description: "추가 메타데이터 (JSON)" },
      },
      required: ["bot_id", "query"],
    },
  },
  {
    name: "kb_workspace_standard",
    description:
      "봇 워크스페이스 규격 조회. 파일 CRUD 전에 호출하여 허용 여부 확인.\n- action='check': 경로 허용 여부 (path, bot_id)\n- action='list': 전체 규칙 목록 (level, category 필터)\n- action='rules': 특정 파일의 콘텐츠 규칙",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["check", "list", "rules"],
          description: "동작: check(경로 허용 여부), list(규칙 목록), rules(콘텐츠 규칙). 기본: check",
        },
        path: {
          type: "string",
          description: "워크스페이스 상대 경로 (action=check/rules 시 필요)",
        },
        bot_id: {
          type: "string",
          description: "봇 ID (action=check 시 봇별 규칙 필터링)",
        },
        level: {
          type: "string",
          enum: ["required", "optional", "forbidden"],
          description: "action=list 시 레벨 필터",
        },
        category: {
          type: "string",
          enum: ["structure", "legacy", "hygiene"],
          description: "action=list 시 카테고리 필터",
        },
      },
      required: [],
    },
  },
];
