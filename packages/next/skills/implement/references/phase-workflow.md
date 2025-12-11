# Phase Workflow Reference

## ADD Phase 4 상세 워크플로우

### v0.0.x - CONFIG

- Check dependencies from plan.md
- Install required packages
- Suggest `skill:spike` if technical approach unclear
- Request agent approval to proceed

### v0.1.x - PROJECT

- Scaffold DDD 4-layer structure
- Create domain directories with `__tests__/`
- Set up `index.ts` exports
- Request agent approval to proceed

### v0.2.x - TESTS (TDD - Critical Phase)

- Write Repository tests (mock Supabase)
- Write Hook tests (mock API clients)
- Write Component tests (mock hooks)
- Tests FAIL initially (no implementation yet)
- Request agent approval to proceed

### v0.3.x - DATA

- Create type definitions in `models/`
- Verify Supabase schema in core-supabase
- Generate database types
- Request agent approval to proceed

### v0.4.x - CODE

- Implement Repository (invoke `skill:fetch-supabase-example`)
- Implement API Client (Factory Pattern)
- Implement Hooks (React Query)
- Implement Components (6 standard components)
- Tests START PASSING
- Run quality checks (invoke `skill:check-team-codex`)

### Report Completion

- Test results (should be 100% passing)
- Code quality status
- Constitution compliance
- Next steps

## Phase Gate Control

At each phase boundary, skill requests agent approval:

```
✅ Phase v0.1.x Complete: PROJECT

Created Structure:
app/posts/
├── _repositories/__tests__/ ✅
├── _api-clients/            ✅
├── _hooks/__tests__/        ✅
└── _components/__tests__/   ✅

Ready for v0.2.x (TESTS):
- Write tests BEFORE implementation
- Test-Driven Development approach

⚠️ CRITICAL: Next phase writes tests first.
Constitution Principle III requires tests before code.

Agent: Approve proceeding to v0.2.x? (yes/no)
```

## Output Format

```
✅ Implementation Complete: [Feature Name]

**Phase Results**:
- v0.0.x CONFIG: ✅ Dependencies installed
- v0.1.x PROJECT: ✅ DDD structure scaffolded
- v0.2.x TESTS: ✅ 15 tests written
- v0.3.x DATA: ✅ Models and types defined
- v0.4.x CODE: ✅ All 4 layers implemented

**Test Results**:
- Repository: 5/5 passing ✅
- Hooks: 6/6 passing ✅
- Components: 4/4 passing ✅
- Total: 15/15 tests (100%)

**Code Quality**:
- ESLint: ✅ Passed
- TypeScript: ✅ Passed

**Constitution Compliance**:
- DDD Architecture (I): ✅
- SSR-First (II): ✅
- Test-Driven Quality (III): ✅
- Spec-Driven Development (VIII): ✅

**Branch**: feature/posts-comments
**Location**: app/posts/

Next Steps:
- skill:verify for comprehensive check
- Review against spec.md
- Create PR when ready
```
