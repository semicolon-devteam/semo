---
name: assign-project-label
description: Assign project labels to Epics and connect to GitHub Projects #1 ('이슈관리'). Use when (1) creating new Epic, (2) migrating Epic from another repository, (3) Epic needs project categorization (차곡/노조관리/랜드/오피스 등).
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

| 선택 | 라벨 | 레포지토리 | 설명 |
|------|------|------------|------|
| 1 | `차곡` | cm-chagok | 에스테틱 고객 관리 |
| 2 | `매출지킴이` | cm-sales-keeper | 자영업자 매출 관리 |
| 3 | `노조관리` | cm-labor-union | 노조 관리 시스템 |
| 4 | `랜드` | cm-land | 랜드 관리 |
| 5 | `오피스` | cm-office | 오피스 관리 |
| 6 | `코인톡` | cm-cointalk | 코인톡 |
| 7 | `정치판` | cm-politics | 정치판 |
| 8 | `공통` | - | 인프라/플랫폼/공통 |

> **Note**: 기술영역 라벨(`epic`, `frontend`, `backend`)은 더 이상 사용하지 않습니다.
> 기술영역은 GitHub Issue Type으로 관리합니다.

## Quick Command

```bash
# Epic Issue에 프로젝트명 라벨만 추가 (epic 라벨 제외)
gh issue edit {epic_number} --repo semicolon-devteam/docs --add-label "{project_label}"
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
