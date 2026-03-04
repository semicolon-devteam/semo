# semo-hooks 명세서

> Claude Code Hooks 기반 전체 대화 로깅 시스템

## 1. 개요

### 1.1 목적

현재 SEMO 장기 기억 시스템은 MCP 도구 호출만 기록합니다. 이 패키지는 Claude Code Hooks를 활용하여 **모든 대화 내역**을 중앙 DB에 기록합니다.

### 1.2 문제점

| 현재 상태 | 문제 |
|----------|------|
| MCP 도구 호출만 `interaction_logs`에 기록 | 일반 대화 누락 |
| 사용자 프롬프트 미기록 | 맥락 파악 불가 |
| Claude 응답 미기록 | 학습 데이터 손실 |

### 1.3 해결책

Claude Code의 Hooks 시스템을 활용:

| Hook | 용도 |
|------|------|
| `SessionStart` | 세션 시작 기록, 환경 세팅 |
| `SessionEnd` | 세션 종료 기록, 통계 저장 |
| `UserPromptSubmit` | 사용자 프롬프트 즉시 캡처 |
| `Stop` | 응답 완료 시 transcript 파싱하여 전체 대화 기록 |

## 2. 아키텍처

### 2.1 디렉토리 구조

```
semo-system/
└── semo-hooks/
    ├── package.json
    ├── tsconfig.json
    ├── spec.md                    # 이 문서
    ├── src/
    │   ├── index.ts               # 엔트리포인트 (CLI 라우터)
    │   ├── hooks/
    │   │   ├── session-start.ts   # SessionStart hook
    │   │   ├── session-end.ts     # SessionEnd hook
    │   │   ├── user-prompt.ts     # UserPromptSubmit hook
    │   │   └── stop.ts            # Stop hook (transcript 파싱)
    │   ├── lib/
    │   │   ├── db.ts              # DB 연결 (mcp-server/memory.ts 재사용)
    │   │   ├── transcript.ts      # transcript JSONL 파서
    │   │   └── types.ts           # 타입 정의
    │   └── utils/
    │       └── env.ts             # 환경변수 유틸
    ├── dist/                       # 컴파일된 JS
    └── scripts/
        └── install.sh              # settings.local.json 자동 구성
```

### 2.2 데이터 흐름

```text
[사용자 프롬프트]
       │
       ▼
┌──────────────────────────┐
│  UserPromptSubmit Hook   │ ─────► interaction_logs (role: user)
│  - 프롬프트 즉시 캡처    │
└──────────────────────────┘
       │
       ▼
[Claude 처리 + 도구 호출]
       │
       ▼
┌──────────────────────────┐
│  Stop Hook               │ ─────► interaction_logs (role: assistant)
│  - transcript 파싱       │
│  - 마지막 응답 추출      │
└──────────────────────────┘
       │
       ▼
┌──────────────────────────┐
│  SessionEnd Hook         │ ─────► sessions (통계 업데이트)
│  - 세션 통계 저장        │
└──────────────────────────┘
```

## 3. Hook 상세 명세

### 3.1 SessionStart Hook

**트리거**: 세션 시작/재개/클리어

**입력 (stdin)**:
```json
{
  "session_id": "uuid",
  "transcript_path": "/path/to/session.jsonl",
  "cwd": "/project/path",
  "permission_mode": "default",
  "hook_event_name": "SessionStart",
  "source": "startup|resume|clear|compact"
}
```

**동작**:
1. 세션 정보를 `semo.sessions` 테이블에 upsert
2. 프로젝트 경로, 시작 시간 기록
3. 환경변수 설정 (필요시)

