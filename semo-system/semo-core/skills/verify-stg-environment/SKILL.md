---
name: verify-stg-environment
description: |
  STG 환경 상태 확인. Use when:
  (1) 테스트 전 환경 검증, (2) 서버 접속 확인,
  (3) 배포 상태 확인, (4) 환경 문제 진단.
tools: [Bash, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: verify-stg-environment 호출` 시스템 메시지를 첫 줄에 출력하세요.

# Verify STG Environment Skill

> STG 환경 상태 확인 및 검증

## 트리거

- "STG 환경 확인", "환경 상태", "접속 확인" 키워드
- 테스트 시작 전 자동 호출 (qa-master)

## 검증 항목

1. **서버 접속**: STG URL 응답 확인
2. **API 헬스체크**: /api/health 엔드포인트
3. **배포 상태**: 최근 배포 시간
4. **테스트 계정**: 로그인 가능 여부

## 검증 스크립트

```bash
# 1. 서버 접속 확인
curl -s -o /dev/null -w "%{http_code}" https://stg.example.com

# 2. API 헬스체크
curl -s https://stg-api.example.com/api/health | jq '.status'

# 3. 최근 배포 확인
gh run list --repo semicolon-devteam/{repo} --workflow deploy-stg --limit 1 --json conclusion,createdAt
```

## 출력 형식

### 정상 상태

```markdown
[SEMO] Skill: verify-stg-environment 호출

## 🌐 STG 환경 상태: ✅ 정상

| 항목 | 상태 | 상세 |
|------|------|------|
| 서버 접속 | ✅ OK | https://stg.example.com (200) |
| API 헬스 | ✅ OK | /api/health → healthy |
| 최근 배포 | ✅ OK | 2024-11-29 10:30:00 (2시간 전) |
| 테스트 계정 | ✅ OK | 로그인 성공 |

테스트를 진행해도 좋습니다.
```

### 문제 감지

```markdown
[SEMO] Skill: verify-stg-environment 호출

## 🌐 STG 환경 상태: ⚠️ 문제 감지

| 항목 | 상태 | 상세 |
|------|------|------|
| 서버 접속 | ❌ FAIL | 연결 시간 초과 |
| API 헬스 | - | 확인 불가 |
| 최근 배포 | ✅ OK | 2024-11-29 10:30:00 |
| 테스트 계정 | - | 확인 불가 |

### 권장 조치

1. DevOps 팀에 STG 서버 상태 확인 요청
2. Slack #devops 채널에 알림
3. 환경 복구 후 재테스트

환경 설정 요청을 보낼까요? (Y/n)
```

## 환경 정보 소스

환경별 URL 및 테스트 계정:

```yaml
# 프로젝트별 환경 정보
cm-office:
  stg_url: "https://stg-office.semicolon.com"
  api_url: "https://stg-api.semicolon.com"
  health_endpoint: "/api/health"

core-backend:
  stg_url: "https://stg-api.semicolon.com"
  health_endpoint: "/health"
```

## 자동 재시도

접속 실패 시 3회 재시도:

```bash
for i in {1..3}; do
  response=$(curl -s -o /dev/null -w "%{http_code}" "$URL" --max-time 10)
  if [ "$response" = "200" ]; then
    echo "OK"
    break
  fi
  sleep 5
done
```

## References

- [Environment URLs](references/environment-urls.md)
- [Troubleshooting](references/troubleshooting.md)

## Related

- [stg-operator Agent](../../agents/stg-operator/stg-operator.md)
- [execute-test Skill](../execute-test/SKILL.md)
