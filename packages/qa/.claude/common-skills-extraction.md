# Common Skills Extraction Plan

> SEMO-Core로 추출해야 할 공통 스킬 목록 및 계획

## 배경

SEMO-PO, SEMO-Next, SEMO-QA에서 공통으로 사용하는 스킬들을 SEMO-Core로 추출하여 중복을 제거하고 일관성을 확보합니다.

## 추출 대상 스킬

### 1. notify-slack

**현재 위치**: `semo-po/skills/notify-slack/`

**사용처**:

- SEMO-PO: Draft Task 생성 후 알림
- SEMO-Next: PR 생성/머지 알림 (예정)
- SEMO-QA: 테스트 결과 알림

**추출 형태**:

```
semo-core/
└── skills/
    └── notify-slack/
        ├── SKILL.md
        └── references/
            ├── slack-id-mapping.md
            └── message-templates.md
```

### 2. semo-help

**현재 위치**: `semo-meta/skills/semo-help/`

**사용처**: 모든 SEMO 패키지

**추출 형태**: Base + Extension 패턴

```
semo-core/skills/semo-help/SKILL.md  # 공통 도움말 구조
semo-po/skills/semo-help/SKILL.md    # PO 특화 도움말 (extends core)
semo-next/skills/semo-help/SKILL.md  # 개발자 특화 도움말 (extends core)
semo-qa/skills/semo-help/SKILL.md    # QA 특화 도움말 (extends core)
```

### 3. feedback

**현재 위치**: `semo-meta/skills/feedback/`

**사용처**: 모든 SEMO 패키지

**추출 형태**: 그대로 Core로 이동

### 4. health-check (Base)

**현재 위치**: `semo-po/skills/health-check/`, `semo-next/skills/health-check/`

**추출 형태**: Base + Extension 패턴

```
semo-core/skills/health-check/SKILL.md  # 공통 환경 체크 (git, gh cli 등)
semo-next/skills/health-check/SKILL.md  # 개발자 체크 추가 (node, npm 등)
semo-qa/skills/health-check/SKILL.md    # QA 체크 추가 (STG 접속 등)
```

### 5. project-status (공통 유틸리티)

**신규 생성**: GitHub Project 상태 조회 공통 로직

```
semo-core/skills/project-status/
├── SKILL.md
└── references/
    └── api-queries.md
```

## 추출 절차

### Phase 1: SEMO-Core 구조 확장

```bash
mkdir -p semo-core/skills/{notify-slack,semo-help,feedback,health-check,project-status}
```

### Phase 2: 공통 스킬 이동

1. `notify-slack` → SEMO-Core로 이동
2. `feedback` → SEMO-Core로 이동
3. `project-status` → SEMO-Core에 신규 생성

### Phase 3: Base + Extension 패턴 적용

1. `semo-help` → Core 베이스 + 패키지별 확장
2. `health-check` → Core 베이스 + 패키지별 확장

### Phase 4: 기존 패키지 업데이트

1. SEMO-PO: Core 스킬 참조로 변경
2. SEMO-Next: Core 스킬 참조로 변경
3. SEMO-QA: Core 스킬 참조로 변경

## Base + Extension 패턴 예시

### Core Base (semo-core/skills/health-check/SKILL.md)

```yaml
name: health-check-base
check_items:
  - git --version
  - gh --version
  - gh auth status
```

### Extension (semo-qa/skills/health-check/SKILL.md)

```yaml
name: health-check
extends: semo-core/skills/health-check-base
additional_checks:
  - curl -s {stg_url}
  - api health check
```

## 버저닝 영향

- SEMO-Core: MINOR 버전 업 (새 스킬 추가)
- SEMO-PO: MINOR 버전 업 (스킬 참조 변경)
- SEMO-Next: MINOR 버전 업 (스킬 참조 변경)
- SEMO-QA: 초기 버전이므로 영향 없음

## 우선순위

1. **즉시 적용**: `notify-slack` (SEMO-QA에서 필요)
2. **다음 단계**: `feedback`, `project-status`
3. **추후 적용**: `semo-help`, `health-check` (Base + Extension)

## 참고

이 문서는 계획 문서입니다. 실제 추출 작업은 SEMO-Core 레포지토리에서 별도로 진행합니다.
