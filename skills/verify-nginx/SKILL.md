# verify-nginx

> Nginx 설정 검증 Skill

## 개요

Nginx 설정 파일의 문법 및 구성을 검증합니다.

## 트리거

- "nginx 검증해줘"
- "nginx -t 실행"
- 자동: nginx 설정 수정 후

## 입력 파라미터

| 파라미터 | 필수 | 설명 | 예시 |
|----------|------|------|------|
| environment | ❌ | 환경 (기본: stg) | `dev`, `stg` |

## 실행 절차

### 1. 설정 파일 문법 검증

```bash
docker-compose run --rm webserver nginx -t
```

### 2. Include 파일 확인

참조된 include 파일들이 존재하는지 확인

### 3. Upstream 확인

정의된 upstream이 compose 서비스와 일치하는지 확인

### 4. 보안 헤더 확인

security-headers.conf가 적용되어 있는지 확인

## 출력

### 성공

```markdown
[SAX] verify-nginx: 검증 완료 ✅

**Nginx 설정 검증 결과**

환경: `{environment}`

### 검증 항목
- [x] 문법 검사 통과
- [x] Include 파일 존재
- [x] Upstream 매핑 정상
- [x] 보안 헤더 적용

상태: 정상
```

### 실패

```markdown
[SAX] verify-nginx: 검증 실패 ❌

**Nginx 설정 검증 결과**

환경: `{environment}`

### 오류
```
nginx: [emerg] {error_message}
nginx: configuration file /etc/nginx/nginx.conf test failed
```

### 수정 필요 항목
- {item1}: {description}
```

## 검증 항목

| 항목 | 검증 내용 |
|------|----------|
| 문법 | Nginx 설정 문법 |
| Include | 참조 파일 존재 여부 |
| Upstream | 서비스 매핑 |
| Server | server_name 중복 |
| Listen | 포트 충돌 |
| SSL | 인증서 경로 (있는 경우) |

## 자동 검증 트리거

다음 작업 완료 후 자동 실행:
- `scaffold-nginx` 완료 시
- nginx conf 파일 수정 시

## 참조

- [nginx-advisor agent](../../agents/nginx-advisor/nginx-advisor.md)
