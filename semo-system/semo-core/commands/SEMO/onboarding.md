# /SEMO:onboarding

> 신규 개발자 온보딩 프로세스

## Trigger

- `/SEMO:onboarding` 명령어
- "처음이에요", "신규", "온보딩", "시작 방법" 키워드

## Workflow

### Phase 0: 환경 진단

```markdown
[SEMO] Onboarding: Phase 0 - 환경 진단

/SEMO:health 명령어로 환경을 검증합니다...
```

`/SEMO:health` 호출하여 필수 도구 검증:
- Git, Node.js, pnpm
- GitHub CLI (`gh`)
- Claude Code

**실패 시**: 각 항목별 설치 가이드 제공 후 재검증
**성공 시**: Phase 1 진행

### Phase 1: 프로젝트 설정 동기화

```markdown
[SEMO] Onboarding: Phase 1 - 프로젝트 설정 동기화
```

#### 1.1 .gitignore SEMO 설정 확인

```bash
# SEMO 섹션 존재 확인
if grep -q "SEMO: Claude Code Configuration Management" .gitignore 2>/dev/null; then
  echo "✅ .gitignore SEMO 설정 존재"
else
  echo "⚠️ .gitignore SEMO 설정 누락 - 동기화 필요"
fi
```

**누락 시 자동 추가**:
```bash
# SEMO gitignore 템플릿 추가
cat semo-system/semo-core/templates/gitignore-semo.txt >> .gitignore
```

#### 1.2 로컬 설정 파일 생성 안내

```markdown
SEMO는 다음과 같은 계층적 설정 구조를 사용합니다:

| 파일 | 용도 | Git |
|------|------|-----|
| `settings.json` | 팀 공통 설정 | ✅ 커밋 |
| `settings.local.json` | 개인 오버라이드 | ❌ 제외 |
| `CLAUDE.md` | 프로젝트 규칙 | ✅ 커밋 |
| `CLAUDE.local.md` | 개인 메모 | ❌ 제외 |

개인 설정이 필요하면 `*.local.*` 파일을 생성하세요.
```

### Phase 1.5: 토큰 설정

```markdown
[SEMO] Onboarding: Phase 1.5 - 토큰 설정
```

> **참조**: [TOKEN_MANAGEMENT.md](../../integrations/TOKEN_MANAGEMENT.md)

#### 1.5.1 팀 공용 토큰 확인 (자동)

팀 공용 토큰은 SEMO 설치 시 **자동으로 설정**됩니다.

```markdown
### 팀 공용 토큰 (자동 설정)

| 토큰 | 용도 | 상태 |
|------|------|------|
| Semicolon Notifier | Slack 알림 | ✅ 자동 설정됨 |
| Team GitHub Bot | 팀 저장소 접근 | ✅ 자동 설정됨 |

> 팀 공용 토큰은 `semo-mcp` 패키지에 내장되어 있어 별도 설정이 필요 없습니다.
```

#### 1.5.2 개인 토큰 설정 안내

```markdown
### 개인 토큰 설정 (필수)

GitHub Personal Access Token이 필요합니다.

**생성 방법**:
1. https://github.com/settings/tokens 접속
2. "Generate new token (classic)" 클릭
3. 권한 선택:
   - `repo` (전체)
   - `read:org`
4. 토큰 생성 후 복사

**설정 방법** (택 1):
```

```bash
# 방법 1: 환경변수 설정 (권장)
# ~/.zshrc 또는 ~/.bashrc에 추가
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_xxxxxxxxxxxx"

# 방법 2: .claude/settings.local.json 생성
cat > .claude/settings.local.json << 'EOF'
{
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxx"
  }
}
EOF
```

#### 1.5.3 토큰 검증

```bash
# GitHub 토큰 검증
gh auth status
# 또는
curl -H "Authorization: token $GITHUB_PERSONAL_ACCESS_TOKEN" \
  https://api.github.com/user --silent | jq '.login'
```

**검증 결과**:
| 결과 | 상태 | 안내 |
|------|------|------|
| 로그인 ID 출력 | ✅ 정상 | 다음 단계 진행 |
| `null` 또는 에러 | ❌ 실패 | 토큰 재생성 안내 |

### Phase 2: 조직 참여 확인

```markdown
[SEMO] Onboarding: Phase 2 - 조직 참여 확인
```

#### 2.1 GitHub Organization 확인 (자동)

```bash
# GitHub Organization 멤버십 확인
gh api user/memberships/orgs/semicolon-devteam --jq '.state' 2>/dev/null
```

| 결과 | 상태 | 안내 |
|------|------|------|
| `active` | ✅ 참여 완료 | 다음 단계 진행 |
| `pending` | ⏳ 초대 대기 | 이메일 확인 요청 |
| 에러 | ❌ 미참여 | 팀 리더에게 초대 요청 안내 |

#### 2.2 Slack 워크스페이스 확인 (자동)

