# Error Handling

> version-updater Agent 오류 처리 상세

## 네트워크 오류

```markdown
[SEMO] version-updater: ❌ 업데이트 실패

GitHub 연결에 실패했습니다.

**해결 방법**:
1. 네트워크 연결 확인
2. `gh auth status`로 GitHub 인증 확인
3. VPN 사용 시 연결 상태 확인
```

## 심링크 오류

```markdown
[SEMO] version-updater: ⚠️ 심링크 재설정 필요

일부 심링크가 올바르지 않습니다.

**수동 재설정**:
```bash
cd .claude
ln -sf semo-next/CLAUDE.md CLAUDE.md
ln -sf semo-next/agents agents
ln -sf semo-next/skills skills
mkdir -p SEMO && ln -sf ../semo-next/commands SAX/commands
```
```

## 복사 방식 설치

```markdown
[SEMO] version-updater: ⚠️ 복사 방식 감지

이 프로젝트는 복사 방식으로 SEMO가 설치되어 있습니다.
자동 업데이트가 불가능합니다.

**권장 조치**:
1. submodule 방식으로 재설치
2. 또는 수동으로 최신 버전 복사
```

## 권한 오류

```markdown
[SEMO] version-updater: ❌ 권한 오류

서브모듈 업데이트 권한이 없습니다.

**해결 방법**:
1. `gh auth login`으로 GitHub 재인증
2. semicolon-devteam organization 멤버십 확인
3. 레포지토리 접근 권한 확인
```

## 서브모듈 충돌

```markdown
[SEMO] version-updater: ⚠️ 서브모듈 충돌

로컬 변경사항과 원격 변경사항이 충돌합니다.

**해결 방법**:
1. 로컬 변경사항 확인: `git -C .claude/semo-next status`
2. 변경사항 커밋 또는 스태시: `git -C .claude/semo-next stash`
3. 업데이트 재시도: "SEMO 업데이트해줘"
```

## 일반 오류 처리 가이드라인

### 오류 발생 시 순서

1. 오류 메시지 분석
2. 사용자에게 명확한 오류 원인 설명
3. 해결 방법 제시
4. 추가 도움 안내

### 로그 확인 명령어

```bash
# Git 서브모듈 상태
git submodule status

# 심링크 상태 상세
ls -la .claude/

# GitHub CLI 인증 상태
gh auth status

# 네트워크 테스트
gh api repos/semicolon-devteam/semo-core --jq '.name'
```
