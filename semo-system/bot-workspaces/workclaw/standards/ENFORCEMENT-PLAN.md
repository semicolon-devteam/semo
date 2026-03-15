# AI Readability 강제 적용 계획 (전체 프로젝트)

> 모든 Semicolon 활성 프로젝트에 4단계 방어선 적용

---

## 📋 대상 프로젝트 목록

| 프로젝트 | 기술 스택 | 적용 표준 | 레포 |
|---------|----------|---------|------|
| **proj-play-land** | Next.js 14 | Core + React | `semicolon-devteam/proj-play-land` |
| **core-backend** | Spring Boot | Core + Node* | `semicolon-devteam/core-backend` |
| **PS (Mobile)** | React Native | Core + RN | `semicolon-devteam/ps-mobile` |
| **cm-jungchipan** | Next.js 14 | Core + React | `semicolon-devteam/cm-jungchipan` |
| **proj-star-spot** | Next.js 16 | Core + React | `semicolon-devteam/proj-star-spot` |

*Spring Boot는 Node.js 규칙 대신 별도 Java 규칙 필요 (추후 작성)

---

## 🎯 프로젝트별 적용 체크리스트

### 1. proj-play-land (Next.js 14)

**레포**: `semicolon-devteam/proj-play-land`
**브랜치**: `dev` (기본), `main` (프로덕션)
**로컬 경로**: `/Users/reus/Desktop/Sources/semicolon/projects/land/proj-play-land`

#### 레이어 1: 로컬 (ESLint + Pre-commit)
- [ ] `.eslintrc.json` 추가 (Core + React 규칙)
- [ ] `.vscode/settings.json` 추가 (자동 수정)
- [ ] `package.json` Husky + lint-staged 설정
- [ ] `.husky/pre-commit` 훅 추가
- [ ] `tsconfig.json` strict 모드 확인

#### 레이어 2: CI/CD (GitHub Actions)
- [ ] `.github/workflows/ai-readability-check.yml` 추가
- [ ] `scripts/analyze-violations.js` 추가
- [ ] Branch protection rule 설정 (PR 필수)

#### 레이어 3: Code Review
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` 업데이트
- [ ] ReviewClaw 프롬프트에 체크리스트 추가

#### 레이어 4: 모니터링
- [ ] `.github/workflows/weekly-report.yml` 추가
- [ ] Slack 알림 설정

---

### 2. core-backend (Spring Boot)

**레포**: `semicolon-devteam/core-backend`
**브랜치**: `feat-play-idol` (개발), `dev`, `main`
**로컬 경로**: `/Users/reus/Desktop/Sources/semicolon/projects/land/core-backend`

**⚠️ 주의**: Spring Boot는 TypeScript 대신 Java 사용 → 별도 규칙 필요

#### 레이어 1: 로컬 (Checkstyle + Pre-commit)
- [ ] `checkstyle.xml` 추가 (Java 코드 스타일)
- [ ] Maven/Gradle 플러그인 설정
- [ ] Pre-commit hook (Java 파일 검증)

**Checkstyle 규칙** (Java 버전):
```xml
<module name="FileLength">
  <property name="max" value="600"/>
</module>
<module name="MethodLength">
  <property name="max" value="100"/>
</module>
<module name="CyclomaticComplexity">
  <property name="max" value="15"/>
</module>
<module name="ParameterNumber">
  <property name="max" value="4"/>
