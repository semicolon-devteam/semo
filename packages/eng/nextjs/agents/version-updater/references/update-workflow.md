# Update Workflow

> version-updater Agent 업데이트 워크플로우 상세

## Step 1: 시스템 메시지 출력

```markdown
[SEMO] Agent: version-updater 실행

SEMO 패키지 업데이트를 시작합니다...
```

## Step 2: skill:semo-update 호출

semo-update Skill을 호출하여 실제 업데이트를 수행합니다.

```markdown
[SEMO] Skill 호출: semo-update
```

## Step 3: 업데이트 검증

업데이트 후 다음을 검증합니다:

1. **버전 확인**: VERSION 파일 확인
2. **심링크 상태**: 모든 심링크가 올바르게 설정되었는지 확인
3. **서브모듈 상태**: git submodule status 확인

```bash
# 버전 확인
cat .claude/semo-core/VERSION
cat .claude/semo-next/VERSION

# 심링크/복사 상태 확인
ls -la .claude/CLAUDE.md
ls -la .claude/agents
ls -la .claude/skills
ls -la .claude/SEMO/commands

# 서브모듈 상태
git submodule status
```

### Windows 환경 (복사 모드)

Windows에서는 심링크 대신 복사본이 사용됩니다. 업데이트 후 복사본 갱신이 필요합니다:

```bash
# 복사본 갱신 (install-sax.sh --update 사용)
./install-sax.sh next --update
```

## Step 4: 결과 보고

```markdown
[SEMO] version-updater: 업데이트 완료

## 📦 SEMO 패키지 업데이트 결과

| 패키지 | 이전 버전 | 현재 버전 | 상태 |
|--------|----------|----------|------|
| semo-core | {old} | {new} | ✅ |
| semo-next | {old} | {new} | ✅ |

### 심링크 상태

| 심링크 | 대상 | 상태 |
|--------|------|------|
| CLAUDE.md | semo-next/CLAUDE.md | ✅ |
| agents/ | semo-next/agents/ | ✅ |
| skills/ | semo-next/skills/ | ✅ |
| SAX/commands/ | semo-next/commands/ | ✅ |

**다음 단계** (선택):
- 서브모듈 변경사항 커밋: "SEMO 커밋해줘"
- 환경 검증: `/SEMO:health-check`
```

## Step 5: 커밋 안내 (선택)

사용자가 커밋을 요청하면:

```bash
git add .claude/semo-core .claude/semo-next
git commit -m ":bookmark: [SEMO] Sync to v{version}

- semo-core: {old_version} → {new_version}
- semo-next: {old_version} → {new_version}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## New Session Check Workflow

새 세션 시작 시 (대화 기록 없음) 자동 실행:

### Session Check Step 1: 환경 감지

```bash
# SEMO 설치 여부 확인
ls -la .claude/semo-next/ 2>/dev/null || echo "NOT_INSTALLED"
```

### Session Check Step 2: 버전 비교 (설치된 경우만)

```bash
# 로컬 버전
LOCAL_VERSION=$(cat .claude/semo-next/VERSION 2>/dev/null)

# 원격 버전
REMOTE_VERSION=$(gh api repos/semicolon-devteam/semo-next/contents/VERSION --jq '.content' | base64 -d 2>/dev/null)

# 비교
if [ "$LOCAL_VERSION" != "$REMOTE_VERSION" ]; then
  echo "UPDATE_AVAILABLE"
fi
```

### Session Check Step 3: 결과에 따른 안내

**업데이트 필요 시**:

```markdown
[SEMO] version-updater: 업데이트 가능

📦 **SEMO 업데이트 알림**

현재 버전: {local_version}
최신 버전: {remote_version}

업데이트하려면: "SEMO 업데이트해줘"
```

**최신 상태 시**:

```markdown
[SEMO] version-updater: 최신 버전 확인 ✅

SEMO {version}이 설치되어 있습니다.
```
