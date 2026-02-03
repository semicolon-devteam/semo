# Analysis Workflow

레퍼런스 링크에서 프로젝트 정보를 추출하는 워크플로우.

## 1. GitHub 저장소 분석

### 기술스택 추출

```bash
# 파일별 분석 대상
package.json          → dependencies, devDependencies
build.gradle.kts      → plugins, dependencies
go.mod                → module, require
requirements.txt      → Python packages
Cargo.toml            → Rust dependencies
```

### GitHub MCP 활용

```
mcp__github__get_file_contents
├── owner: {repo-owner}
├── repo: {repo-name}
├── path: package.json
└── branch: main
```

### 디렉토리 구조 분석

```
주요 패턴:
- src/app/          → Next.js App Router
- src/pages/        → Next.js Pages Router
- src/components/   → React Components
- src/domain/       → DDD 구조
- src/main/kotlin/  → Spring Boot
```

## 2. 서비스 URL 분석

### WebFetch 활용

```
WebFetch
├── url: {service-url}
└── prompt: "이 페이지의 주요 기능, UI 구성요소,
             사용된 기술을 분석해주세요"
```

### 추출 정보

- 메인 페이지 구성
- 네비게이션 구조
- 주요 기능 목록
- UI/UX 특징

## 3. 문서 URL 분석

### Notion 페이지

```
WebFetch로 공개 페이지 분석:
- 프로젝트 개요
- 요구사항 정의
- 기능 명세
- 일정 계획
```

### 접근 불가 시

```markdown
**사용자에게 요청할 정보:**
1. 프로젝트 배경 및 목적
2. 주요 기능 목록
3. 본인 역할 및 기여도
4. 기술적 도전과 해결 방법
```

## 4. 기술스택 분류 기준

| Category | 포함 항목 |
|----------|----------|
| **Frontend** | React, Next.js, Vue, Angular, Svelte |
| **Backend** | Spring, Express, FastAPI, Go, Nest.js |
| **Database** | PostgreSQL, MySQL, MongoDB, Redis |
| **Infrastructure** | AWS, GCP, Docker, K8s, Vercel |
| **DevOps** | GitHub Actions, Jenkins, ArgoCD |
| **Testing** | Jest, Playwright, JUnit, Cypress |
