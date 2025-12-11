# SEMO → SEMO 마이그레이션 가이드

> 기존 SEMO 사용자를 위한 SEMO 전환 가이드

**버전**: 2.0.0
**작성일**: 2025-12-11

---

## 1. 개요

### 왜 SEMO인가?

| 항목 | SEMO (기존) | SEMO (신규) |
|------|-----------|-------------|
| **구조** | 역할 기반 (11개 패키지) | 기능 기반 (3개 레이어) |
| **Orchestrator** | 11개 (중복) | 1개 (통합) |
| **플랫폼 지정** | 접두사 필수 | 자동 감지 |
| **유지보수** | 복잡 | 단순 |

### SEMO 구조

```
semo-workspace/
├── semo-core/           # Layer 0: Foundation
├── semo-skills/         # Layer 1: Capabilities
└── semo-integrations/   # Layer 2: External Connections
```

---

## 2. 빠른 시작

### Step 1: 기존 방식 (SAX)

```markdown
[next] 댓글 기능 구현해줘
```

### Step 2: 새로운 방식 (SEMO)

```markdown
댓글 기능 구현해줘
```

> Orchestrator가 `next.config.js`를 감지하여 자동으로 Next.js 플랫폼 선택

---

## 3. 접두사 마이그레이션

### 코드 구현 (coder)

| 기존 | 신규 | 비고 |
|------|------|------|
| `[next] 구현해줘` | `구현해줘` | 자동 감지 |
| `[backend] 구현해줘` | `구현해줘` | 자동 감지 |
| `[mvp] 구현해줘` | `구현해줘` | 자동 감지 |

### 기획/관리 (planner)

| 기존 | 신규 |
|------|------|
| `[po] Epic 만들어줘` | `Epic 만들어줘` |
| `[pm] 스프린트 계획해줘` | `스프린트 계획해줘` |

### 테스트 (tester)

| 기존 | 신규 |
|------|------|
| `[qa] 테스트 작성해줘` | `테스트 작성해줘` |

### 배포 (deployer)

| 기존 | 신규 |
|------|------|
| `[infra] 배포해줘` | `배포해줘` |

---

## 4. 커맨드 마이그레이션

| 기존 | 신규 | 상태 |
|------|------|------|
| `/SEMO:help` | `/SEMO:help` | 병행 지원 |
| `/SEMO:slack` | `/SEMO:notify` | 병행 지원 |
| `/SEMO:feedback` | `/SEMO:feedback` | 병행 지원 |
| `/SEMO:health` | `/SEMO:health` | 병행 지원 |
| `/SEMO:audit` | `/SEMO:audit` | 병행 지원 |

---

## 5. 스킬 참조 마이그레이션

### 기존 (SAX)

```markdown
[SEMO] Skill: semo-next/skills/implement 사용
```

### 신규 (SEMO)

```markdown
[SEMO] Skill: semo-skills/coder/implement 사용 (platform: nextjs)
```

### 매핑 테이블

| 기존 경로 | 신규 경로 |
|----------|----------|
| `semo-next/skills/implement` | `semo-skills/coder/implement` |
| `semo-backend/skills/implement` | `semo-skills/coder/implement` |
| `semo-qa/skills/run-tests` | `semo-skills/tester/execute` |
| `semo-po/skills/create-epic` | `semo-skills/planner/epic` |
| `semo-core/skills/notify-slack` | `semo-integrations/slack/notify` |

---

## 6. 메시지 포맷 변경

### 기존 (SAX)

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → 코드 구현
[SEMO] Agent 위임: implementation-master
```

### 신규 (SEMO)

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → 코드 구현
[SEMO] Skill 위임: coder/implement (platform: nextjs)
```

---

## 7. 플랫폼 자동 감지

SEMO는 프로젝트 파일을 분석하여 플랫폼을 자동 감지합니다.

### 감지 로직

```bash
# semo-core/shared/detect-context.sh
if [ -f "next.config.js" ]; then
    echo "nextjs"
elif [ -f "pom.xml" ]; then
    echo "spring"
else
    echo "mvp"
fi
```

### 감지되는 플랫폼

| 플랫폼 | 감지 조건 |
|--------|----------|
| Next.js | `next.config.js`, `next.config.ts` |
| Spring | `pom.xml`, `build.gradle` |
| Microservice | `docker-compose.yml` + microservice 키워드 |
| MVP | 기타 (기본값) |

---

## 8. Context Mesh 활용

새로운 `.claude/memory/` 디렉토리를 활용하여 세션 간 컨텍스트를 유지합니다.

### 구조

```
.claude/memory/
├── context.md       # 프로젝트 상태
├── decisions.md     # 아키텍처 결정
└── rules/           # 프로젝트별 규칙
```

### 활용

세션 시작 시 자동으로 `context.md`를 참조하여 이전 작업 상태를 복원합니다.

---

## 9. 체크리스트

### 마이그레이션 전

- [ ] 현재 사용 중인 SEMO 패키지 확인
- [ ] 사용 중인 접두사 목록 정리
- [ ] 커스텀 스킬/에이전트 확인

### 마이그레이션 중

- [ ] 접두사 제거 테스트
- [ ] 새 커맨드 사용 테스트
- [ ] 플랫폼 자동 감지 확인

### 마이그레이션 후

- [ ] Deprecation 경고 없음 확인
- [ ] Context Mesh 정상 동작 확인
- [ ] 팀원 교육

---

## 10. FAQ

### Q: 기존 접두사를 계속 사용할 수 있나요?

A: 6개월간 병행 지원됩니다. 단, Deprecation 경고가 출력됩니다.

### Q: 플랫폼 자동 감지가 잘못되면?

A: 명시적 지정도 가능합니다: `nextjs 플랫폼으로 구현해줘`

### Q: 커스텀 스킬은 어떻게 마이그레이션하나요?

A: `semo-skills/` 하위에 적절한 카테고리로 이동하세요.

---

## 11. 지원

- **문서**: [SEMO Principles](../semo-core/principles/PRINCIPLES.md)
- **피드백**: `/SEMO:feedback`
- **이슈**: [GitHub Issues](https://github.com/semicolon-devteam/sax/issues)

---

*이 가이드는 SEMO 리팩토링 Phase 4의 일부로 작성되었습니다.*
