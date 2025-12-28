---
name: implement
description: Execute ADD Phase 4 with phased development (v0.0.x → v0.4.x). Use when (1) specification docs are complete, (2) user requests feature implementation, (3) implementing DDD 4-layer with TDD and Supabase patterns.
tools: [Read, Write, Edit, Bash]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: implement 실행` 시스템 메시지를 첫 줄에 출력하세요.

# Implement Skill

@./../_shared/development-workflow.md
@./../_shared/ddd-patterns.md
@./../_shared/test-templates.md
@./../_shared/test-policy.md
@./../_shared/commit-guide.md

**Purpose**: Orchestrate Agent-Driven Development (ADD) Phase 4 implementation workflow

## When to Use

- Specification (spec.md, plan.md, tasks.md) is complete
- User requests feature implementation
- Code needs to follow DDD 4-layer architecture

## Phase Overview

| Phase | Name | Key Action |
|-------|------|------------|
| v0.0.x | CONFIG | Dependencies, spike if needed |
| v0.1.x | PROJECT | Scaffold DDD 4-layer structure |
| v0.2.x | TESTS | 테스트 작성 (유연한 TDD - 아래 참조) |
| v0.3.x | DATA | Models, types, Supabase schema |
| v0.4.x | CODE | Implement all 4 layers |

> 📖 **테스트 정책**: [_shared/test-policy.md](../_shared/test-policy.md) 참조

## Usage

```javascript
skill: implement();
skill: implement({ resume: "v0.3.x" }); // Resume from phase
```

## Critical Rules

1. **Phase Discipline**: NEVER skip phases without agent approval
2. **Flexible TDD**: 레이어/작업 유형에 따라 테스트 정책 적용 (아래 참조)
3. **Supabase Patterns**: ALWAYS invoke `skill:fetch-supabase-example`
4. **DDD Compliance**: All 4 layers MUST be implemented
5. **Atomic Commits**: 작업 단위 최소화하여 중간중간 커밋
6. **Icon Pack Standard**: 아이콘은 표준 팩 사용 (아래 참조)

---

## 🔄 Flexible TDD (테스트 정책 유연화)

> **"테스트는 품질 보장 도구이지, 개발 속도를 저하시키는 의무가 아니다"**

### 레이어별 테스트 필수 여부

| 레이어 | Unit Test | 필수 여부 | 커버리지 목표 |
|--------|-----------|----------|--------------|
| **Repository/API Client** | ✅ 필수 | 🔴 PR 차단 | 80% |
| **Hooks (비즈니스 로직)** | ✅ 필수 | 🔴 PR 차단 | 70% |
| **Components (로직 포함)** | ⚠️ 권장 | 🟡 경고 | 50% |
| **Components (순수 UI)** | 🔄 E2E 대체 | 🟢 선택 | - |

### v0.2.x Phase 진행 옵션

| 옵션 | 설명 | 적합한 경우 |
|------|------|------------|
| **A. TDD (테스트 먼저)** | v0.2.x → v0.3.x → v0.4.x | 복잡한 비즈니스 로직 |
| **B. 동시 작성** | v0.3.x + v0.4.x 중 테스트 작성 | 일반적인 기능 |
| **C. E2E 우선** | Unit Test 생략, E2E로 검증 | 순수 UI 변경 |

### Phase 시작 시 테스트 옵션 제시

```markdown
[SEMO] v0.2.x TESTS Phase 시작

**레이어 분석 결과**:
- Repository: ✅ Unit Test 필수
- Hooks: ✅ Unit Test 필수
- Components: 🔄 E2E 대체 가능 (순수 UI)

**테스트 진행 옵션**:
| 옵션 | 설명 |
|------|------|
| A | TDD - 테스트 먼저 작성 (권장) |
| B | 동시 작성 - 구현하면서 테스트 |
| C | E2E 우선 - UI는 E2E로 검증 |

**선택하세요**: A, B, 또는 C
```

### 테스트 생략 허용 조건

다음 조건을 **모두** 만족하면 특정 레이어의 Unit Test 생략 가능:

1. **순수 UI 컴포넌트** (로직 없음)
2. **기존 테스트 전체 통과**
3. **E2E 테스트로 동작 검증 완료**

### 생략 시 출력

```markdown
[SEMO] 테스트 정책: Unit Test 생략 (Components)

