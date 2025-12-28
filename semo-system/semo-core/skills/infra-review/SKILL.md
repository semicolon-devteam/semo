---
name: review
description: |
  인프라 설정 리뷰. docker-compose, nginx, 환경변수 설정을 검증하고
  PR에 리뷰 코멘트를 자동 등록합니다.
  Use when (1) "/SEMO:review", (2) "리뷰해줘", "PR 리뷰", (3) "인프라 리뷰".
tools: [Bash, Read, Grep, Glob]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: review (infra)` 시스템 메시지를 첫 줄에 출력하세요.

# Infra 리뷰 Skill

> 인프라 설정 검증 + PR 리뷰 등록

## 워크플로우

### Phase 1: Docker Compose 검증

```bash
# docker-compose 문법 검증
docker compose config --quiet

# 서비스 정의 확인
docker compose config --services
```

**검증 항목**:
- [ ] docker-compose.yml 문법 유효
- [ ] 서비스 정의 완전성
- [ ] 네트워크 설정
- [ ] 볼륨 마운트 경로

### Phase 2: Nginx 설정 검증

```bash
# nginx 설정 문법 검증 (Docker 컨테이너 활용)
docker run --rm -v $(pwd)/nginx:/etc/nginx:ro nginx nginx -t
```

**검증 항목**:
- [ ] nginx.conf 문법 유효
- [ ] upstream 설정
- [ ] SSL/TLS 설정
- [ ] 프록시 패스 설정

### Phase 3: 환경변수 검증

**검증 항목**:
- [ ] .env.example 존재
- [ ] 필수 환경변수 정의
- [ ] 시크릿 값 하드코딩 없음
- [ ] 환경별 설정 분리

### Phase 4: 보안 검증

```bash
# 불필요한 포트 노출 확인
grep -E "ports:" docker-compose.yml

# 시크릿 하드코딩 확인
grep -rE "(password|secret|key).*=.*['\"][^$]" .
```

**검증 항목**:
- [ ] 불필요한 포트 노출 없음
- [ ] 시크릿 관리 (Docker secrets 또는 환경변수)
- [ ] 권한 설정 적절

### Phase 5: PR 리뷰 등록

```bash
# PR 번호 조회
PR_NUMBER=$(gh pr list --head $(git branch --show-current) --json number -q '.[0].number')

# 리뷰 등록
gh pr review $PR_NUMBER --{approve|comment|request-changes} --body "리뷰 코멘트..."
```

## 출력 포맷

### 리뷰 진행 중

```markdown
[SEMO] Skill: review (infra)

📋 인프라 변경 감지
🔍 PR: #{pr_number}

=== Phase 1: Docker Compose ===
- 문법 검증: ✅ 유효
- 서비스 정의: ✅ 5개 서비스
- 네트워크: ✅ 설정됨
- 볼륨: ✅ 경로 확인됨

=== Phase 2: Nginx 설정 ===
- 문법 검증: ✅ 유효
- upstream: ✅ 설정됨
- SSL: ✅ 인증서 경로 확인

=== Phase 3: 환경변수 ===
- .env.example: ✅ 존재
- 필수 변수: ✅ 정의됨
- 하드코딩: ✅ 없음

=== Phase 4: 보안 ===
- 포트 노출: ✅ 80, 443만 노출
- 시크릿 관리: ✅ 환경변수 사용
```

### 리뷰 완료

```markdown
## 최종 결과: ✅ APPROVE

모든 검증 항목을 통과했습니다.

PR #{pr_number}에 리뷰 코멘트를 등록합니다...
✅ 리뷰 등록 완료
```

## Severity 분류

### Critical (PR 차단)

- docker-compose 문법 오류
- nginx 설정 오류
- 시크릿 하드코딩 발견
- 보안 취약점

### Warning (수정 권장)

- 불필요한 포트 노출
- 환경변수 문서화 누락
- 권한 설정 미흡

### Suggestion (선택적 개선)

- 설정 최적화
- 리소스 제한 설정

## References

- [scaffold-compose Skill](../scaffold-compose/SKILL.md) - Docker Compose 스캐폴딩
- [scaffold-nginx Skill](../scaffold-nginx/SKILL.md) - Nginx 스캐폴딩
- [verify-compose Skill](../verify-compose/SKILL.md) - Compose 검증
