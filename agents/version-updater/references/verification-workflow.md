# Verification Workflow

> version-updater Agent 검증 워크플로우 상세

## Trigger

사용자가 "업데이트 제대로 됐어?" 등 검증 요청 시 실행

## Verification Step 1: 시스템 메시지 출력

```markdown
[SAX] Agent: version-updater 실행 (검증 모드)

업데이트 상태를 확인합니다...
```

## Verification Step 2: 버전 확인

```bash
# 로컬 버전 확인
cat .claude/sax-core/VERSION
cat .claude/sax-po/VERSION

# 원격 버전 확인 (GitHub)
gh api repos/semicolon-devteam/sax-core/contents/VERSION --jq '.content' | base64 -d
gh api repos/semicolon-devteam/sax-po/contents/VERSION --jq '.content' | base64 -d
```

## Verification Step 3: 심링크 상태 확인

```bash
# 심링크 대상 확인
ls -la .claude/CLAUDE.md
ls -la .claude/agents
ls -la .claude/skills
ls -la .claude/commands/SAX
```

## Verification Step 4: 검증 결과 보고

```markdown
[SAX] version-updater: 검증 완료

## 📋 SAX 업데이트 상태 검증

### 버전 상태

| 패키지 | 로컬 버전 | 원격 버전 | 상태 |
|--------|----------|----------|------|
| sax-core | {local} | {remote} | ✅/⚠️ |
| sax-po | {local} | {remote} | ✅/⚠️ |

### 심링크 상태

| 심링크 | 대상 | 상태 |
|--------|------|------|
| CLAUDE.md | sax-po/CLAUDE.md | ✅/❌ |
| agents/ | sax-po/agents/ | ✅/❌ |
| skills/ | sax-po/skills/ | ✅/❌ |
| commands/SAX/ | sax-po/commands/ | ✅/❌ |

### 결론

{상태에 따른 메시지}
- ✅ 모든 항목 정상: "SAX가 최신 상태이며 정상적으로 설정되어 있습니다."
- ⚠️ 버전 불일치: "업데이트가 필요합니다. `SAX 업데이트해줘`를 실행하세요."
- ❌ 심링크 오류: "심링크 재설정이 필요합니다."
```

## 상태별 결론 메시지

### 모든 항목 정상

```markdown
✅ SAX가 최신 상태이며 정상적으로 설정되어 있습니다.
```

### 버전 불일치

```markdown
⚠️ 업데이트가 필요합니다.

**현재 상태**:
- sax-core: {local} (최신: {remote})
- sax-po: {local} (최신: {remote})

**업데이트하려면**: "SAX 업데이트해줘"
```

### 심링크 오류

```markdown
❌ 심링크 재설정이 필요합니다.

**문제 심링크**:
- {broken_symlink} → 대상 없음

**수동 재설정**:
```bash
cd .claude
ln -sf sax-po/CLAUDE.md CLAUDE.md
ln -sf sax-po/agents agents
ln -sf sax-po/skills skills
mkdir -p commands && ln -sf ../sax-po/commands commands/SAX
```
```
