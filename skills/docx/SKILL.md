---
name: docx
description: |
  PO용 Word 문서 생성 Skill. Use when:
  (1) Epic 제안서 Word 생성, (2) 요구사항 문서 내보내기,
  (3) 스프린트 리포트 문서화, (4) 이해관계자 공유용 문서 생성.
  sax-next의 docx Skill 경량 버전.
tools: [Bash, Read, Write]
---

> **SAX Message**: `[SAX] Skill: docx 호출 - {작업 유형}`

# DOCX Skill (PO Edition)

PO 업무를 위한 Word 문서 생성 Skill입니다.

## Quick Start

### Use Cases

| 작업 | 설명 |
|------|------|
| **Epic 제안서** | Epic 승인용 공식 문서 |
| **요구사항 문서** | 외부 공유용 요구사항 |
| **스프린트 리포트** | 스프린트 결과 보고서 |
| **회의록** | 미팅 노트 문서화 |

## Workflows

### 1. Epic 제안서 생성

```bash
# Epic 데이터 → Word 제안서
node scripts/create-epic-proposal.js \
  --domain "Comments" \
  --output "proposals/comments-epic.docx"
```

### 2. 요구사항 문서 내보내기

```bash
# Markdown → Word
pandoc requirements.md -o requirements.docx \
  --reference-doc=templates/semicolon-template.docx
```

### 3. 스프린트 리포트

```bash
# GitHub Issues → Sprint Report
node scripts/create-sprint-report.js \
  --sprint 5 \
  --output "reports/sprint-5-report.docx"
```

## SAX Message

```markdown
[SAX] Skill: docx 호출 - {Epic 제안서 | 요구사항 문서 | 스프린트 리포트}

## 작업 유형: {type}
**입력**: {source_data}
**출력**: {output_file}

## 실행 결과
- 생성된 파일: {file_path}
- 문서 유형: {document_type}
```

## Document Templates

### Epic Proposal Structure

```
1. Executive Summary
   - Domain Name
   - Problem Statement
   - Expected Benefits

2. User Stories
   - Required Stories
   - Optional Stories

3. Acceptance Criteria
   - Functional Requirements
   - Non-functional Requirements

4. Timeline & Resources
   - Estimated Effort
   - Dependencies

5. Appendix
   - Technical Notes (if any)
```

### Requirements Document Structure

```
1. Overview
   - Purpose
   - Scope
   - Stakeholders

2. Functional Requirements
   - FR-001: [Requirement]
   - FR-002: [Requirement]

3. Non-functional Requirements
   - Performance
   - Security
   - Usability

4. Constraints & Assumptions
```

## Dependencies

| 도구 | 설치 명령 | 용도 |
|------|----------|------|
| pandoc | `brew install pandoc` | Markdown → Word |
| docx | `npm install docx` | JS 문서 생성 |

## References

- [Epic Proposal Template](references/epic-proposal-template.md)
- [Document Styles](references/document-styles.md)

## Related

- `create-epic` - Epic 생성 (docx 입력 데이터)
- `estimate-epic-timeline` - 타임라인 추정
- sax-next의 `docx` - Full 버전 (문서 편집 포함)
