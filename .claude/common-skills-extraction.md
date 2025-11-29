# Common Skills Extraction Plan

> SAX-Core로 추출해야 할 공통 스킬 목록 및 계획

## 배경

SAX-PO, SAX-Next, SAX-QA에서 공통으로 사용하는 스킬들을 SAX-Core로 추출하여 중복을 제거하고 일관성을 확보합니다.

## 추출 대상 스킬

### 1. notify-slack

**현재 위치**: `sax-po/skills/notify-slack/`

**사용처**:

- SAX-PO: Draft Task 생성 후 알림
- SAX-Next: PR 생성/머지 알림 (예정)
- SAX-QA: 테스트 결과 알림

**추출 형태**:

```
sax-core/
└── skills/
    └── notify-slack/
        ├── SKILL.md
        └── references/
            ├── slack-id-mapping.md
            └── message-templates.md
```

### 2. sax-help

**현재 위치**: `sax-meta/skills/sax-help/`

**사용처**: 모든 SAX 패키지

**추출 형태**: Base + Extension 패턴

```
sax-core/skills/sax-help/SKILL.md  # 공통 도움말 구조
sax-po/skills/sax-help/SKILL.md    # PO 특화 도움말 (extends core)
sax-next/skills/sax-help/SKILL.md  # 개발자 특화 도움말 (extends core)
sax-qa/skills/sax-help/SKILL.md    # QA 특화 도움말 (extends core)
```

### 3. feedback

**현재 위치**: `sax-meta/skills/feedback/`

**사용처**: 모든 SAX 패키지

**추출 형태**: 그대로 Core로 이동

### 4. health-check (Base)

**현재 위치**: `sax-po/skills/health-check/`, `sax-next/skills/health-check/`

**추출 형태**: Base + Extension 패턴

```
sax-core/skills/health-check/SKILL.md  # 공통 환경 체크 (git, gh cli 등)
sax-next/skills/health-check/SKILL.md  # 개발자 체크 추가 (node, npm 등)
sax-qa/skills/health-check/SKILL.md    # QA 체크 추가 (STG 접속 등)
```

### 5. project-status (공통 유틸리티)

**신규 생성**: GitHub Project 상태 조회 공통 로직

```
sax-core/skills/project-status/
├── SKILL.md
└── references/
    └── api-queries.md
```

## 추출 절차

### Phase 1: SAX-Core 구조 확장

```bash
mkdir -p sax-core/skills/{notify-slack,sax-help,feedback,health-check,project-status}
```

### Phase 2: 공통 스킬 이동

1. `notify-slack` → SAX-Core로 이동
2. `feedback` → SAX-Core로 이동
3. `project-status` → SAX-Core에 신규 생성

### Phase 3: Base + Extension 패턴 적용

1. `sax-help` → Core 베이스 + 패키지별 확장
2. `health-check` → Core 베이스 + 패키지별 확장

### Phase 4: 기존 패키지 업데이트

1. SAX-PO: Core 스킬 참조로 변경
2. SAX-Next: Core 스킬 참조로 변경
3. SAX-QA: Core 스킬 참조로 변경

## Base + Extension 패턴 예시

### Core Base (sax-core/skills/health-check/SKILL.md)

```yaml
name: health-check-base
check_items:
  - git --version
  - gh --version
  - gh auth status
```

### Extension (sax-qa/skills/health-check/SKILL.md)

```yaml
name: health-check
extends: sax-core/skills/health-check-base
additional_checks:
  - curl -s {stg_url}
  - api health check
```

## 버저닝 영향

- SAX-Core: MINOR 버전 업 (새 스킬 추가)
- SAX-PO: MINOR 버전 업 (스킬 참조 변경)
- SAX-Next: MINOR 버전 업 (스킬 참조 변경)
- SAX-QA: 초기 버전이므로 영향 없음

## 우선순위

1. **즉시 적용**: `notify-slack` (SAX-QA에서 필요)
2. **다음 단계**: `feedback`, `project-status`
3. **추후 적용**: `sax-help`, `health-check` (Base + Extension)

## 참고

이 문서는 계획 문서입니다. 실제 추출 작업은 SAX-Core 레포지토리에서 별도로 진행합니다.
