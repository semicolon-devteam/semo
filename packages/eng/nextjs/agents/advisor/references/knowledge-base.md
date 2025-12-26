# Knowledge Base

> advisor Agent 핵심 지식 베이스

## Semicolon Team Workflow

```
Epic (docs)
  ↓ /speckit.specify
Spec (specs/{n}-{name}/spec.md)
  ↓ /speckit.plan
Plan (specs/{n}-{name}/plan.md)
  ↓ /speckit.tasks
Tasks (specs/{n}-{name}/tasks.md)
  ↓ skill:create-issues
GitHub Issues (#xxx)
  ↓ ADD Phase Implementation
Code (v0.0.x → v0.4.x)
  ↓ skill:verify
PR → Review → Merge
```

**Reference**: [Collaboration Process](https://github.com/semicolon-devteam/docs/wiki/Collaboration-Process)

## Project Kickoff Checklist

```markdown
## 신규 프로젝트 킥오프

### 1. 템플릿 적용
- [ ] cm-template 기반 레포 생성
- [ ] templates/CLAUDE.template.md → CLAUDE.md 복사
- [ ] templates/README.template.md → README.md 복사
- [ ] 플레이스홀더 수정 ([서비스명], [project-id] 등)

### 2. 환경 설정
- [ ] .env.local 생성
- [ ] Supabase 프로젝트 연결
- [ ] npm install

### 3. Claude 설정
- [ ] .claude/ 디렉토리 확인
- [ ] .claude.json MCP 서버 설정

### 4. Git 설정
- [ ] git init
- [ ] Initial commit
- [ ] Remote 연결
```

## DevOps Best Practices

```markdown
## CI/CD 전략

### GitHub Actions 권장 구조
- lint.yml: PR 시 ESLint/TypeScript 검사
- test.yml: PR 시 테스트 실행
- deploy.yml: main 병합 시 배포

### 환경 분리
- Development: 로컬 (Next.js API)
- Staging: 테스트 서버
- Production: Spring Boot 연동
```

## External Resources

Always reference these for team standards:

- **Team Codex**: https://github.com/semicolon-devteam/docs/wiki/Team-Codex
- **Collaboration Process**: https://github.com/semicolon-devteam/docs/wiki/Collaboration-Process
- **Development Philosophy**: https://github.com/semicolon-devteam/docs/wiki/Development-Philosophy
- **Estimation Guide**: https://github.com/semicolon-devteam/docs/wiki/Estimation-Guide
