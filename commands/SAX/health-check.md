---
name: health-check
description: 디자인 환경 검증 및 도구 상태 확인
---

# /SAX:health-check Command

디자인 환경 및 도구 상태를 자동으로 검증합니다.

## Trigger

- `/SAX:health-check` 명령어
- "환경 확인", "도구 확인", "설정 확인" 키워드
- onboarding-master Agent에서 자동 호출
- orchestrator가 업무 시작 시 자동 실행 (30일 경과 시)

## Action

`skill:health-check`을 실행하여 다음을 검증합니다:

1. 공통 도구 설치 (gh, git, node, pnpm)
2. 디자인 도구 (Chrome, Figma)
3. SAX 패키지 (sax-core, sax-design)
4. MCP 서버 (playwright, magic, Framelink)
5. Antigravity 설정 (선택)
6. 외부 서비스 (Slack, Figma 팀)

## Expected Output

### 성공 시

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 환경 검증

[SAX] Skill: health-check 사용

=== SAX-Design 환경 검증 결과 ===

## 공통 도구
✅ GitHub CLI: v2.40.0
✅ Git: v2.43.0
✅ Node.js: v20.10.0
✅ pnpm: v8.14.0

## 디자인 도구
✅ Chrome: 설치됨
⚠️ Figma Desktop: 미설치 (권장)

## SAX 패키지
✅ sax-core: 설치됨
✅ sax-design: 설치됨

## MCP 서버
✅ playwright: 설정됨
✅ magic: 설정됨
⚠️ Framelink: 미설정 (Figma 연동 시 필요)

## Antigravity
⚠️ .agent/: 미설정 (Antigravity 사용 시 필요)

=== 결과 ===
✅ 모든 필수 항목 통과

**다음 단계**: SAX-Design 사용 준비 완료!
```

### 실패 시

```markdown
=== SAX-Design 환경 검증 결과 ===

❌ 3개 필수 항목 미통과

**해결 방법**:

### 1. Node.js 설치
```bash
brew install node@20
```

### 2. Chrome 설치
https://www.google.com/chrome/

...

**재검증**: `/SAX:health-check` 명령어로 다시 확인하세요.
```

## Related

- [health-check Skill](../../skills/health-check/SKILL.md)
- [onboarding-master Agent](../../agents/onboarding-master/onboarding-master.md)
- [SAX Core MESSAGE_RULES.md](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
