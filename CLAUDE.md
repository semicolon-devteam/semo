# SAX-PO Package Configuration

> PO/기획자를 위한 SAX 패키지

## Package Info

- **Package**: SAX-PO
- **Version**: 📌 [sax/VERSION](https://github.com/semicolon-devteam/docs/blob/main/sax/VERSION) 참조
- **Target**: docs repository
- **Audience**: PO, 기획자
- **Extends**: SAX-Core

## SAX Core 상속

이 패키지는 SAX Core의 기본 원칙을 상속합니다.

@sax-core/PRINCIPLES.md
@sax-core/MESSAGE_RULES.md

> 📖 Core 문서는 `.claude/sax-core/` 디렉토리에서 자동 로드됩니다.

## 설치 대상

이 패키지는 `semicolon-devteam/docs` 레포지토리의 `.claude/` 디렉토리에 설치됩니다.

### docs 레포 한정 동기화 규칙

> ⚠️ **중요**: docs 레포지토리에서 SAX-PO 개선 작업 시, 다음 두 위치를 **동시에** 업데이트해야 합니다:

| 위치 | 역할 |
|------|------|
| `.claude/sax-po/` | SAX-PO 실제 사용 (설치된 상태) |
| `sax/packages/sax-po/` | SAX-PO 패키지 소스 (배포용) |

**동기화 명령**:

```bash
rsync -av --delete --exclude='.git' \
  sax/packages/sax-po/ \
  .claude/sax-po/
```

## 개발자 연동

SAX-PO로 생성된 Epic은 개발자(SAX-Next)와 다음과 같이 연동됩니다:

1. **PO**: Epic 생성 → docs 레포에 이슈 생성
2. **PO**: Draft Task 생성 → 서비스 레포/core-backend에 Draft Task Issues 생성
3. **개발자**: 할당된 Draft Task 확인
4. **개발자**: 대상 레포에서 `/speckit.specify` 실행
5. **개발자**: spec.md 보완 후 `/speckit.plan`, `/speckit.tasks`
6. **개발자**: Draft Task Issue 업데이트 (tasks/ 내용 반영, draft 라벨 제거)

## Package Components

### Agents

| Agent | 역할 | 파일 |
|-------|------|------|
| orchestrator | 요청 라우팅 | `agents/orchestrator.md` |
| epic-master | Epic 생성 | `agents/epic-master.md` |
| draft-task-creator | Draft Task 생성 | `agents/draft-task-creator.md` |
| spec-writer | Spec 초안 작성 | `agents/spec-writer.md` |
| onboarding-master | 신규 사용자 온보딩 | `agents/onboarding-master.md` |
| teacher | 학습 안내 | `agents/teacher.md` |

### Skills

| Skill | 역할 | 파일 |
|-------|------|------|
| health-check | 개발 환경 검증 | `skills/health-check/` |
| assign-project-label | 프로젝트 라벨 및 Projects 연결 | `skills/assign-project-label/` |
| detect-project-from-epic | Epic 프로젝트 라벨 감지 | `skills/detect-project-from-epic/` |
| check-backend-duplication | core-backend 중복 체크 | `skills/check-backend-duplication/` |
| assign-estimation-point | Estimation Point 할당 | `skills/assign-estimation-point/` |
| generate-acceptance-criteria | AC 자동 생성 | `skills/generate-acceptance-criteria/` |
| create-design-task | 디자인 Task 생성 | `skills/create-design-task/` |
| validate-task-completeness | Draft Task 필수 항목 검증 | `skills/validate-task-completeness/` |
| auto-label-by-scope | Epic 범위 기반 자동 라벨링 | `skills/auto-label-by-scope/` |
| estimate-epic-timeline | Epic 전체 일정 예측 | `skills/estimate-epic-timeline/` |
| check-team-codex | 팀 규칙 검증 | `skills/check-team-codex/` |

### Commands

| Command | 역할 | 파일 |
|---------|------|------|
| /SAX:onboarding | 신규 PO/기획자 온보딩 | `commands/SAX/onboarding.md` |
| /SAX:health-check | 개발 환경 검증 | `commands/SAX/health-check.md` |
| /SAX:help | 대화형 도우미 (PO/기획자) | `commands/SAX/help.md` |

### Templates

| Template | 역할 | 파일 |
|----------|------|------|
| epic-template | Epic 이슈 본문 | `templates/epic-template.md` |

## Installation & Update

### 설치 방법

docs 레포지토리에 설치:

```bash
cd semicolon-devteam/docs
cp -r sax/packages/sax-po/* .claude/
```

### 업데이트 후 커밋 규칙

> ⚠️ **중요**: SAX 패키지 동기화(업데이트) 완료 후 **반드시 커밋**을 수행합니다.

**커밋 메시지 형식**:

```text
📝 [SAX] Sync to vX.X.X
```

## References

- [SAX Core - Principles](https://github.com/semicolon-devteam/docs/blob/main/sax/core/PRINCIPLES.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/docs/blob/main/sax/core/MESSAGE_RULES.md)
- [SAX Core - Packaging](https://github.com/semicolon-devteam/docs/blob/main/sax/core/PACKAGING.md)
- [SAX Changelog Index](https://github.com/semicolon-devteam/docs/blob/main/sax/CHANGELOG/INDEX.md)
