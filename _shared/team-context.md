# 세미콜론 팀 컨텍스트 가이드

> SAX 패키지 전반에 걸친 세미콜론 팀 조직 구조, 협업 프로세스, 커뮤니케이션 채널 안내

## 목적

- 신규 팀원의 빠른 온보딩 지원
- 팀 전체 컨텍스트 일관성 유지
- 협업 프로세스 표준화
- 조직 구조 및 역할 명확화

---

## 조직 구조

### GitHub Organization

**Organization**: [semicolon-devteam](https://github.com/semicolon-devteam)

**팀 구조**:

| 팀 | 역할 | 권한 |
|-----|------|------|
| Owners | 조직 관리자 | Admin (전체) |
| Managers | 프로젝트 관리자, PO | Write (대부분 레포) |
| Developers | 개발자 | Write (할당된 레포) |
| Designers | 디자이너 | Write (디자인 관련 레포) |
| QA | QA/테스터 | Write (테스트 관련 레포) |

**멤버십 확인**:
```bash
gh api user/orgs --jq '.[].login' | grep semicolon-devteam
```

---

## Slack 워크스페이스

### 필수 채널

| 채널 | 용도 | 참여 대상 |
|------|------|----------|
| **#_공지** | 전체 공지사항 | 전체 |
| **#_일반** | 일상 대화, 잡담 | 전체 |
| **#_협업** | 업무 협업, 이슈 논의 | 전체 |
| **#개발사업팀** | 개발팀 전용 채널 | 개발자 |
| **#디자인팀** | 디자인팀 전용 채널 | 디자이너 |

### SAX 시스템 연동

SAX 패키지는 Slack과 자동 연동됩니다:

- **버저닝 알림**: `#_협업` 채널에 버전 업데이트 자동 공유
- **커밋 알림**: PR 생성/머지 시 자동 알림
- **이슈 알림**: 중요 이슈 생성 시 자동 공유

**Skill 사용**:
```bash
# Slack 메시지 전송 (notify-slack Skill)
/SAX:slack
```

---

## GitHub 레포지토리 구조

### 핵심 레포지토리

| 레포 | 용도 | 접근 권한 |
|------|------|----------|
| **docs** | 문서, 기획, Epic 관리 | 전체 읽기, Managers 쓰기 |
| **sax-core** | SAX 공통 컴포넌트 | 전체 읽기, Owners 쓰기 |
| **sax-meta** | SAX 메타 패키지 | 전체 읽기, Owners 쓰기 |
| **sax-next** | 프론트엔드 개발용 SAX | Developers |
| **sax-po** | PO/기획자용 SAX | Managers |
| **sax-design** | 디자이너용 SAX | Designers |
| **sax-qa** | QA/테스터용 SAX | QA |
| **sax-backend** | 백엔드 개발용 SAX | Developers |
| **sax-pm** | PM용 SAX | Managers |
| **sax-infra** | 인프라 엔지니어용 SAX | Developers |
| **sax-ms** | MSA 개발용 SAX | Developers |

### 프로젝트 레포지토리

| 레포 | 프로젝트 | 기술 스택 |
|------|---------|----------|
| **core-interface** | API 문서 사이트 | Next.js, TypeScript |
| **core-backend** | 백엔드 API | Node.js, Express |
| **core-supabase** | Supabase 설정 | PostgreSQL, Supabase |
| **cm-template** | 커뮤니티 템플릿 | Next.js, TypeScript |

---

## 협업 프로세스

### Epic → Task 워크플로우

```text
1. Epic 생성 (PO)
   ↓
2. Spec 초안 작성 (PO, 선택)
   ↓
3. 개발팀 전달 및 Spec 보완 (개발자)
   ↓
4. Task 동기화 (개발자 → GitHub Issues)
   ↓
5. 이슈 할당 및 작업 시작 (개발자)
   ↓
6. Draft PR 생성 (개발자)
   ↓
7. 코드 리뷰 (팀)
   ↓
8. PR 머지 및 배포 (개발자/인프라)
```

### 브랜치 전략

**메인 브랜치**: `main`

**작업 브랜치 네이밍**:
- Feature: `feature/#{issue_number}-{short-description}`
- Bugfix: `fix/#{issue_number}-{short-description}`
- Hotfix: `hotfix/#{issue_number}-{short-description}`

**예시**:
```
feature/#123-user-authentication
fix/#456-login-error
```

### 커밋 메시지 규칙

**포맷**: `{type}({scope}): {subject}`

**Type**:
- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 포맷팅 (기능 변경 없음)
- `refactor`: 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드/설정 변경

**예시**:
```
feat(auth): Add JWT authentication
fix(login): Resolve password validation bug
docs(readme): Update installation guide
```

### Pull Request 규칙

**PR 제목**: `[#{issue_number}] {작업 내용}`

**PR 본문 필수 항목**:
```markdown
## Summary
- 작업 내용 요약 (1-3문장)

## Changes
- 변경 사항 목록

## Test Plan
- 테스트 방법 및 결과

## Related Issues
- Closes #{issue_number}
```

---

## 역할별 워크플로우

### PO/기획자 (sax-po)

1. **Epic 생성**: "댓글 기능 Epic 만들어줘"
2. **Spec 초안 작성** (선택): "Spec 초안 작성해줘"
3. **개발팀 전달**: 개발자가 `/speckit.specify` 실행
4. **Task 동기화**: `sync-tasks` Skill
5. **진행도 추적**: GitHub Projects

### 개발자 (sax-next, sax-backend, sax-ms)

1. **이슈 할당 확인**: "현재 업무 확인"
2. **브랜치 생성**: `feature/#123-{description}`
3. **Draft PR 생성**: 작업 시작 시점
4. **코드 작성 및 커밋**: SAX Agent 활용
5. **PR 완성 및 리뷰 요청**: 작업 완료 시
6. **머지 및 배포**: 리뷰 승인 후

### 디자이너 (sax-design)

1. **목업 생성**: "로그인 화면 목업 만들어줘"
2. **핸드오프 문서 작성**: "개발팀에 전달할 문서 만들어줘"
3. **Figma 연동** (선택): Framelink MCP
4. **개발팀 피드백**: Slack `#_협업` 채널

### QA/테스터 (sax-qa)

1. **테스트 대기 목록 확인**: "현재 업무 확인"
2. **테스트 케이스 검증**: `validate-test-cases` Skill
3. **테스트 실행**: `/SAX:run-test`
4. **테스트 결과 보고**: `/SAX:test-pass` or `/SAX:test-fail`
5. **버그 리포트 작성**: `report-bug` Skill

### PM (sax-pm)

1. **Sprint 계획**: `create-sprint` Skill
2. **Epic/Task 할당**: `assign-task` Skill
3. **진행도 추적**: `/SAX:progress`
4. **장애물 감지**: `detect-blockers` Skill
5. **보고서 생성**: `/SAX:report`
6. **Sprint 종료**: `close-sprint` Skill

### 인프라 엔지니어 (sax-infra)

1. **Docker Compose 설정**: `scaffold-compose` Skill
2. **Nginx 설정**: `scaffold-nginx` Skill
3. **환경 변수 동기화**: `sync-env` Skill
4. **서비스 배포**: `/SAX:deploy`
5. **모니터링**: 서비스 상태 확인
6. **롤백** (필요 시): `/SAX:rollback`

---

## 외부 서비스

### Supabase

**프로젝트**: cointalk (코인톡)
- **URL**: `https://wloqfachtbxceqikzosi.supabase.co`
- **레포**: `core-supabase`

**접근 권한**:
- Developers: 읽기/쓰기
- PO: 읽기 전용

### API 문서 사이트

**URL**: `https://core-interface-ashen.vercel.app`
**레포**: `core-interface`

**용도**:
- API 엔드포인트 문서
- 타입 정의 참조
- 예제 코드

---

## GitHub Projects 사용

### PM 필수 권한

PM은 GitHub Projects 접근을 위해 **project scope** 권한이 필요합니다:

```bash
# GitHub CLI project scope 추가
gh auth refresh -s project

# 권한 확인
gh auth status 2>&1 | grep -q 'project' && echo "✅ project 스코프 있음"
```

### Projects 구조

**필드**:
- **Status**: Todo, In Progress, In Review, Done
- **Priority**: High, Medium, Low
- **Assignee**: 담당자
- **Epic**: 연결된 Epic 이슈

---

## 기술 스택

### 공통

- **언어**: TypeScript, JavaScript
- **패키지 매니저**: pnpm
- **버전 관리**: Git, GitHub
- **CI/CD**: GitHub Actions

### 프론트엔드

- **프레임워크**: Next.js 14+
- **스타일링**: Tailwind CSS
- **상태 관리**: Redux Toolkit
- **테스팅**: Vitest, Playwright

### 백엔드

- **런타임**: Node.js v18+
- **프레임워크**: Express
- **데이터베이스**: PostgreSQL (Supabase)
- **ORM**: Prisma

### 인프라

- **컨테이너**: Docker, Docker Compose
- **웹 서버**: Nginx
- **배포**: Vercel, Railway
- **모니터링**: (TBD)

---

## SAX 패키지 설치

### 신규 팀원 온보딩

1. **SAX 패키지 설치**:
   ```bash
   # 역할에 맞는 패키지 선택
   bash <(curl -fsSL https://raw.githubusercontent.com/semicolon-devteam/sax-meta/main/scripts/install-sax.sh)
   ```

2. **온보딩 프로세스 시작**:
   ```bash
   /SAX:onboarding
   ```

3. **환경 검증**:
   ```bash
   /SAX:health-check
   ```

### 패키지별 대상

| 패키지 | 대상 |
|--------|------|
| sax-next | 프론트엔드/풀스택 개발자 |
| sax-po | PO/기획자 |
| sax-design | 디자이너 |
| sax-qa | QA/테스터 |
| sax-backend | 백엔드 개발자 |
| sax-pm | PM (Project Manager) |
| sax-infra | 인프라 엔지니어 |
| sax-ms | MSA 개발자 |

---

## 커뮤니케이션 가이드

### 이슈 생성 규칙

**제목**: `[{type}] {간결한 설명}`

**Type**:
- `Feature`: 새 기능
- `Bug`: 버그 수정
- `Epic`: 큰 단위 작업
- `Task`: 작은 단위 작업
- `Question`: 질문/논의

**본문 필수 항목**:
```markdown
## Description
{상세 설명}

## Acceptance Criteria
- [ ] {조건 1}
- [ ] {조건 2}

## Related
- Epic: #{epic_number}
- Blocked by: #{issue_number}
```

### Slack 멘션 규칙

- **긴급 이슈**: `@channel` (전체 알림)
- **특정 팀**: `@developers`, `@designers`, `@qa`
- **개인**: `@username`

### 응답 시간 기준

| 우선순위 | 응답 시간 |
|---------|----------|
| 긴급 (Blocker) | 1시간 이내 |
| 높음 (High) | 4시간 이내 |
| 중간 (Medium) | 1일 이내 |
| 낮음 (Low) | 3일 이내 |

---

## 문제 해결

### 일반적인 이슈

#### 1. GitHub Organization 멤버십 없음

**증상**: `gh api user/orgs` 결과에 `semicolon-devteam` 없음

**해결**:
1. 팀 리더에게 초대 요청
2. GitHub 이메일에서 초대 수락
3. `gh auth refresh` 실행

#### 2. GitHub Projects 권한 없음 (PM)

**증상**: Projects 접근 시 403 에러

**해결**:
```bash
gh auth refresh -s project
```

#### 3. SAX 패키지 설치 실패

**증상**: `.claude/sax-*` 디렉토리 없음

**해결**:
```bash
# 재설치
bash <(curl -fsSL https://raw.githubusercontent.com/semicolon-devteam/sax-meta/main/scripts/install-sax.sh)

# 또는 수동 설치
cd .claude
git clone https://github.com/semicolon-devteam/sax-core
git clone https://github.com/semicolon-devteam/sax-{package}
```

#### 4. Slack 워크스페이스 초대 안받음

**증상**: Slack 채널 접근 불가

**해결**:
1. 팀 리더에게 초대 요청
2. 이메일에서 초대 수락
3. 필수 채널 참여: `#_공지`, `#_일반`, `#_협업`

---

## 참고 자료

### 공식 문서

- [SAX Core PRINCIPLES.md](https://github.com/semicolon-devteam/sax-core/blob/main/PRINCIPLES.md) - SAX 핵심 원칙
- [SAX Core MESSAGE_RULES.md](https://github.com/semicolon-devteam/sax-core/blob/main/MESSAGE_RULES.md) - 메시지 규칙
- [SAX Metadata Schema](https://github.com/semicolon-devteam/sax-core/blob/main/_shared/metadata-schema.md) - 메타데이터 표준

### 외부 링크

- [GitHub CLI 문서](https://cli.github.com/manual/)
- [Claude Code 문서](https://code.claude.com/docs)
- [Next.js 문서](https://nextjs.org/docs)
- [Supabase 문서](https://supabase.com/docs)

---

## 업데이트 이력

| 날짜 | 버전 | 변경 사항 |
|------|------|----------|
| 2025-12-09 | 1.0.0 | 초기 문서 생성 |

---

## 피드백

이 문서에 대한 피드백은 다음 방법으로 제출할 수 있습니다:

1. **GitHub 이슈**: [sax-core Issues](https://github.com/semicolon-devteam/sax-core/issues)
2. **Slack**: `#_협업` 채널
3. **SAX Skill**: `/SAX:feedback`
