---
name: test
description: |
  테스트 작성 및 실행 (Unit/E2E/QA). Use when:
  (1) 테스트 코드 작성, (2) 테스트 실행, (3) 커버리지 확인.
tools: [Bash, Read, Write]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: test 호출 - {type}` 시스템 메시지를 첫 줄에 출력하세요.

# test Skill

> 테스트 작성 및 실행 통합

## Test Types

| Type | 설명 | 명령어 |
|------|------|--------|
| **unit** | 유닛 테스트 | `npm test` |
| **e2e** | E2E 테스트 | `npm run test:e2e` |
| **integration** | 통합 테스트 | `npm run test:integration` |

---

## Actions

### 1. 테스트 작성 (design)

```
1. 테스트 대상 식별
2. 테스트 케이스 설계
3. __tests__ 디렉토리에 작성
4. Jest/Vitest 형식
```

### 2. 테스트 실행 (run)

```bash
# Unit 테스트
npm test

# E2E 테스트
npm run test:e2e

# 특정 파일
npm test -- user.test.ts

# Coverage
npm test -- --coverage
```

### 3. 커버리지 확인

```bash
npm test -- --coverage --coverageReporters=text
```

---

## 테스트 템플릿

```typescript
// __tests__/user.test.ts
import { describe, it, expect } from 'vitest';
import { createUser } from '@/domain/user';

describe('User Domain', () => {
  it('should create user with valid email', () => {
    const user = createUser({ email: 'test@example.com' });
    expect(user.email).toBe('test@example.com');
  });
});
```

---

## 출력

```markdown
[SEMO] Skill: test 완료 (run)

✅ 테스트 실행 완료

**Total**: 45 tests
**Pass**: 43
**Fail**: 2
**Coverage**: 78%
```

---

## Related

- `implement` - 코드 구현 후 테스트 작성
- `review` - 테스트 코드 리뷰
- `verify` - CI/CD 검증
