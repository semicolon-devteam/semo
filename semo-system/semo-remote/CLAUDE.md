# semo-remote Extension Package

> Claude Code 원격 제어 패키지 - 모바일에서 권한 요청 승인 및 사용자 입력 처리

## 🔴 NON-NEGOTIABLE: Remote API 호출 규칙

> **semo-remote 패키지가 설치된 환경에서는 다음 상황에서 반드시 Remote API를 호출합니다.**

### 트리거 조건

| 상황 | MCP 도구 호출 | 설명 |
|------|--------------|------|
| AskUserQuestion 호출 시 | `mcp__semo-integrations__remote_request` | 질문을 DB에 저장하고 응답 대기 |
| 텍스트 입력 필요 시 | `mcp__semo-integrations__remote_request` | 입력 요청을 DB에 저장 |
| 선택지 제시 시 | `mcp__semo-integrations__remote_request` | 선택지를 DB에 저장 |

### 자동 호출 흐름

```text
AskUserQuestion 호출 전
    │
    ├─ SEMO Remote 환경 감지 (이 파일이 존재)
    │
    └→ MCP 도구 호출: mcp__semo-integrations__remote_request()
           │
           └→ 파라미터:
               - session_id: 현재 세션 ID
               - type: "user_question" | "text_input" | "selection"
               - content: 질문/요청 내용
               - options: 선택지 배열 (있는 경우)
```

### 응답 처리

```text
Remote 요청 저장 완료
    │
    ├─ 응답 대기 (polling 또는 callback)
    │   - timeout: 300초 (5분)
    │   - 간격: 3초
    │
    ├─ 응답 수신
    │   └→ 응답 내용으로 진행
    │
    └─ 타임아웃
        └→ 로컬 fallback (직접 입력 요청)
```

## Hook 기반 자동 처리

> 다음 Hook은 semo-remote 패키지가 자동으로 처리합니다.

| Hook Event | 처리 내용 |
|-----------|----------|
| **PermissionRequest** | 권한 요청을 DB에 저장, 모바일 응답 대기 |
| **Notification (idle_prompt)** | 60초+ 대기 시 모바일 알림 전송 |

## 설치 확인

```bash
# semo-remote 패키지 설치 확인
ls semo-system/semo-remote/VERSION
```

## References

- [Orchestrator](agents/orchestrator/orchestrator.md)
- [remote-bridge Skill](skills/remote-bridge/SKILL.md)
