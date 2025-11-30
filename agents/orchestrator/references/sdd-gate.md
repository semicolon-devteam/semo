# SDD Gate Reference

## Gate Logic

```text
Implementation Request Detected
         │
         ▼
    Check specs/{domain}/
         │
    ┌────┴────┐
    │         │
   NO        YES
    │         │
    ▼         ▼
  Block    Check files
    │         │
    │    ┌────┴────┐
    │    │         │
    │  Missing    All Present
    │    │         │
    │    ▼         ▼
    │  Block    PASS → implementation-master
    │    │
    ▼    ▼
  Suggest spec-master
```

## Required Files

| File | Purpose | Content |
|------|---------|---------|
| `spec.md` | WHAT and WHY | 요구사항, AC |
| `plan.md` | HOW | 기술 접근 방식 |
| `tasks.md` | WORK ITEMS | 실행 가능한 작업 목록 |

## Exception Cases

### Fast Track Eligible

| Category | Examples |
|----------|----------|
| Bug Fix | hotfix, 버그 수정, 긴급 |
| Config | 설정 변경, env |
| Docs | 문서, README |
| Explicit | "SDD 없이", "바로 구현" |

### Fast Track Output

```markdown
[SAX] Orchestrator: Fast Track 적용

⚡ **SDD 생략**: {reason}

바로 구현을 진행합니다.
```

## Validation Commands

```bash
# Check SDD files exist
ls specs/{domain}/spec.md specs/{domain}/plan.md specs/{domain}/tasks.md

# Validate content (non-empty)
wc -l specs/{domain}/*.md
```