```bash
# Slack CLI 인증 상태 확인
slack auth list 2>/dev/null | grep -i semicolon
```

**Slack CLI 미설치 시**:
```markdown
⚠️ Slack CLI가 설치되어 있지 않습니다.

Slack 워크스페이스(Semicolon)에 참여하셨나요? (y/n)
```

**필수 채널 안내**:
- `#_공지`: 전사 공지사항
- `#_일반`: 일상 소통
- `#_협업`: 협업 관련 논의
- `#개발사업팀`: 개발팀 전체 채널

### Phase 3: SEMO 개념 학습

```markdown
[SEMO] Onboarding: Phase 3 - SEMO 개념 학습
```

#### 3.1 SEMO 4대 원칙

| 원칙 | 설명 |
|------|------|
| **Transparency** | 모든 AI 작업이 `[SEMO] ...` 메시지로 명시적 표시 |
| **Orchestrator-First** | 모든 요청은 Orchestrator가 먼저 분석 |
| **Modularity** | 기능별 패키지 독립 동작 |
| **Hierarchy** | semo-core → semo-skills → Extensions 상속 |

#### 3.2 SEMO 구조

```
.claude/
├── agents/       # 에이전트 (Task tool로 호출)
├── skills/       # 스킬 (Skill tool로 호출)
├── commands/     # 커맨드 (/SEMO:xxx)
└── memory/       # 세션 간 컨텍스트

semo-system/      # White Box (읽기 전용)
├── semo-core/    # Layer 0: 원칙, 오케스트레이션
├── semo-skills/  # Layer 1: 통합 스킬
└── {extensions}/ # Layer 2: 프로젝트별 확장
```

#### 3.3 주요 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/SEMO:help` | 도움말 |
| `/SEMO:health` | 환경 검증 |
| `/SEMO:onboarding` | 온보딩 (현재) |
| `/SEMO:slack` | Slack 메시지 전송 |
| `/SEMO:feedback` | 피드백 제출 |

### Phase 4: 실습

```markdown
[SEMO] Onboarding: Phase 4 - 실습
```

#### 4.1 SEMO 인터랙션 테스트

현재 프로젝트에서 간단한 요청을 해보세요:

```
"Button 컴포넌트 하나 만들어줘"
```

**확인사항**:
- `[SEMO] Orchestrator: ...` 메시지 출력 확인
- `[SEMO] Skill: ...` 메시지 출력 확인

### Phase 5: 참조 문서 안내

```markdown
[SEMO] Onboarding: Phase 5 - 참조 문서 안내
```

#### 핵심 문서

| 문서 | 위치 |
|------|------|
| SEMO 원칙 | `semo-system/semo-core/principles/PRINCIPLES.md` |
| 메시지 규칙 | `semo-system/semo-core/principles/MESSAGE_RULES.md` |
| 프로젝트 설정 | `.claude/CLAUDE.md` |

#### 팀 문서

- [Team Codex](https://github.com/semicolon-devteam/docs/wiki/Team-Codex)
- [Development Philosophy](https://github.com/semicolon-devteam/docs/wiki/Development-Philosophy)

### Phase 6: 온보딩 완료

```markdown
[SEMO] Onboarding: 완료

=== 온보딩 완료 ===

✅ 환경 검증 통과
✅ 프로젝트 설정 동기화 (.gitignore)
✅ 토큰 설정 완료 (팀 공용 + 개인)
✅ 조직 참여 확인
✅ SEMO 개념 학습 완료
✅ 실습 완료

**다음 단계**:
1. 팀 리더에게 업무 할당 요청
2. 이슈 할당 받으면 자연어로 요청
3. SEMO가 자동으로 다음 단계를 안내합니다

**도움말**:
- /SEMO:help - 전체 도움말
- /SEMO:health - 환경 재검증
- /SEMO:feedback - 피드백 제출
```

## Output Format

각 Phase 시작 시:
```markdown
[SEMO] Onboarding: Phase {N} - {단계명}
```

Phase 완료 시:
```markdown
✅ Phase {N} 완료. Phase {N+1}을 진행합니다.
```

## Error Handling

### GitHub 미참여

```markdown
❌ GitHub Organization 미참여

semicolon-devteam Organization에 참여하지 않았습니다.

**해결 방법**:
1. 팀 리더에게 GitHub 초대 요청
2. 초대 이메일 확인 후 수락
3. `/SEMO:onboarding` 재실행
```

### Slack 미참여

```markdown
⚠️ Slack 워크스페이스 확인 필요

Slack CLI로 확인할 수 없습니다.

**해결 방법**:
1. Semicolon Slack 워크스페이스 초대 요청
2. 필수 채널 참여 확인
3. `/SEMO:onboarding` 재실행
```

## References

- [SEMO Principles](../../principles/PRINCIPLES.md)
- [/SEMO:health](./health.md)
- [Team Members](../../_shared/team-members.md)
