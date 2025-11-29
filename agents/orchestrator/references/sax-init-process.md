# SAX init Process

> SAX init 커밋 요청 시 직접 처리 프로세스

## 사전 검사

### 1. Git 저장소 확인

Git 초기화 안됨 → `onboarding-master`로 인계

```markdown
[SAX] Orchestrator: Git 저장소 미감지

[SAX] Agent 위임: onboarding-master (사유: Git 환경 설정 필요)
```

### 2. 변경사항 확인

SAX 설치 외 다른 변경사항 존재 → 사용자에게 안내

```markdown
[SAX] Orchestrator: 미커밋 변경사항 감지

⚠️ SAX 설치 외 다른 변경사항이 있습니다.

**옵션**:
1. 모든 변경사항을 함께 커밋
2. SAX 관련 파일만 커밋 (.claude/, .gitmodules)
3. 취소하고 먼저 다른 변경사항 정리

어떻게 진행할까요?
```

## SAX init 커밋 실행

검사 통과 시 직접 실행:

```bash
# 1. SAX 관련 파일 스테이징
git add .claude/ .gitmodules

# 2. 커밋 생성
git commit -m "🔧 Initialize SAX-PO package

- Add sax-core submodule
- Add sax-po submodule
- Configure symlinks for CLAUDE.md, agents/, skills/

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 3. 푸시
git push origin HEAD
```

## 완료 메시지

```markdown
[SAX] SAX init 완료!

✅ SAX-PO 설치가 커밋되었습니다.

**커밋 내용**:
- .claude/sax-core (서브모듈)
- .claude/sax-po (서브모듈)
- .claude/CLAUDE.md → sax-po/CLAUDE.md
- .claude/agents/ → sax-po/agents/
- .claude/skills/ → sax-po/skills/

**다음 단계**:
- `/SAX:help`로 사용 가능한 명령어 확인
- `Epic 만들어줘`로 첫 Epic 생성 시작
```
