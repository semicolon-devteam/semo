# semo-hooks Quickstart

> Claude Code Hooks 기반 로깅 시스템

## 대상

- 시스템 관리자
- 대화 로깅이 필요한 환경

## 주요 기능

| Hook | 설명 | 트리거 |
| ---- | ---- | ------ |
| `session-start` | 세션 시작 로깅 | 새 세션 시작 시 |
| `session-end` | 세션 종료 로깅 | 세션 종료 시 |
| `user-prompt` | 사용자 입력 로깅 | 프롬프트 제출 시 |
| `stop` | 중단 로깅 | 작업 중단 시 |

## 설치 및 설정

```bash
# 1. 패키지 설치
semo add semo-hooks

# 2. 환경 변수 설정
export SEMO_DB_PASSWORD="your_password"

# 3. Claude Code 재시작
```

## 로깅 확인

```sql
-- 세션 로그 조회
SELECT * FROM sessions ORDER BY started_at DESC LIMIT 10;

-- 프롬프트 로그 조회
SELECT * FROM prompts WHERE session_id = 'xxx';
```
