# semo-remote Quickstart

> Claude Code 모바일 원격 제어 시스템

## 대상

- 원격 작업 승인이 필요한 환경
- 모바일에서 Claude Code 제어가 필요한 사용자

## 주요 기능

| 기능 | 설명 | 사용 시나리오 |
| ---- | ---- | ------------- |
| `permission` | 권한 원격 승인 | 도구 실행 승인/거부 |
| `user_question` | 질문 응답 | AskUserQuestion 원격 응답 |
| `text_input` | 텍스트 입력 | idle_prompt 원격 입력 |
| `selection` | 선택지 응답 | 다중 선택 질문 응답 |

## 설치 및 설정

```bash
# 1. 패키지 설치
semo add semo-remote

# 2. 환경 변수 설정
export SEMO_REMOTE_ENABLED=true
export SEMO_DB_PASSWORD="your_password"

# 3. DB 스키마 적용
psql -f semo-system/semo-remote/db/schema.sql

# 4. Claude Code 재시작
```

## 원격 요청 흐름

```text
1. Claude Code에서 권한 요청 발생
   → PermissionRequest Hook 트리거
   → DB에 remote_request 생성

2. 모바일 PWA에서 알림 수신
   → 요청 내용 확인
   → 승인/거부 선택

3. 응답 처리
   → DB 업데이트
   → Claude Code에서 결과 수신
   → 작업 계속/중단
```

## MCP 도구

```text
semo_remote_request   - 원격 요청 생성
semo_remote_respond   - 원격 요청 응답
semo_remote_pending   - 대기 중인 요청 조회
```
