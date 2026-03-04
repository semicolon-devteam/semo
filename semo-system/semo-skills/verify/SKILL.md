---
name: verify
description: |
  코드 품질 검증 (아키텍처/타입/린트/빌드/PR). Use when:
  (1) 아키텍처 검증, (2) PR 준비 확인, (3) 배포 전 검증.
tools: [Bash, Read]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: verify 호출 - {type}` 시스템 메시지를 첫 줄에 출력하세요.

# verify Skill

> 코드 품질 검증 (아키텍처, 타입, 린트, 빌드, PR 준비)

## Verification Types

| Type | 설명 | 명령어 |
|------|------|--------|
| **architecture** | 아키텍처 규칙 검증 | 커스텀 스크립트 |
| **type** | TypeScript 타입 체크 | `npx tsc --noEmit` |
| **lint** | ESLint 검사 | `npm run lint` |
| **build** | 빌드 검증 | `npm run build` |
| **pr-ready** | PR 준비 확인 | 전체 검증 |
| **quality-gate** | 배포 전 품질 게이트 | CI/CD 통합 |

---

## Workflow

```
1. TypeScript 타입 체크
2. ESLint 실행
3. 테스트 실행
4. 빌드 확인
5. 아키텍처 규칙 검증
```

### 실행 예시

```bash
# 1. 타입 체크
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. 테스트
npm test

# 4. 빌드
npm run build

# 5. 아키텍처 검증 (커스텀)
npm run verify:architecture
```

---

## 아키텍처 검증 규칙

- DDD 4-layer 구조 준수
- Import 방향성 (domain ← application ← infra ← presentation)
- Circular dependency 방지
- 도메인 순수성 유지

---

## PR Ready 체크리스트

```markdown
✅ PR 준비 완료

**검증 항목**:
- [x] TypeScript 타입 체크
- [x] ESLint 통과
- [x] 테스트 통과 (45/45)
- [x] 빌드 성공
- [x] 아키텍처 규칙 준수

**Ready for Review** ✅
```

---

## Quality Gate (배포 전)

```bash
# CI/CD 파이프라인에서 실행
npm run verify:all

# 포함 항목:
# - 타입 체크
# - Lint
# - 테스트 (커버리지 80% 이상)
# - 빌드
# - 아키텍처 검증
```

---

## 출력

```markdown
[SEMO] Skill: verify 완료 (pr-ready)

✅ PR 준비 검증 완료

**TypeScript**: ✅ Pass
**Lint**: ✅ Pass
**Test**: ✅ Pass (45/45)
**Build**: ✅ Pass
**Architecture**: ✅ Pass
```

---

## Related

- `test` - 테스트 실행
- `review` - 코드 리뷰
- `git` - PR 생성
