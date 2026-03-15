# TOOLS.md — ReviewClaw 🔍

> 내가 실제 사용하는 도구, 명령어, 경로 치트시트.
> SOUL.md = 원칙, TOOLS.md = 실행 수단.

---

## GitHub CLI (`gh`)

### PR 리뷰

```bash
# 리뷰 대기 PR 목록
gh pr list --label "bot:needs-review" --json number,title,headRefName,author

# PR diff 조회
gh pr diff <PR번호>

# PR 변경 파일 목록
gh pr view <PR번호> --json files

# Approve
gh pr review <PR번호> --approve --body "✅ PASS — AC 전항목 통과"

# 수정 요청
gh pr review <PR번호> --request-changes --body "🔴 리뷰 결과: FAIL [Rework #N]..."

# 코멘트만 (self-PR 등)
gh pr review <PR번호> --comment --body "..."
```

### 이슈 라벨 전환

```bash
# 라벨 교체 (상호배타 원칙 — 반드시 제거 후 추가)
gh issue edit <N> --remove-label "bot:needs-review" --add-label "bot:done"
gh issue edit <N> --remove-label "bot:needs-review" --add-label "bot:request-changes"
gh issue edit <N> --remove-label "bot:needs-review" --add-label "bot:blocked"

# 재작업 횟수 확인 ([Rework #N] 태그 카운트)
REWORK_COUNT=$(gh issue view <N> --comments | grep -c "\[Rework #" || echo 0)
```

### 이슈 코멘트

```bash
# FAIL 코멘트 (Rework 횟수 포함)
gh issue comment <N> --body "🔴 리뷰 결과: FAIL [Rework #N]

**AC 미통과 항목:**
- AC-1: [이유]

**Must Fix:**
- ...

수정 후 bot:needs-review 라벨 재부착 요청."

# PASS 코멘트
gh issue comment <N> --body "✅ 리뷰 결과: PASS — 모든 AC 통과. bot:done 전환."

# ESCALATE 코멘트
gh issue comment <N> --body "⚠️ ESCALATE — 스펙 불명확으로 판단 불가. SemiClaw 확인 요청."
```

---

## 코드 분석 도구

```bash
# TypeScript 타입 체크 (strict)
npx tsc --noEmit

# ESLint
npx eslint . --ext .ts,.tsx

# 빌드 검증
npm run build

# 테스트 실행
npm test
npm run test:e2e
```

---

## 라벨 흐름 (내 관할)

```
bot:needs-review
  ├─ AC 전통과 + 필수체크 OK   → bot:done
  ├─ AC 실패 or Must Fix       → bot:request-changes  [Rework N < 3]
  └─ Rework N ≥ 3 or 판단불가  → bot:blocked + SemiClaw 멘션
```

**금지**: `gh pr merge` 절대 금지 (머지는 사람이), 상태 라벨 2개 동시 존재

---

## 참조 파일

| 파일 | 내용 |
|------|------|
| `shared/pr-review-checklist.md` | Must Fix / Should Fix / Suggestion 기준 |
| `shared/label-convention.md` | 라벨 상호배타 규칙 전체 |
| `shared/workflow-rules.md` | 봇 간 협업 규칙 |
| `SOUL.md` → E-O 루프 섹션 | PASS/FAIL/ESCALATE 판정 기준, FAIL 코멘트 형식 |

---

## 리뷰 실행 순서

```
1. 이슈 AC 섹션 확인 → 없으면 즉시 ESCALATE
2. gh pr diff <N> → 변경 코드 분석
3. AC 항목 하나씩 검증 (코드 + 빌드 + 테스트)
4. 필수 체크 병행: 타입 / 에러핸들링 / 보안 / 환경변수 / console.log
5. PASS / FAIL / ESCALATE 판정
6. 코멘트 작성 → 라벨 전환 (이전 라벨 제거 필수)
```
