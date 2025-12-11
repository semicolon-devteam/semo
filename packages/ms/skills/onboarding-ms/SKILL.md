---
name: onboarding-ms
description: |
  마이크로서비스 개발자 온보딩 실습 (SAX-MS 패키지 전용). Use when (1) sax-core/skill:onboarding에서 호출,
  (2) 마이크로서비스 개발자 온보딩 실습 필요 시. 마이크로서비스 설계 및 개발 워크플로우 체험.
tools: [Read, Bash, Glob, Grep]
model: inherit
---

> **시스템 메시지**: `[SAX] Skill: onboarding-ms 호출`

# onboarding-ms Skill

> 마이크로서비스 개발자를 위한 온보딩 실습 (SAX-MS 패키지 전용)

## Purpose

SAX Core의 `skill:onboarding` Phase 3에서 호출됩니다.
마이크로서비스 개발자를 위한 실습 과정을 제공합니다.

## Prerequisites

- Phase 0-2 완료 (환경 진단, 조직 참여, SAX 개념 학습)
- sax-core/skill:onboarding에서 호출됨

## Workflow

### Step 1: 마이크로서비스 워크플로우 안내

```text
마이크로서비스 워크플로우:

1. 서비스 설계
   → 도메인 분석
   → 서비스 경계 정의
   → API 계약 설계

2. 서비스 구현
   → 독립적인 배포 단위
   → 데이터베이스 분리
   → 이벤트 기반 통신

3. 서비스 통합
   → API Gateway 설정
   → 서비스 디스커버리
   → 로드 밸런싱

4. 모니터링
   → 분산 트레이싱
   → 로그 집계
   → 메트릭 수집

5. 장애 대응
   → Circuit Breaker
   → Retry/Timeout
   → Fallback
```

### Step 2: 마이크로서비스 설계 실습

```markdown
## 마이크로서비스 설계 실습

간단한 서비스를 설계해보세요:

> "인증 마이크로서비스 설계해줘"

**확인 사항**:
- [SAX] Orchestrator 메시지 확인
- 서비스 경계 정의
- API 계약 설계
- 데이터 모델
```

### Step 3: 마이크로서비스 패턴 안내

```markdown
## 핵심 패턴

### 통신 패턴
- Sync: REST, gRPC
- Async: Event-Driven (Kafka, RabbitMQ)

### 데이터 패턴
- Database per Service
- Event Sourcing
- CQRS

### 복원력 패턴
- Circuit Breaker
- Bulkhead
- Retry with Backoff
```

## Expected Output

```markdown
[SAX] Skill: onboarding-ms 호출

=== 마이크로서비스 개발자 온보딩 실습 ===

## 1. 마이크로서비스 워크플로우

```text
1. 서비스 설계 → 도메인 분석, API 계약
2. 서비스 구현 → 독립 배포, 데이터 분리
3. 서비스 통합 → API Gateway, 디스커버리
4. 모니터링 → 트레이싱, 로그, 메트릭
5. 장애 대응 → Circuit Breaker, Retry
```

## 2. 마이크로서비스 설계 실습

다음 요청으로 서비스를 설계해보세요:

> "인증 마이크로서비스 설계해줘"

## 3. 핵심 패턴

- 통신: REST, gRPC, Event-Driven
- 데이터: Database per Service, CQRS
- 복원력: Circuit Breaker, Retry

✅ 실습 완료

[SAX] Skill: onboarding-ms 완료
```

## SAX Message Format

```markdown
[SAX] Skill: onboarding-ms 호출

[SAX] Skill: onboarding-ms 완료
```
