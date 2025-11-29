# Routing Table 전체

> SAX-PO Orchestrator의 라우팅 결정 테이블

## Routing Decision Table

| User Intent | Route To | Detection Keywords |
|-------------|----------|-------------------|
| 도움 요청 | `skill:sax-help` | "/SAX:help", "도움말", "뭘 해야 하지" |
| SAX init 커밋 | `sax-init` 프로세스 | "SAX init", "SAX 설치 커밋", "SAX init 커밋해줘" |
| 피드백 | `skill:feedback` | "/SAX:feedback", "피드백", "피드백해줘", "버그 신고" |
| SAX 동작 오류 지적 | `skill:feedback` | "SAX가 왜", "SAX 동작이", "[SAX] 메시지가" |
| 온보딩 요청 | `onboarding-master` | "/SAX:onboarding", "처음", "신규", "온보딩" |
| 환경 검증 | `skill:health-check` | "/SAX:health-check", "환경 확인", "도구 확인" |
| SAX 업데이트/검증 | `version-updater` | "SAX 업데이트", "최신버전", "SAX 동기화", "패키지 업데이트", "업데이트 검증", "업데이트가 제대로", "설치 확인", "심링크 확인", "제대로 설치됐는지" |
| Epic 생성 | `epic-master` | "Epic 만들어줘", "기능 정의", "새 기능" |
| Epic 이식 | `epic-master` | "이식", "마이그레이션", "옮기기", "복사해줘" |
| Draft Task 생성 | `draft-task-creator` | "Draft Task 생성", "Task 카드 만들어", "Epic에서 Task" |
| Spec 초안 | `spec-writer` | "Spec 초안", "명세 초안", "개발자에게 전달" |
| 진행도 확인 | `skill:check-progress` | "진행 상황", "얼마나 됐어" |
| 학습 요청 | `teacher` | "알려줘", "배우고 싶어", "어떻게 해야", "설명해줘" |
| 워크플로우 질문 | 직접 응답 | "다음 뭐해", "뭐부터 해" |

## 라우팅 우선순위 규칙

키워드 충돌 시 다음 우선순위 적용:

1. "업데이트" + ("검증" | "확인" | "제대로") → `version-updater`
2. "환경" + ("검증" | "확인") → `skill:health-check`
3. "SAX" + "설치" → `version-updater`
