# Error Handling

> migration-master Agent의 에러 처리 및 참조 소스

## Common Issues

### Import Error After Migration

```markdown
❌ **Import 에러 발생**

Module not found: Can't resolve '@/repositories/post.repository'

**해결 방법**:
1. 새 경로 확인: `src/app/posts/_repositories/posts.repository.ts`
2. Import 경로 수정: `import { PostsRepository } from '@/app/posts/_repositories'`
```

### TypeScript Error

```markdown
❌ **TypeScript 에러 발생**

**해결 방법**:
1. `npx tsc --noEmit` 실행하여 에러 목록 확인
2. 에러별 수정 진행
3. 재검증
```

### ESLint Error

```markdown
❌ **ESLint 에러 발생**

**해결 방법**:
1. `npm run lint` 실행하여 에러 확인
2. 자동 수정 시도: `npm run lint -- --fix`
3. 수동 수정 필요 항목 처리
```

### Supabase RPC Error

```markdown
❌ **RPC 함수 호출 에러**

**확인사항**:
1. RPC 파라미터 prefix (`p_`) 확인
2. core-supabase 함수명 일치 확인
3. 타입 assertion 패턴 적용 확인
```

## Reference Sources

### cm-template (Primary Reference)

```bash
# cm-template 구조 참조
gh api repos/semicolon-devteam/cm-template/contents/src --jq '.[].name'

# CLAUDE.md 참조
gh api repos/semicolon-devteam/cm-template/contents/CLAUDE.md --jq '.content' | base64 -d

# templates/ 폴더 참조
gh api repos/semicolon-devteam/cm-template/contents/templates --jq '.[].name'

# .claude/ 디렉토리 참조
gh api repos/semicolon-devteam/cm-template/contents/.claude
```

### docs Wiki (Team Standards)

- **Team Codex**: https://github.com/semicolon-devteam/docs/wiki/Team-Codex
- **Development Philosophy**: https://github.com/semicolon-devteam/docs/wiki/Development-Philosophy
- **Collaboration Process**: https://github.com/semicolon-devteam/docs/wiki/Collaboration-Process

### Local Documentation

- `.claude/` - Agent/Skill 정의
- `CLAUDE.md` - 프로젝트 가이드
- `.specify/memory/constitution.md` - Constitution

## Performance Considerations

- **대규모 프로젝트**: 도메인별로 나누어 진행 권장
- **CI/CD 영향**: 마이그레이션 중 CI/CD 일시 중지 고려
- **팀 협업**: 팀원들에게 마이그레이션 진행 공유

## Rollback Strategy

마이그레이션 실패 시:

```bash
# 1. 백업에서 복원
cp .migration-backup/CLAUDE.md.bak CLAUDE.md
cp .migration-backup/README.md.bak README.md

# 2. Git으로 복원 (브랜치 사용 시)
git checkout main

# 3. 또는 변경사항 취소
git checkout -- .
```
