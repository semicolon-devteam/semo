# SEMO Test Framework

> 세션 독립적인 입출력 검증 테스트

## 개요

SEMO의 특정 입력에 대해 올바른 라우팅, 스킬 호출, 출력이 수행되는지 검증합니다.

## 디렉토리 구조

```
tests/
├── runner.ts              # 테스트 실행기
├── schema.ts              # 테스트 케이스 스키마
├── cases/
│   ├── biz/               # Business Layer 케이스
│   ├── eng/               # Engineering Layer 케이스
│   └── ops/               # Operations Layer 케이스
└── lib/
    ├── parser.ts          # YAML 파서
    ├── matcher.ts         # 출력 매칭
    └── reporter.ts        # 결과 리포트
```

## 테스트 케이스 작성

```yaml
# cases/{layer}/{test-name}.yaml
name: list-my-tasks
description: 할당된 작업 목록 조회
category: biz/management

input: "내 할당된 작업 확인해줘"

expected:
  routing:
    layer: biz
    package: management

  skill: list-my-tasks

  output:
    contains:
      - "## 할당된 작업"
      - "| 레포 | # | 제목"
    pattern: "총 \\d+건"

  side_effects:
    gh_commands:
      - pattern: "gh api graphql"
        contains: "assignee:@me"

mock:
  gh_api_response: |
    {"data": {"search": {"nodes": [...]}}}
```

## 실행 방법

```bash
# 전체 테스트
npx ts-node semo-system/tests/runner.ts

# 특정 케이스
npx ts-node semo-system/tests/runner.ts --case=list-my-tasks

# 특정 레이어
npx ts-node semo-system/tests/runner.ts --layer=biz

# E2E 모드 (실제 API 호출)
npx ts-node semo-system/tests/runner.ts --e2e

# Mock 모드 (기본값)
npx ts-node semo-system/tests/runner.ts --mock
```

## 검증 레이어

### Layer 1: Routing
입력이 올바른 레이어/패키지로 라우팅되는지 검증

### Layer 2: Skill
올바른 스킬이 호출되는지 검증

### Layer 3: Output
출력 형식이 기대와 일치하는지 검증

### Layer 4: Side Effects
gh 명령, 파일 생성 등 부수 효과 검증

## CI 통합

PR 생성 시 자동으로 테스트가 실행됩니다.

```yaml
# .github/workflows/semo-test.yml
on:
  pull_request:
    paths:
      - 'packages/**'
      - 'semo-system/**'
```
