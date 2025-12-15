---
name: sync-env
description: 환경변수 파일 동기화 및 검증. Use when (1) 환경변수 확인, (2) env 체크, (3) 시크릿 동기화.
tools: [Bash, Read, Write]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: sync-env 호출 - {환경}` 시스템 메시지를 첫 줄에 출력하세요.

# sync-env

> 환경변수 동기화 및 검증 Skill

## 개요

환경변수 파일을 검증하고 동기화합니다.

## 트리거

- "환경변수 확인해줘"
- "env 체크"
- "시크릿 동기화"

## 입력 파라미터

| 파라미터 | 필수 | 설명 | 예시 |
|----------|------|------|------|
| environment | ❌ | 환경 (기본: 전체) | `dev`, `stg` |
| service | ❌ | 특정 서비스 | `cm-land` |

## 실행 절차

### 1. 환경 파일 목록 확인

```bash
ls -la .env*
```

### 2. 필수 변수 검증

각 서비스에 필요한 환경변수가 정의되어 있는지 확인

### 3. 변수 형식 검증

- 태그 변수: `{SERVICE}_TAG=...`
- URL 변수: 유효한 URL 형식
- 비밀번호: 빈 값 아님

### 4. 환경 간 일관성 검증

dev와 stg 간 변수 누락 확인

## 출력

### 성공

```markdown
[SEMO] sync-env: 검증 완료 ✅

**환경변수 검증 결과**

### 파일별 상태
| 파일 | 변수 수 | 상태 |
|------|---------|------|
| .env.dev | 15 | ✅ |
| .env.stg | 15 | ✅ |
| .env.cm-land | 5 | ✅ |

### 태그 변수
| 서비스 | dev | stg |
|--------|-----|-----|
| CM_LAND_TAG | latest | v1.2.3 |
| CORE_BACKEND_TAG | latest | stg-abc |

상태: 정상
```

### 경고

```markdown
[SEMO] sync-env: 검증 완료 (경고 있음) ⚠️

**환경변수 검증 결과**

### 경고 항목
- `.env.dev`에 `NEW_VAR` 있으나 `.env.stg`에 없음
- `API_SECRET` 값이 비어있음

### 권장 조치
1. 누락된 변수 추가
2. 비어있는 값 설정
```

## 검증 항목

### 필수 변수 (공통)

```bash
# 이미지 태그
CM_LAND_TAG
CM_OFFICE_TAG
CORE_BACKEND_TAG
MS_MEDIA_PROCESSOR_TAG
```

### 서비스별 필수 변수

| 서비스 | 필수 변수 |
|--------|----------|
| cm-land | SUPABASE_URL, API_URL |
| land-backend | SUPABASE_URL, JWT_SECRET |
| ms-media-processor | STORAGE_URL, TEMP_DIR |

## 환경 파일 구조

```text
core-compose/
├── .env.dev              # 개발 환경 공통
├── .env.stg              # 스테이징 환경 공통
├── .env.land-backend     # land-backend 전용
├── .env.office-backend   # office-backend 전용
└── .env.ms-*             # 마이크로서비스 전용
```

## 참조

- [deploy-master agent](../../agents/deploy-master/deploy-master.md)