**출력**:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "SEMO session initialized: {session_id}"
  }
}
```

### 3.2 UserPromptSubmit Hook

**트리거**: 사용자가 프롬프트 제출 시

**입력 (stdin)**:
```json
{
  "session_id": "uuid",
  "transcript_path": "/path/to/session.jsonl",
  "cwd": "/project/path",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "사용자가 입력한 프롬프트 텍스트"
}
```

**동작**:
1. 프롬프트를 `semo.interaction_logs`에 저장
2. `role: 'user'`, `content: prompt`
3. `skill_name: 'user_prompt'`로 구분

**출력**: 없음 (exit 0)

### 3.3 Stop Hook

**트리거**: Claude 응답 완료 시

**입력 (stdin)**:
```json
{
  "session_id": "uuid",
  "transcript_path": "/path/to/session.jsonl",
  "cwd": "/project/path",
  "hook_event_name": "Stop",
  "stop_hook_active": false
}
```

**동작**:
1. `transcript_path`에서 JSONL 파일 읽기
2. 마지막 assistant 응답 추출
3. `semo.interaction_logs`에 저장
4. `role: 'assistant'`, `content: response`
5. `skill_name: 'claude_response'`로 구분

**Transcript JSONL 형식**:
```jsonl
{"type":"text","role":"user","content":"사용자 프롬프트"}
{"type":"tool_use","id":"toolu_01ABC","name":"Write","input":{...}}
{"type":"tool_result","tool_use_id":"toolu_01ABC","content":[...]}
{"type":"text","role":"assistant","content":"Claude 응답"}
```

**출력**: 없음 (exit 0, 정상 종료 허용)

### 3.4 SessionEnd Hook

**트리거**: 세션 종료 시

**입력 (stdin)**:
```json
{
  "session_id": "uuid",
  "transcript_path": "/path/to/session.jsonl",
  "cwd": "/project/path",
  "hook_event_name": "SessionEnd",
  "reason": "clear|logout|prompt_input_exit|other"
}
```

**동작**:
1. 세션 통계 계산 (총 메시지 수, 도구 호출 수 등)
2. `semo.sessions` 테이블 업데이트
3. 종료 시간, 종료 사유 기록

**출력**: 없음 (exit 0)

## 4. 데이터베이스 스키마

### 4.1 기존 테이블 활용

`semo.interaction_logs` 테이블 재사용:

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `user_id` | UUID | 사용자 ID (기본값 사용) |
| `session_id` | TEXT | 세션 ID |
| `agent_id` | UUID | 에이전트 ID (기본값) |
| `role` | TEXT | 'user' / 'assistant' |
| `content` | TEXT | 프롬프트 또는 응답 |
| `skill_name` | TEXT | 'user_prompt' / 'claude_response' |
| `skill_args` | JSONB | 메타데이터 |
| `metadata` | JSONB | 추가 정보 |

### 4.2 skill_name 규칙

| skill_name | 설명 |
|------------|------|
| `user_prompt` | UserPromptSubmit으로 캡처된 사용자 입력 |
| `claude_response` | Stop hook으로 캡처된 Claude 응답 |
| (기존 MCP 도구명) | MCP 서버에서 기록된 도구 호출 |

## 5. 설정 파일

### 5.1 settings.local.json 구성

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/semo/semo-system/semo-hooks/dist/index.js session-start",
            "timeout": 10
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/semo/semo-system/semo-hooks/dist/index.js user-prompt",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/semo/semo-system/semo-hooks/dist/index.js stop",
            "timeout": 10
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/semo/semo-system/semo-hooks/dist/index.js session-end",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### 5.2 자동 설치 스크립트

`scripts/install.sh`:
- 기존 `.claude/settings.local.json` 백업
- hooks 설정 병합
- 경로 자동 설정

## 6. 구현 계획

### Phase 1: 기본 구조 (v0.1.0)

- [ ] package.json, tsconfig.json 설정
- [ ] src/index.ts CLI 라우터
- [ ] src/lib/db.ts DB 연결 (mcp-server 재사용)
- [ ] src/lib/types.ts 타입 정의

### Phase 2: Hook 구현 (v0.2.0)

- [ ] SessionStart hook
- [ ] UserPromptSubmit hook
- [ ] Stop hook (transcript 파싱)
- [ ] SessionEnd hook

### Phase 3: 설치 자동화 (v0.3.0)

- [ ] install.sh 스크립트
- [ ] settings.local.json 병합 로직
- [ ] 문서화

### Phase 4: 테스트 및 검증 (v0.4.0)

- [ ] 단위 테스트
- [ ] 통합 테스트
- [ ] 실제 환경 검증

## 7. 의존성

### 7.1 런타임

- `pg`: PostgreSQL 클라이언트 (기존 mcp-server와 공유)
- Node.js v18+

### 7.2 빌드

- TypeScript
- esbuild 또는 tsc

### 7.3 기존 코드 재사용

`packages/mcp-server/src/memory.ts`의 다음 함수 재사용:
- `getPool()`: DB 연결 풀
- `isMemoryEnabled()`: 연결 가능 여부
- `logInteraction()`: 상호작용 로깅
- `upsertSession()`: 세션 관리

## 8. 보안 고려사항

### 8.1 민감 정보 처리

- 프롬프트/응답에서 비밀번호, API 키 등 마스킹
- `.env` 파일 내용 제외
- 인증 정보 필터링

### 8.2 에러 처리

- Hook 실패 시 조용히 실패 (exit 0)
- 메인 Claude Code 플로우에 영향 없음
- 에러 로그는 stderr로 출력 (verbose 모드에서만 표시)

## 9. 기대 효과

1. **전체 맥락 기록**: 모든 대화가 중앙 DB에 저장
2. **학습 데이터 축적**: 팀 작업 패턴 분석 가능
3. **컨텍스트 복원**: 이전 세션 대화 검색/복원
4. **메모리 품질 향상**: 더 풍부한 semantic memory 생성

## 10. 참고 자료

- [Claude Code Hooks 공식 문서](https://code.claude.com/docs/en/hooks)
- [기존 memory.ts](../packages/mcp-server/src/memory.ts)
- [이슈 #82](https://github.com/semicolon-devteam/semo/issues/82)

---

> 📋 **Issue**: #82
> 📅 **작성일**: 2025-12-25
> 🔄 **상태**: Draft
