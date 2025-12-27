# eng/infra Quickstart

> DevOps/인프라 엔지니어를 위한 빠른 시작 가이드

## 대상

- DevOps 엔지니어
- 인프라 관리자
- 배포 담당자

## 주요 스킬

| 스킬 | 설명 | 트리거 예시 |
| ---- | ---- | ----------- |
| `deploy-service` | 서비스 배포 | "서비스 배포해줘" |
| `scaffold-compose` | Docker Compose 생성 | "Compose 파일 만들어줘" |
| `scaffold-nginx` | Nginx 설정 생성 | "Nginx 설정 만들어줘" |
| `rollback-service` | 서비스 롤백 | "이전 버전으로 롤백해줘" |

## 빠른 시작 예시

```text
"서비스 배포해줘"             → skill:deploy-service
"Docker Compose 만들어줘"     → skill:scaffold-compose
"Nginx 설정 만들어줘"         → skill:scaffold-nginx
"이전 버전으로 롤백해줘"      → skill:rollback-service
```

## 배포 워크플로우

```text
1. 배포 준비
   → Compose/Nginx 설정 확인
   → 환경변수 동기화

2. 배포 실행
   → "서비스 배포해줘"
   → GitHub Actions 자동 배포

3. 상태 확인
   → "health-check 해줘"
   → 서비스 상태 확인

4. 문제 발생 시
   → "롤백해줘"
   → 이전 안정 버전 복구
```

## 상세 튜토리얼

```text
"인프라 온보딩 실습해줘" → skill:onboarding-infra
```
