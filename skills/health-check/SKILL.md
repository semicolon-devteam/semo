---
name: health-check
description: Validate design environment and tool status. Use when (1) new designer onboarding (triggered by /SAX:health-check), (2) orchestrator auto-runs at work start, (3) checking design tools (Figma, Chrome, Antigravity), (4) verifying MCP servers and external service access.
tools: [Bash, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SAX] Skill: health-check 호출 - 디자인 환경 검증` 시스템 메시지를 첫 줄에 출력하세요.

# health-check Skill

> 디자이너 개발 환경 및 도구 상태 자동 검증

## 역할

신규/기존 디자이너의 작업 환경을 자동으로 검증하여 SAX-Design 사용 준비 상태를 확인합니다.

## 트리거

- `/SAX:health-check` 명령어
- "환경 확인", "도구 확인", "설정 확인" 키워드
- onboarding-master Agent에서 자동 호출
- orchestrator가 업무 시작 시 자동 실행 (30일 경과 시)

---

## Quick Start

```bash
# 1. 공통 도구 확인
gh --version && git --version && node --version && pnpm --version

# 2. 디자인 도구 확인
# Chrome 설치 확인 (macOS)
ls /Applications/Google\ Chrome.app 2>/dev/null && echo "✅ Chrome 설치됨"

# 3. GitHub 인증 및 Organization
gh auth status
gh api user/orgs --jq '.[].login' | grep semicolon-devteam

# 4. SAX 패키지 확인
ls -la .claude/sax-design/ 2>/dev/null && echo "✅ sax-design 설치됨"
ls -la .claude/sax-core/ 2>/dev/null && echo "✅ sax-core 설치됨"

# 5. MCP 서버 확인
cat ~/.claude.json | jq '.mcpServers | keys'

# 6. Antigravity 설정 확인 (선택)
ls -la .agent/rules/ 2>/dev/null && echo "✅ Antigravity rules 존재"
ls -la .agent/workflows/ 2>/dev/null && echo "✅ Antigravity workflows 존재"
```

**기대 결과**:

- ✅ 공통 도구 설치됨 (gh, git, node, pnpm)
- ✅ Chrome 브라우저 설치됨
- ✅ GitHub 인증 완료
- ✅ semicolon-devteam 멤버십 확인
- ✅ SAX 패키지 설치됨 (sax-design, sax-core)
- ✅ MCP 서버 설정됨 (playwright, magic)
- ⚠️ Antigravity 설정 (선택)

---

## 검증 카테고리

### Category 1: 공통 도구

| 도구 | 필수 | 확인 명령 |
|------|------|----------|
| GitHub CLI | ✅ | `gh --version` |
| Git | ✅ | `git --version` |
| Node.js | ✅ | `node --version` (≥18) |
| pnpm | ✅ | `pnpm --version` |

### Category 2: 디자인 도구

| 도구 | 필수 | 확인 방법 |
|------|------|----------|
| Chrome | ✅ | 앱 설치 확인 |
| Figma Desktop | ⚠️ 권장 | 앱 설치 확인 |
| Figma 계정 | ⚠️ 권장 | 수동 확인 |

### Category 3: SAX 패키지

| 패키지 | 필수 | 확인 경로 |
|--------|------|----------|
| sax-core | ✅ | `.claude/sax-core/` |
| sax-design | ✅ | `.claude/sax-design/` |
| CLAUDE.md 심링크 | ✅ | `.claude/CLAUDE.md` |

### Category 4: Antigravity (선택)

| 항목 | 필수 | 확인 경로 |
|------|------|----------|
| .agent/rules/ | ⚠️ 선택 | `.agent/rules/` |
| .agent/workflows/ | ⚠️ 선택 | `.agent/workflows/` |
| sax-context.md | ⚠️ 선택 | `.agent/rules/sax-context.md` |

### Category 5: MCP 서버

| 서버 | 필수 | 용도 |
|------|------|------|
| playwright | ✅ | 브라우저 테스트 |
| magic | ✅ | UI 컴포넌트 생성 |
| Framelink | ⚠️ 권장 | Figma 연동 |
| context7 | ⚠️ 권장 | 문서 조회 |
| sequential-thinking | ⚠️ 권장 | 구조적 분석 |

### Category 6: 외부 서비스

| 서비스 | 필수 | 확인 방법 |
|--------|------|----------|
| Slack 워크스페이스 | ✅ | 수동 확인 |
| Figma 팀 접근권한 | ⚠️ 권장 | 수동 확인 |

---

## 출력 형식

### 성공 시

```markdown
[SAX] Skill: health-check 호출 - 디자인 환경 검증

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
✅ CLAUDE.md 심링크: 정상

## MCP 서버
✅ playwright: 설정됨
✅ magic: 설정됨
⚠️ Framelink: 미설정 (Figma 연동 시 필요)
✅ context7: 설정됨

## Antigravity
⚠️ .agent/rules/: 미설정 (Antigravity 사용 시 필요)
⚠️ .agent/workflows/: 미설정 (Antigravity 사용 시 필요)

## 외부 서비스
✅ GitHub 인증: 완료
✅ semicolon-devteam 멤버십: 확인
⏳ Slack 워크스페이스: 수동 확인 필요
⏳ Figma 팀 접근권한: 수동 확인 필요

=== 결과 ===
✅ 모든 필수 항목 통과 (권장 항목 3개 미설정)

**다음 단계**: SAX-Design 사용 준비 완료!
```

### 실패 시

```markdown
[SAX] Skill: health-check 호출 - 디자인 환경 검증

=== SAX-Design 환경 검증 결과 ===

❌ 3개 필수 항목 미통과

**해결 방법**:

### 1. Node.js 설치 (필수)
```bash
brew install node@20
```

### 2. Chrome 설치 (필수)
https://www.google.com/chrome/ 에서 다운로드

### 3. MCP 서버 설정 (필수)
```bash
# ~/.claude.json에 추가
jq '.mcpServers += {
  "playwright": {
    "command": "npx",
    "args": ["@anthropic/claude-mcp-playwright"]
  },
  "magic": {
    "command": "npx",
    "args": ["@anthropic/claude-mcp-magic"]
  }
}' ~/.claude.json > ~/.claude.json.tmp && mv ~/.claude.json.tmp ~/.claude.json
```

**재검증**: `/SAX:health-check` 명령어로 다시 확인하세요.
```

---

## 패키지/심링크 이상 발견 시

```markdown
[SAX] health-check: ⚠️ 패키지 설치 이상 감지

**문제**:
- ❌ 심링크 연결 오류: .claude/CLAUDE.md
- ❌ sax-design 패키지 미설치

**해결**:
`SAX 업데이트해줘`를 실행하여 패키지를 설치/심링크를 재설정하세요.
```

---

## SAX Message

```markdown
[SAX] Skill: health-check 사용

[SAX] Reference: 디자인 환경 검증 (도구/패키지/MCP/서비스) 완료
```

---

## References

- [onboarding-master Agent](../../agents/onboarding-master/onboarding-master.md)
- [SAX Core - Message Rules](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md)
- [Antigravity Setup Guide](references/antigravity-setup.md)
