---
name: assign-project-label
description: Assign project labels to Epics and connect to GitHub Projects #1 ('이슈관리'). Use when (1) creating new Epic, (2) migrating Epic from another repository, (3) Epic needs project categorization (오피스/랜드/정치판/코인톡).
tools: [Bash, GitHub CLI]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: assign-project-label 호출 - {Epic 번호}` 시스템 메시지를 첫 줄에 출력하세요.

# Assign Project Label

Assign project labels and connect Epics to GitHub Projects.

## Process Summary

1. **프로젝트 확인** - 대화형 질문
2. **라벨 부여** - Epic Issue에 라벨 추가
3. **Projects 연결** - #1 이슈관리 보드에 추가

## Project Mapping

| 선택 | 라벨 | 레포지토리 |
|------|------|------------|
| 1 | `오피스` | cm-office |
| 2 | `랜드` | cm-land |
| 3 | `정치판` | cm-politics |
| 4 | `코인톡` | cm-cointalk |

## Quick Command

```bash
# Epic Issue에 프로젝트 라벨 추가
gh api repos/semicolon-devteam/docs/issues/{epic_number}/labels \
  -f labels[]="epic" \
  -f labels[]="{project_label}"
```

## SEMO Message

```markdown
[SEMO] Skill: assign-project-label 사용
[SEMO] Reference: GitHub Projects API 참조
```

## Related

- [epic-master Agent](../../agents/epic-master.md)
- [detect-project-from-epic Skill](../detect-project-from-epic/SKILL.md)

## References

For detailed documentation, see:

- [Workflow](references/workflow.md) - 상세 프로세스, GraphQL 명령어
- [Output Format](references/output-format.md) - 성공 출력, 에러 처리
