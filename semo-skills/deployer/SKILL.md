---
name: deployer
description: |
  외부 프로젝트 배포 관리. Use when (1) "배포해줘", "deploy",
  (2) 프로젝트 별칭 + 환경 (예: "랜드 stg 배포"), (3) Milestone 관리.
tools: [Read, Bash, mcp__github__*]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: deployer 호출`

# deployer Skill

> 프로젝트 별칭 기반 외부 프로젝트 배포

## Trigger Keywords

- "배포해줘", "deploy"
- "{별칭} {환경} 배포" (예: "랜드 stg 배포")
- "Milestone close"

## 프로젝트 별칭 참조

**반드시 먼저 읽을 파일**: `.claude/memory/projects.md`

이 파일에서 프로젝트 별칭과 배포 방법을 확인합니다.

## Workflow

### 1. 프로젝트 식별

```
입력: "랜드 stg 배포해줘"

1. .claude/memory/projects.md 읽기
2. "랜드" → semicolon-devteam/cm-land 매핑
3. "stg" → Milestone close 방식 확인
```

### 2. 환경별 배포 절차

#### DEV 배포
```bash
# dev 브랜치 상태 확인 및 push
gh api repos/{owner}/{repo}/branches/dev
```

#### STG 배포
```bash
# 1. 열린 Milestone 목록 조회
gh api repos/{owner}/{repo}/milestones --jq '.[] | select(.state=="open")'

# 2. 사용자에게 Milestone 선택 요청

# 3. Milestone Close
gh api repos/{owner}/{repo}/milestones/{number} -X PATCH -f state=closed
```

#### PRD 배포
```bash
# 1. 열린 Milestone 조회
gh api repos/{owner}/{repo}/milestones --jq '.[] | select(.state=="open")'

# 2. source-tag 라벨 확인/추가
gh api repos/{owner}/{repo}/labels --jq '.[].name' | grep source-tag

# 3. Milestone에 라벨이 연결된 이슈가 있는지 확인 후 Close
gh api repos/{owner}/{repo}/milestones/{number} -X PATCH -f state=closed
```

## 출력 포맷

```
[SEMO] deployer: 프로젝트 식별 완료
  - 프로젝트: cm-land (semicolon-devteam/cm-land)
  - 환경: STG
  - 방법: Milestone Close

[SEMO] deployer: Milestone 목록 조회
  1. v1.2.0 (이슈 5개, PR 3개)
  2. v1.3.0 (이슈 2개, PR 1개)

배포할 Milestone을 선택해주세요: ___

[SEMO] deployer: Milestone 'v1.2.0' Close 완료
  → STG 배포가 자동으로 트리거됩니다.
  → GitHub Actions: https://github.com/semicolon-devteam/cm-land/actions
```

## 주의사항

- PRD 배포 시 반드시 STG 검증 여부 확인
- Milestone Close 전 연결된 이슈/PR 상태 확인
- 배포 실패 시 GitHub Actions 로그 확인 안내
