---
name: /SAX:health-check
description: 개발 환경 검증 및 인증 상태 확인
trigger: "/SAX:health-check"
---

# /SAX:health-check Command

개발 환경 및 인증 상태를 자동으로 검증합니다.

## Trigger

- `/SAX:health-check` 명령어
- "환경 확인", "도구 확인", "설치 확인" 키워드
- onboarding-master Agent에서 자동 호출
- orchestrator가 업무 시작 시 자동 실행 (30일 경과 시)

## Action

`skill:health-check`을 실행하여 다음을 검증합니다:

1. 필수 도구 설치 (gh, git, node, pnpm, supabase)
2. 선택 도구 (postgresql)
3. GitHub 인증 및 Organization 멤버십
4. 레포지토리 접근 권한 (docs, core-supabase)
5. Slack 워크스페이스 참여 (수동 확인)

## Expected Output

### 성공 시

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 환경 검증

[SAX] Skill: health-check 사용

=== SAX 환경 검증 결과 ===

✅ GitHub CLI: v2.40.0
✅ Git: v2.43.0
✅ Node.js: v20.10.0
✅ pnpm: v8.14.0
✅ Supabase CLI: v1.142.0
⚠️  PostgreSQL: 미설치 (선택, 유사시 디버깅에 필요)

✅ GitHub 인증: 완료
✅ semicolon-devteam 멤버십: 확인
✅ docs 레포 접근: 가능
✅ core-supabase 레포 접근: 가능

✅ Slack 워크스페이스 참여: 확인

=== 결과 ===
✅ 모든 필수 항목 통과

**다음 단계**: 온보딩 완료. `/SAX:onboarding`으로 PO 워크플로우 학습을 진행하세요.
```

### 실패 시

```markdown
=== SAX 환경 검증 결과 ===

❌ 5개 필수 항목 미통과

**해결 방법**:

### 1. Git 설치
```bash
brew install git
```

### 2. GitHub 인증
```bash
gh auth login
```

...

**재검증**: `/SAX:health-check` 명령어로 다시 확인하세요.
```

## References

- [health-check Skill](../skills/health-check/skill.md)
- [SAX Core MESSAGE_RULES.md](https://github.com/semicolon-devteam/docs/blob/main/sax/core/MESSAGE_RULES.md)
