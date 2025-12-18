# Base Routing Table

> 모든 Orchestrator가 상속하는 공통 라우팅 테이블

## Quick Routing Table

| 키워드 | Route To | 예시 |
|--------|----------|------|
| 코드 작성, 구현, 개발 | `skill:coder` | "함수 구현해줘" |
| 테스트, 검증 | `skill:tester` | "테스트 작성해줘" |
| 계획, 설계 | `skill:planner` | "구현 계획 세워줘" |
| 배포, 릴리스 | `skill:deployer` | "배포해줘" |
| 슬랙, 알림 | `skill:notify-slack` | "슬랙에 알려줘" |
| 피드백, 이슈 등록 | `skill:feedback` | "피드백 등록해줘" |
| 도움말, 사용법 | `skill:semo-help` | "도움말", "/SEMO:help" |
| 버전, 업데이트 | `skill:version-updater` | "버전 체크해줘" |
| 버그, 이슈 목록 | `skill:list-bugs` | "버그 목록 보여줘" |
| 메모리, 컨텍스트 | `skill:memory` | "컨텍스트 저장해줘" |
| 구조, 아키텍처 | `skill:semo-architecture-checker` | "구조 검증해줘" |

## 키워드 우선순위

동일 요청에 여러 키워드가 매칭될 경우:

1. **구체적 키워드 우선**: "테스트 코드 작성" → `tester` (not `coder`)
2. **접두사 우선**: `[next] 구현해줘` → eng/nextjs orchestrator
3. **이슈 번호 우선**: "#123 작업해줘" → 이슈 기반 라우팅

## 라우팅 실패 시

```markdown
[SEMO] 라우팅 실패: 의도를 파악할 수 없습니다.

다음 중 하나를 시도해보세요:
- 더 구체적인 키워드 사용
- /SEMO:help로 사용 가능한 명령 확인
- 패키지 접두사 추가 (예: [next])
```