**사유**: 순수 UI 컴포넌트 (로직 없음)
**대체 검증**: E2E 테스트 ✅

⚠️ 추후 로직 추가 시 Unit Test 작성 권장
```

---

## 🔴 Icon Pack Standard (NON-NEGOTIABLE)

> **⚠️ SVG 인라인 작성 금지. 반드시 표준 아이콘 팩을 사용합니다.**

### 권장 아이콘 팩 (우선순위)

| 순위 | 패키지 | 설치 | 특징 |
|------|--------|------|------|
| 1 | **Lucide React** | `npm i lucide-react` | 트리쉐이킹 최적, 200+ 아이콘 |
| 2 | Heroicons | `npm i @heroicons/react` | Tailwind 공식, 24px/20px |
| 3 | React Icons | `npm i react-icons` | 멀티 팩 지원 (Feather, FA 등) |

### 기본: Lucide React

```tsx
// ✅ 올바른 사용
import { Search, Menu, X, ChevronDown } from 'lucide-react';

<Search className="w-5 h-5" />
<Menu className="w-6 h-6 text-gray-500" />
```

### 금지 패턴

```tsx
// ❌ SVG 인라인 작성 금지
<svg viewBox="0 0 24 24">
  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
</svg>

// ❌ 직접 path 작성 금지 (렌더링 버그 위험)
const Icon = () => <svg><path d="...복잡한 경로..."/></svg>;
```

### 프로젝트에 패키지 없을 시

```bash
# v0.0.x (CONFIG) 단계에서 설치
npm install lucide-react
```

### 아이콘 검색

- Lucide: https://lucide.dev/icons
- Heroicons: https://heroicons.com/
- React Icons: https://react-icons.github.io/react-icons/

## Dependencies

- `skill:fetch-supabase-example` - Fetch core-supabase patterns
- `skill:scaffold-domain` - Create DDD structure
- `skill:check-team-codex` - Validate code quality

## Related Skills

- `spec` - SDD Phase 1-3 specification
- `verify` - Phase 5 verification
- `spike` - Technical exploration
- `git-workflow` - 커밋/푸시/PR (구현 완료 후)

---

## 🔴 Post-Action: Phase별 커밋 및 완료 프롬프트 (NON-NEGOTIABLE)

> **⚠️ 각 Phase 완료 시 Atomic Commit을 수행하고, 전체 완료 시 커밋 프롬프트를 표시합니다.**

### Phase별 Atomic Commit

| Phase | 커밋 시점 | 커밋 메시지 예시 |
|-------|----------|-----------------|
| v0.0.x | CONFIG 완료 | `chore: add dependencies for {feature}` |
| v0.1.x | PROJECT 완료 | `feat: scaffold DDD structure for {feature}` |
| v0.2.x | TESTS 완료 | `test: add tests for {feature}` |
| v0.3.x | DATA 완료 | `feat: add models and types for {feature}` |
| v0.4.x | CODE 완료 | `feat: implement {feature}` |

### 전체 완료 시 출력

```markdown
[SEMO] Skill: implement → Phase 4 완료

✅ **구현 완료**: {feature_name}
📁 **변경 파일**: {file_count}개
🔍 **테스트**: {test_count}개 통과

**Phase 커밋 현황**:
- v0.0.x CONFIG: ✅ committed
- v0.1.x PROJECT: ✅ committed
- v0.2.x TESTS: ✅ committed
- v0.3.x DATA: ✅ committed
- v0.4.x CODE: ✅ committed

---

💡 **다음 단계**:
   - "푸시해줘" → 원격 저장소에 푸시
   - "PR 만들어줘" → `skill:git-workflow` 호출하여 Draft PR 생성
   - "verify" → `skill:verify` 호출하여 최종 검증
```

### 자동 커밋 동작

- **Phase 완료 시**: 자동으로 Atomic Commit 생성 (Gitmoji 사용)
- **전체 완료 시**: 푸시/PR 여부 프롬프트 표시
- **사용자 "푸시해줘"**: `skill:git-workflow` 호출
- **사용자 "PR 만들어줘"**: `skill:git-workflow` 호출 (Draft PR 생성)

---

## References

- [Phase Workflow](references/phase-workflow.md) - Phase details, gate control, output format
