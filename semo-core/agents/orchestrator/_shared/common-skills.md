# Common Skills

> 모든 SEMO 환경에서 사용 가능한 공통 스킬

## 행동 스킬 (Action)

| 스킬 | 역할 | 트리거 |
|------|------|--------|
| `coder` | 코드 작성/수정 | "코드 작성", "구현" |
| `tester` | 테스트 작성/실행 | "테스트", "검증" |
| `planner` | 작업 계획 수립 | "계획", "설계" |
| `deployer` | 배포 프로세스 | "배포", "릴리스" |

## 운영 스킬 (Operation)

| 스킬 | 역할 | 트리거 |
|------|------|--------|
| `memory` | 컨텍스트 저장/조회 | "메모리", "컨텍스트" |
| `notify-slack` | Slack 알림 전송 | "슬랙", "알림" |
| `feedback` | 피드백 수집/이슈 생성 | "피드백", "이슈 등록" |
| `version-updater` | 버전 체크/업데이트 | "버전", "업데이트" |
| `semo-help` | 도움말 제공 | "도움말", "/SEMO:help" |
| `semo-architecture-checker` | 구조 검증 | "구조 검증", "아키텍처" |
| `circuit-breaker` | 무한루프 방지 | (자동 호출) |
| `list-bugs` | 버그 목록 조회 | "버그 목록", "이슈 목록" |

## 스킬 호출 규칙

1. **직접 호출 가능**: 사용자가 스킬 이름 명시 시
   ```
   "notify-slack 스킬로 알려줘" → skill:notify-slack
   ```

2. **키워드 기반 라우팅**: Orchestrator가 의도 파악 후 호출
   ```
   "슬랙에 알려줘" → skill:notify-slack
   ```

3. **Agent 통한 호출**: Agent가 작업 중 필요 시 호출
   ```
   implementation-master → skill:tester (구현 후 테스트)
   ```
