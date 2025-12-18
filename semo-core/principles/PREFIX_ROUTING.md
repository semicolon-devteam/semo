# Package Prefix Routing

> 접두사로 작업 대상 패키지를 지정합니다.

## 접두사 테이블

| 접두사 | 대상 패키지 | 예시 |
|--------|------------|------|
| `[meta]` | semo-meta | `[meta] Agent 만들어줘` |
| `[po]` | semo-po (biz/discovery) | `[po] Epic 생성해줘` |
| `[next]` | semo-next (eng/nextjs) | `[next] 컴포넌트 구현해줘` |
| `[qa]` | semo-qa (ops/qa) | `[qa] 테스트 실행해줘` |
| `[core]` | semo-core | `[core] 원칙 확인해줘` |
| `[ms]` | semo-ms (eng/ms) | `[ms] 마이크로서비스 구현` |
| `[mvp]` | semo-mvp (biz/poc) | `[mvp] PoC 진행해줘` |
| `[all]` | 모든 패키지 | `[all] 버전 체크해줘` |

## 복수 패키지 지정

```markdown
[po | next] 이슈 #123 작업해줘
→ biz/discovery + eng/nextjs 컨텍스트 로드
```

## 접두사 없는 경우

- 현재 디렉토리에서 패키지 자동 감지
- 감지 실패 시 Core Orchestrator로 라우팅