</module>
```

#### 레이어 2: CI/CD
- [ ] `.github/workflows/checkstyle.yml` 추가
- [ ] SonarQube 통합 (Code Health 측정)

#### 레이어 3: Code Review
- [ ] PR 템플릿 (Java 특화)

#### 레이어 4: 모니터링
- [ ] 주간 리포트 (Java 파일 크기/복잡도)

---

### 3. PS (Mobile - React Native)

**레포**: `semicolon-devteam/ps-mobile`
**브랜치**: `main`

**⚠️ 주의**: 이미 AI Readability 표준이 있음 (PS 원본)

#### 레이어 1: 로컬
- [ ] 기존 `.eslintrc.json` 확인 및 업데이트
- [ ] Pre-commit hook 확인
- [ ] **기존 위반 파일 목록 생성** (VideoCallScreen 2100줄 등)

#### 레이어 2: CI/CD
- [ ] GitHub Actions 확인
- [ ] 기존 파일 예외 처리 (Phase 1 전략)

#### 레이어 3: Code Review
- [ ] ReviewClaw 체크리스트 확인

#### 레이어 4: 모니터링
- [ ] 주간 리포트 확인
- [ ] 리팩토링 백로그 자동 생성

**기존 파일 예외 처리** (점진적 마이그레이션):
```json
{
  "overrides": [
    {
      "files": ["src/**/*.{ts,tsx}"],
      "excludedFiles": [
        "src/features/call/screens/VideoCallScreen.tsx",
        "src/features/club/screens/ClubDashboardScreen.tsx",
        "src/features/club/screens/ClubHouseScreen.tsx",
        "src/features/gamification/screens/LeagueScreen.tsx"
      ],
      "rules": {
        "max-lines": ["error", { "max": 600 }]
      }
    }
  ]
}
```

---

### 4. cm-jungchipan (Next.js 14)

**레포**: `semicolon-devteam/cm-jungchipan`
**브랜치**: `main`, `dev`
**로컬 경로**: `/Users/reus/Desktop/Sources/semicolon/projects/jungchipan`

#### 레이어 1: 로컬
- [ ] `.eslintrc.json` 추가 (Core + React)
- [ ] `.vscode/settings.json` 추가
- [ ] Husky + lint-staged 설정

#### 레이어 2: CI/CD
- [ ] GitHub Actions 추가
- [ ] Vercel 배포 트리거 확인

#### 레이어 3: Code Review
- [ ] PR 템플릿 추가

#### 레이어 4: 모니터링
- [ ] 주간 리포트 설정

---

### 5. proj-star-spot (Next.js 16)

**레포**: `semicolon-devteam/proj-star-spot`
**브랜치**: `main`, `feat/*`
**로컬 경로**: `/Users/reus/Desktop/Sources/semicolon/projects/star-spot`

#### 레이어 1: 로컬
- [ ] `.eslintrc.json` 추가 (Core + React)
- [ ] `.vscode/settings.json` 추가
- [ ] Husky + lint-staged 설정

#### 레이어 2: CI/CD
- [ ] GitHub Actions 추가
- [ ] Supabase 연동 확인

#### 레이어 3: Code Review
- [ ] PR 템플릿 추가

#### 레이어 4: 모니터링
- [ ] 주간 리포트 설정

---

## 🚀 단계별 실행 계획

### Week 1: 설정 파일 준비 (모든 프로젝트)

**Day 1-2: Next.js 프로젝트 (proj-play-land, cm-jungchipan, proj-star-spot)**
```bash
# 각 프로젝트 루트에서
cp ~/workspace/standards/.eslintrc.react.json .eslintrc.json
cp ~/workspace/standards/.vscode-settings.json .vscode/settings.json

# package.json 업데이트
npm install --save-dev husky lint-staged eslint-plugin-import

# Husky 초기화
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

**Day 3-4: React Native (PS)**
```bash
# PS 프로젝트 루트에서
# 기존 설정 백업
cp .eslintrc.json .eslintrc.json.backup

# 새 규칙 적용
cp ~/workspace/standards/.eslintrc.rn.json .eslintrc.json

# 기존 위반 파일 스캔
node ~/workspace/standards/scripts/scan-violations.js
```

**Day 5: Spring Boot (core-backend)**
```bash
# Checkstyle 설정
cp ~/workspace/standards/checkstyle.xml .

# Maven pom.xml 업데이트
# <plugin>
#   <groupId>org.apache.maven.plugins</groupId>
#   <artifactId>maven-checkstyle-plugin</artifactId>
# </plugin>
```

---

### Week 2: GitHub Actions 설정

**모든 레포에 추가**:
```bash
# GitHub Actions 워크플로우 추가
mkdir -p .github/workflows
cp ~/workspace/standards/.github/workflows/ai-readability-check.yml .github/workflows/

# Scripts 디렉토리 생성
mkdir -p scripts
cp ~/workspace/standards/scripts/analyze-violations.js scripts/
```

**Branch Protection Rule 설정** (GitHub UI):
```
Settings → Branches → Add rule
- Branch name pattern: main, dev
- ✅ Require status checks to pass before merging
  - ✅ AI Readability Check
- ✅ Require pull request reviews before merging (1 approval)
```

---

### Week 3: PR 템플릿 & ReviewClaw 업데이트

**PR 템플릿**:
```bash
# 각 레포에서
mkdir -p .github
cp ~/workspace/standards/.github/PULL_REQUEST_TEMPLATE.md .github/
```

**ReviewClaw 프롬프트 업데이트**:
- ReviewClaw AGENTS.md에 AI Readability 체크리스트 추가
- 자동 검증 스크립트 추가

---

### Week 4: 모니터링 & 대시보드

**주간 리포트**:
```bash
# 각 레포에서
cp ~/workspace/standards/.github/workflows/weekly-report.yml .github/workflows/
cp ~/workspace/standards/scripts/generate-weekly-report.js scripts/
```

**Slack 알림 설정**:
- Slack Webhook URL 등록 (각 프로젝트별 채널)
- GitHub Secrets에 `SLACK_WEBHOOK_URL` 추가

---

## 📊 진행 상황 추적

### 프로젝트별 완료 현황

| 프로젝트 | ESLint | Pre-commit | CI | PR 템플릿 | 모니터링 | 완료율 |
|---------|--------|-----------|----|-----------| ---------|-------|
| proj-play-land | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 0% |
| core-backend | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 0% |
| PS (Mobile) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 0% |
| cm-jungchipan | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 0% |
| proj-star-spot | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 0% |

**범례**: ⬜ 미완료 | 🟡 진행 중 | ✅ 완료

---

## 🔍 검증 체크리스트 (각 프로젝트)

### 로컬 테스트
```bash
# ESLint 실행
npm run lint

# Pre-commit hook 테스트
git add .
git commit -m "test: pre-commit hook"

# TypeScript 타입 체크
npm run type-check
```

### CI 테스트
```bash
# 테스트 PR 생성
git checkout -b test/ai-readability-check
# 의도적으로 규칙 위반 커밋
echo "const longFunction = () => { /* 100줄+ */ }" > test.ts
git add test.ts
git commit -m "test: CI check"
git push origin test/ai-readability-check

