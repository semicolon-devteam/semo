---
name: incident
description: |
  장애 대응 및 롤백. Use when:
  (1) 서비스 장애 발생, (2) 롤백 필요, (3) 디버깅 필요.
tools: [Bash, Read]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: incident 호출 - {action}` 시스템 메시지를 첫 줄에 출력하세요.

# incident Skill

> 장애 대응 및 롤백 처리

## Actions

| Action | 설명 | 트리거 |
|--------|------|--------|
| **debug** | 서비스 디버깅 | "에러 확인", "로그 조회" |
| **rollback** | 이전 버전 롤백 | "롤백해줘", "이전 버전으로" |
| **hotfix** | 긴급 핫픽스 | "긴급 수정" |

---

## Action: debug (디버깅)

### Workflow

```bash
# 로그 확인 (Docker)
docker logs {container_name} --tail 100

# PM2 로그
pm2 logs {service_name} --lines 100

# SSH 로그 조회
ssh user@server "tail -n 100 /var/log/{service}.log"
```

### 출력

```markdown
[SEMO] Skill: incident 완료 (debug)

✅ 에러 로그 확인 완료

**서비스**: ms-notifier
**에러**: Connection timeout
**원인**: DB 연결 실패
```

---

## Action: rollback (롤백)

### Workflow

```bash
# Docker 이미지 롤백
ssh user@server << 'EOF'
  docker stop {service}
  docker rm {service}
  docker run -d --name {service} \
    {service}:{previous_tag}
EOF

# PM2 롤백
ssh user@server "pm2 delete {service} && pm2 start ecosystem.config.js --only {service}"

# Git 롤백 (코드)
git revert {commit_hash}
git push origin {branch}
```

### 출력

```markdown
[SEMO] Skill: incident 완료 (rollback)

✅ 롤백 완료

**서비스**: ms-notifier
**From**: v1.2.3
**To**: v1.2.2
**상태**: Running
```

---

## Related

- `deploy` - 배포 관리
- `health-check` - 헬스체크
- `notify` - 장애 알림
