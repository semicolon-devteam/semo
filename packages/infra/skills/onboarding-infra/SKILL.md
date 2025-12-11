---
name: onboarding-infra
description: |
  인프라 엔지니어 온보딩 실습 (SAX-Infra 패키지 전용). Use when (1) sax-core/skill:onboarding에서 호출,
  (2) 인프라 엔지니어 온보딩 실습 필요 시. 인프라 설정 및 DevOps 워크플로우 체험.
tools: [Read, Bash, Glob, Grep]
model: inherit
---

> **시스템 메시지**: `[SAX] Skill: onboarding-infra 호출`

# onboarding-infra Skill

> 인프라 엔지니어를 위한 온보딩 실습 (SAX-Infra 패키지 전용)

## Purpose

SAX Core의 `skill:onboarding` Phase 3에서 호출됩니다.
인프라 엔지니어를 위한 실습 과정을 제공합니다.

## Prerequisites

- Phase 0-2 완료 (환경 진단, 조직 참여, SAX 개념 학습)
- sax-core/skill:onboarding에서 호출됨

## Workflow

### Step 1: 인프라 워크플로우 안내

```text
인프라 워크플로우:

1. 환경 설정
   → 개발/스테이징/프로덕션 환경 구성
   → 환경 변수 관리

2. CI/CD 파이프라인
   → GitHub Actions 설정
   → 자동 배포 구성

3. 모니터링
   → 로그 수집
   → 알림 설정

4. 보안
   → 시크릿 관리
   → 접근 권한 관리

5. 비용 최적화
   → 리소스 모니터링
   → 스케일링 정책
```

### Step 2: 인프라 도구 확인

```bash
# Docker 확인
docker --version

# Terraform 확인 (선택)
terraform --version

# kubectl 확인 (선택)
kubectl version --client
```

### Step 3: GitHub Actions 안내

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: echo "Deploying..."
```

## Expected Output

```markdown
[SAX] Skill: onboarding-infra 호출

=== 인프라 엔지니어 온보딩 실습 ===

## 1. 인프라 워크플로우

```text
1. 환경 설정 → 개발/스테이징/프로덕션
2. CI/CD → GitHub Actions
3. 모니터링 → 로그, 알림
4. 보안 → 시크릿, 접근 권한
5. 비용 최적화 → 리소스 모니터링
```

## 2. 인프라 도구

```bash
docker --version
terraform --version
kubectl version --client
```

## 3. GitHub Actions

기본 배포 워크플로우 예시 제공

✅ 실습 완료

[SAX] Skill: onboarding-infra 완료
```

## SAX Message Format

```markdown
[SAX] Skill: onboarding-infra 호출

[SAX] Skill: onboarding-infra 완료
```
