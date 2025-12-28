---
name: analyze-tech-debt
description: |
  기술 부채 분석. Use when (1) "기술 부채 분석", (2) "코드 품질 체크",
  (3) "리팩토링 필요한 부분". 코드베이스 분석하여 기술 부채 식별.
tools: [Bash, Read, Grep, Glob]
model: inherit
---

> **시스템 메시지**: `[SEMO] Skill: analyze-tech-debt 호출`

# analyze-tech-debt Skill

> 기술 부채 분석

## Purpose

코드베이스를 분석하여 기술 부채를 식별하고 우선순위를 매깁니다.

## Analysis Categories

### 1. 보안 취약점 (최우선)

```bash
# 하드코딩된 시크릿 검색
grep -r "password\s*=" --include="*.ts" --include="*.tsx" src/
grep -r "apiKey\s*=" --include="*.ts" --include="*.tsx" src/
grep -r "secret\s*=" --include="*.ts" --include="*.tsx" src/
```

### 2. 성능 이슈

```bash
# N+1 쿼리 패턴 검색
grep -r "\.map.*await" --include="*.ts" src/
grep -r "forEach.*await" --include="*.ts" src/

# 무한 리렌더링 위험
grep -r "useEffect.*\[\]" --include="*.tsx" src/
```

### 3. 코드 복잡도

```bash
# 큰 파일 검색 (300줄 이상)
find src -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -10

# any 타입 사용
grep -r ": any" --include="*.ts" --include="*.tsx" src/ | wc -l
```

### 4. 중복 코드

```bash
# 유사한 함수명 패턴
grep -r "function handle" --include="*.ts" --include="*.tsx" src/ | wc -l
```

### 5. 테스트 커버리지

```bash
# 테스트 파일 존재 여부
find src -name "*.test.ts" -o -name "*.spec.ts" | wc -l
```

## Output Format

```markdown
## 기술 부채 분석 결과

### 🔴 보안 취약점 (Critical)
| 파일 | 라인 | 이슈 | 위험도 |
|------|------|------|--------|
| src/lib/api.ts | 15 | 하드코딩된 API 키 | Critical |

### 🟠 성능 이슈 (High)
| 파일 | 라인 | 이슈 | 영향도 |
|------|------|------|--------|
| src/app/posts/page.tsx | 45 | N+1 쿼리 패턴 | High |

### 🟡 코드 복잡도 (Medium)
| 파일 | 라인 수 | 이슈 |
|------|---------|------|
| src/components/Form.tsx | 450 | 파일 크기 초과 |

### ⚪ any 타입 사용 (Low)
- 총 15개 파일에서 any 타입 사용

---

## 요약

| 우선순위 | 건수 | 권장 조치 |
|----------|------|----------|
| Critical | 1 | 즉시 수정 |
| High | 3 | 이번 스프린트 |
| Medium | 5 | 다음 스프린트 |
| Low | 10 | 점진적 개선 |

**총 기술 부채**: 19건
```

## Expected Output

```markdown
[SEMO] Skill: analyze-tech-debt 호출

## 기술 부채 분석 결과

### 🔴 보안 취약점 (0건)
없음 ✅

### 🟠 성능 이슈 (2건)
| 파일 | 이슈 |
|------|------|
| src/app/posts/_repositories/post.repository.ts | N+1 쿼리 가능성 |
| src/app/feed/page.tsx | 캐시 미적용 |

### 🟡 코드 복잡도 (3건)
| 파일 | 라인 수 |
|------|---------|
| src/components/Editor.tsx | 380 |

---

**총 기술 부채**: 5건
**권장**: 성능 이슈 우선 해결

[SEMO] Skill: analyze-tech-debt 완료
```

## Integration

### ops/improve 연계

```text
analyze-tech-debt (분석)
    ↓
suggest-refactoring (제안)
    ↓
create-improvement-issue (이슈 생성)
    ↓
biz/discovery (Epic 전환)
```

## References

- [ops/improve CLAUDE.md](../../CLAUDE.md)
- [suggest-refactoring Skill](../suggest-refactoring/SKILL.md)