# PR 생성 → CI 실패 확인
# GitHub UI에서 확인
```

### ReviewClaw 테스트
```bash
# PR에 Context Headers 누락
# ReviewClaw이 변경 요청하는지 확인
```

---

## 🚨 긴급 대응 계획

### ESLint 오탐 발생 시
```bash
# 특정 파일 예외 처리
# .eslintrc.json
{
  "overrides": [
    {
      "files": ["특정파일.tsx"],
      "rules": {
        "max-lines": "off"
      }
    }
  ]
}
```

### CI 실패로 배포 지연 시
```bash
# 임시 우회 (긴급 핫픽스만)
git commit -m "hotfix: urgent fix" --no-verify

# 사후 이슈 생성 필수
gh issue create --title "[Tech Debt] AI Readability 위반 수정" \
  --label "tech-debt,ai-readability"
```

---

## 📝 다음 단계

### Phase 1 완료 후 (신규 파일 강제)
- 기존 파일은 warning
- 신규 파일은 error

### Phase 2 (1개월 후)
- 기존 파일도 warning → error 전환
- 리팩토링 백로그 자동 생성

### Phase 3 (3개월 후)
- 모든 파일 error
- Code Health 9.5+ 달성

---

## 🎯 성공 지표

### 단기 목표 (1개월)
- [ ] 모든 프로젝트에 4단계 방어선 구축
- [ ] 신규 파일 600줄 이하 100% 준수
- [ ] TODO/FIXME 주석 0건

### 중기 목표 (3개월)
- [ ] 기존 대형 파일 50% 리팩토링
- [ ] 평균 파일 크기 400줄 이하
- [ ] 평균 복잡도 10 이하

### 장기 목표 (6개월)
- [ ] 모든 파일 600줄 이하
- [ ] Code Health 9.5+ 달성
- [ ] AI 코딩 생산성 2배 향상
