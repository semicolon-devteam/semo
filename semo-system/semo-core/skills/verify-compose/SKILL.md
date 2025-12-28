---
name: verify-compose
description: Docker Compose 설정 문법 및 구성 검증. Use when (1) compose 검증, (2) config 확인, (3) compose 수정 후.
tools: [Bash, Read]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: verify-compose 호출 - {환경}` 시스템 메시지를 첫 줄에 출력하세요.

# verify-compose

> Docker Compose 설정 검증 Skill

## 개요

docker-compose.yml 문법 및 설정을 검증합니다.

## 트리거

- "compose 검증해줘"
- "docker-compose config 확인"
- 자동: compose 수정 후

## 입력 파라미터

| 파라미터 | 필수 | 설명 | 예시 |
|----------|------|------|------|
| environment | ❌ | 환경 (기본: stg) | `dev`, `stg` |

## 실행 절차

### 1. 문법 검증

```bash
docker-compose --env-file .env.{env} config
```

### 2. 서비스 목록 확인

```bash
docker-compose --env-file .env.{env} config --services
```

### 3. 이미지 참조 확인

모든 서비스의 이미지가 유효한지 확인

### 4. 네트워크 참조 확인

사용된 네트워크가 정의되어 있는지 확인

### 5. 볼륨 경로 확인

마운트 경로가 유효한지 확인

## 출력

### 성공

```markdown
[SEMO] verify-compose: 검증 완료 ✅

**Docker Compose 검증 결과**

환경: `{environment}`
서비스 수: {count}

### 서비스 목록
- cm-land
- cm-office
- land-backend
- ...

상태: 정상
```

### 실패

```markdown
[SEMO] verify-compose: 검증 실패 ❌

**Docker Compose 검증 결과**

환경: `{environment}`

### 오류
```
{error_message}
```

### 수정 필요 항목
- {item1}
- {item2}
```

## 검증 항목

| 항목 | 검증 내용 |
|------|----------|
| 문법 | YAML 문법 오류 |
| 이미지 | 이미지 참조 형식 |
| 네트워크 | 네트워크 정의 존재 |
| 볼륨 | 볼륨 경로 형식 |
| 환경변수 | 변수 참조 유효성 |
| 포트 | 포트 충돌 |

## 자동 검증 트리거

다음 작업 완료 후 자동 실행:
- `scaffold-compose` 완료 시
- docker-compose.yml 수정 시

## 참조

- [deploy-master agent](../../agents/deploy-master/deploy-master.md)
