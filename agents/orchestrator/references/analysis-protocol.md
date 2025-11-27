# Analysis Protocol

> orchestrator Agent의 상태 분석 프로토콜 및 응답 템플릿

## Step 1: Gather Current Context

```bash
# 1. 현재 브랜치 확인
git branch --show-current

# 2. Git 상태 확인
git status

# 3. 최근 커밋 확인
git log --oneline -5
```

## Step 2: Check Specification Artifacts

```bash
# specs 디렉토리 확인
ls -la specs/

# 현재 브랜치와 매칭되는 spec 확인
# 브랜치: 001-dynamic-gnb-menus → specs/001-dynamic-gnb-menus/
```

**Artifact Checklist**:

- [ ] `spec.md` 존재 여부 (Phase 1 완료)
- [ ] `plan.md` 존재 여부 (Phase 2 완료)
- [ ] `tasks.md` 존재 여부 (Phase 3 완료)
- [ ] `checklists/requirements.md` 상태

## Step 3: Check Implementation Progress

```bash
# 도메인 디렉토리 확인
ls -la src/app/{domain}/

# DDD 레이어 확인
ls -la src/app/{domain}/_repositories/
ls -la src/app/{domain}/_api-clients/
ls -la src/app/{domain}/_hooks/
ls -la src/app/{domain}/_components/
```

**Implementation Checklist**:

- [ ] 도메인 디렉토리 존재 (v0.1.x)
- [ ] 테스트 파일 존재 (v0.2.x)
- [ ] 타입 정의 존재 (v0.3.x)
- [ ] Repository 구현 (v0.4.x)
- [ ] API Client 구현 (v0.4.x)
- [ ] Hooks 구현 (v0.4.x)
- [ ] Components 구현 (v0.4.x)

## Step 4: Determine Phase and Next Action

Based on analysis, determine:

1. **Current Phase**: SDD (1-3) or ADD (4) or Verification (5)
2. **Progress within Phase**: What's done, what's remaining
3. **Blockers**: Any issues preventing progress
4. **Next Action**: Specific action to take

## Response Template

```markdown
## 📍 현재 진행 상황

**브랜치**: `{branch_name}`
**이슈**: #{issue_number} (추출된 경우)
**현재 Phase**: {phase_name}

### ✅ 완료된 작업

- [x] {completed_item_1}
- [x] {completed_item_2}

### 🔄 진행 중

- [ ] {in_progress_item}

### 📋 남은 작업

- [ ] {remaining_item_1}
- [ ] {remaining_item_2}

---

## 🎯 다음 단계

**권장 작업**: {next_action_description}

**사용할 에이전트/스킬**: `{agent_or_skill_name}`

**실행 방법**:

{how_to_invoke}

---

## 💡 추가 정보

{additional_context_if_needed}
```
