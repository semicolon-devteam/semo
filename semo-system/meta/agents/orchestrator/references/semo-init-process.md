# SEMO Init Process

> SEMO 초기화 커밋 프로세스

## 트리거

"SEMO init", "SEMO 설치 커밋", "SEMO init 커밋해줘"

## 사전 검사

### 1. Git 저장소 확인

Git 초기화 안됨 시:

```markdown
[SEMO] Orchestrator: Git 저장소 미감지

⚠️ Git 저장소가 초기화되지 않았습니다.

다음 명령어로 Git을 초기화하세요:
git init
git remote add origin <your-repo-url>

이후 다시 "SEMO init 커밋해줘"를 실행하세요.
```

### 2. 변경사항 확인

SEMO 설치 외 다른 변경사항 존재 시:

```markdown
[SEMO] Orchestrator: 미커밋 변경사항 감지

⚠️ SEMO 설치 외 다른 변경사항이 있습니다.

**옵션**:
1. 모든 변경사항을 함께 커밋
2. SEMO 관련 파일만 커밋 (.claude/, .gitmodules)
3. 취소하고 먼저 다른 변경사항 정리

어떻게 진행할까요?
```

## SEMO init 커밋 실행

검사 통과 시 직접 실행:

```bash
# 1. SEMO 관련 파일 스테이징
git add .claude/ .gitmodules

# 2. 커밋 생성
git commit -m "🔧 Initialize SEMO-Meta package

- Add semo-core submodule
- Add semo-meta submodule
- Configure symlinks for CLAUDE.md, agents/, skills/

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 3. 푸시
git push origin HEAD
```

## 완료 메시지

```markdown
[SEMO] SEMO init 완료!

✅ SEMO-Meta 설치가 커밋되었습니다.

**커밋 내용**:
- .claude/semo-core (서브모듈)
- .claude/semo-meta (서브모듈)
- .claude/CLAUDE.md → semo-meta/CLAUDE.md
- .claude/agents/ → semo-meta/agents/
- .claude/skills/ → semo-meta/skills/

**다음 단계**:
- `/SEMO:help`로 사용 가능한 명령어 확인
- `새 Agent 만들어줘`로 SEMO 패키지 개발 시작
```
