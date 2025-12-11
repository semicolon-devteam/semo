# Cross-Package Routing Guide

> 다른 패키지의 전문 영역 요청 시 인계 및 권유 가이드

## Purpose

각 SEMO 패키지는 특정 역할에 특화되어 있습니다. 현재 패키지의 전문 영역이 아닌 요청이 들어오면:

1. 해당 전문 패키지로 인계 권유
2. 담당자에게 연락 제안
3. 또는 해당 패키지 설치 안내

## 패키지별 전문 영역

| 패키지 | 전문 영역 | 담당 역할 | 주요 키워드 |
|--------|----------|----------|------------|
| **semo-po** | 요구사항 기획 & 에픽 관리 | PO, 기획자 | Epic, 요구사항, 기획, AC, Acceptance Criteria |
| **semo-qa** | 품질 관리 & 테스트 | QA 담당자 | 테스트, QA, STG 검증, AC 검증, Pass/Fail |
| **semo-next** | Next.js 프론트엔드 개발 | Frontend 개발자 | React, Next.js, 컴포넌트, SDD, UI |
| **semo-backend** | Spring Boot 백엔드 개발 | Backend 개발자 | Spring Boot, Kotlin, API, CQRS, 도메인 |
| **semo-infra** | DevOps & CI/CD | 인프라 담당자 | 배포, Docker, CI/CD, Nginx, 환경 설정 |
| **semo-pm** | 프로젝트 관리 & 스프린트 | PM | Sprint, 진행도, 할당, 리포트, 로드맵 |
| **semo-design** | UI/UX 디자인 & 핸드오프 | 디자이너 | 목업, Figma, 디자인, 핸드오프, UI |
| **semo-ms** | 마이크로서비스 아키텍처 | MS 개발자 | 마이크로서비스, 이벤트, 워커, Prisma |

## 인계 트리거 키워드

### semo-po로 인계해야 하는 경우

```yaml
keywords:
  - "에픽 생성", "Epic 만들어"
  - "요구사항 정의", "기획서 작성"
  - "AC 작성", "Acceptance Criteria"
  - "Draft Task 생성"
  - "스펙 문서화"
```

### semo-qa로 인계해야 하는 경우

```yaml
keywords:
  - "테스트 케이스", "TC 작성"
  - "STG 검증", "스테이징 테스트"
  - "AC 검증", "Pass/Fail"
  - "QA 요청", "버그 리포트"
  - "회귀 테스트"
```

### semo-next로 인계해야 하는 경우

```yaml
keywords:
  - "React 컴포넌트", "Next.js"
  - "프론트엔드 구현", "UI 개발"
  - "SDD 작성", "컴포넌트 스펙"
  - "반응형 구현", "CSS"
```

### semo-backend로 인계해야 하는 경우

```yaml
keywords:
  - "Spring Boot", "Kotlin"
  - "API 개발", "엔드포인트"
  - "CQRS", "도메인 설계"
  - "백엔드 구현", "서버 개발"
```

### semo-infra로 인계해야 하는 경우

```yaml
keywords:
  - "배포", "deploy"
  - "Docker", "docker-compose"
  - "CI/CD", "GitHub Actions"
  - "Nginx", "환경 설정"
  - "모니터링", "로깅"
```

### semo-pm로 인계해야 하는 경우

```yaml
keywords:
  - "스프린트 관리", "Sprint"
  - "진행도 추적", "진척 현황"
  - "리소스 할당", "태스크 배정"
  - "로드맵", "일정 관리"
  - "블로커 관리"
```

### semo-design으로 인계해야 하는 경우

```yaml
keywords:
  - "목업", "Figma"
  - "UI 디자인", "UX"
  - "디자인 핸드오프", "스타일 가이드"
  - "프로토타입", "와이어프레임"
```

### semo-ms로 인계해야 하는 경우

```yaml
keywords:
  - "마이크로서비스", "microservice"
  - "이벤트 설계", "event schema"
  - "워커", "worker"
  - "Prisma", "서비스 스캐폴딩"
```

## 인계 메시지 포맷

### 다른 패키지로 인계 권유

```markdown
[SEMO] Cross-Package: 이 요청은 **{target_package}**의 전문 영역입니다.

### 권장 조치

| 방법 | 설명 |
|------|------|
| **패키지 전환** | `[{prefix}] {요청}` 접두사로 다시 요청 |
| **담당자 문의** | {담당역할} 담당자에게 문의 |
| **패키지 설치** | 해당 패키지가 없다면 설치 권장 |

### 예시

```text
[{prefix}] {original_request}
```

> 💡 현재 패키지({current_package})에서 계속 진행하시려면 명시적으로 요청해주세요.
```

### 담당자 정보 참조

```markdown
> 📖 담당자 정보: [team-members.md](semo-core/_shared/team-members.md) 참조
```

## 패키지별 담당자 매핑

| 역할 | 담당자 | GitHub ID | 패키지 |
|------|--------|-----------|--------|
| PO/리더 | 노영록 | Roki-Noh | semo-po |
| QA | 고권희 | kokkh | semo-qa |
| 프론트/리더 | 전준영 | reus-jeon | semo-next |
| 백엔드/리더 | 강용준 | kyago | semo-backend |
| 인프라/리더 | 서정원 | garden92 | semo-infra |
| 디자인/리더 | 염현준 | Yeomsoyam | semo-design |

## 구현 예시

### Orchestrator에서 크로스 패키지 감지

```text
입력: "에픽 만들어줘" (semo-pm 환경에서)

감지: "에픽" → semo-po 전문 영역

출력:
[SEMO] Cross-Package: 이 요청은 **semo-po**의 전문 영역입니다.

에픽 생성은 PO/기획자용 패키지에서 처리합니다.

### 권장 조치

| 방법 | 설명 |
|------|------|
| **패키지 전환** | `[po] 에픽 만들어줘` 접두사로 다시 요청 |
| **담당자 문의** | PO 담당 (Roki)에게 문의 |

> 💡 현재 패키지(semo-pm)에서 계속 진행하시려면 명시적으로 요청해주세요.
```

## 예외 사항

### 크로스 패키지 인계하지 않는 경우

1. **명시적 요청**: 사용자가 "여기서 해줘", "이 패키지에서 처리해" 등 명시
2. **공통 기능**: semo-core의 공통 Skill 사용 (notify-slack, feedback 등)
3. **정보 조회**: 단순 정보 확인 요청
4. **[접두사] 사용**: 이미 특정 패키지 접두사가 명시된 경우

## Related

- [team-members.md](team-members.md) - 팀원 정보 및 담당자
- [CLAUDE.md](../../semo-meta/.claude/CLAUDE.md) - 패키지 접두사 규칙
- [Orchestrator](../../semo-meta/agents/orchestrator/orchestrator.md) - 라우팅 규칙
