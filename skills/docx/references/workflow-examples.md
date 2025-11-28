# Workflow Examples

SAX 워크플로우와 docx Skill 연동 예시입니다.

## 1. Spec 문서 내보내기

SDD Phase 2에서 생성된 spec.md를 외부 공유용 Word로 변환합니다.

### Workflow

```
skill:spec → specs/{domain}/spec.md → skill:docx → spec.docx
```

### Command

```bash
# 기본 변환
pandoc specs/comments/spec.md -o specs/comments/spec.docx

# Semicolon 템플릿 적용
pandoc specs/comments/spec.md -o specs/comments/spec.docx \
  --reference-doc=templates/semicolon-spec.docx

# 목차 포함
pandoc specs/comments/spec.md -o specs/comments/spec.docx \
  --toc --toc-depth=3
```

### Output

```markdown
[SAX] Skill: docx 호출 - spec 변환

## 작업 유형: Spec Export
**입력**: specs/comments/spec.md
**출력**: specs/comments/spec.docx

## 실행 결과
- 생성된 파일: specs/comments/spec.docx
- 페이지 수: 5
- 섹션: Requirements, User Stories, Acceptance Criteria
```

## 2. 릴리스 노트 생성

CHANGELOG.md를 고객 배포용 Word 문서로 변환합니다.

### Workflow

```
CHANGELOG.md → skill:docx → release-notes-v{version}.docx
```

### Script

```javascript
// scripts/generate-release-notes.js
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

const changelog = fs.readFileSync('CHANGELOG.md', 'utf-8');
const version = changelog.match(/## \[(\d+\.\d+\.\d+)\]/)?.[1] || '0.0.0';

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun(`Release Notes v${version}`)]
      }),
      new Paragraph({
        children: [new TextRun({ text: `Generated: ${new Date().toISOString().split('T')[0]}` })]
      }),
      // Parse and add changelog content...
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(`release-notes-v${version}.docx`, buffer);
});
```

### Output

```markdown
[SAX] Skill: docx 호출 - 릴리스 노트

## 작업 유형: Release Notes
**입력**: CHANGELOG.md
**출력**: release-notes-v1.2.0.docx

## 실행 결과
- 생성된 파일: release-notes-v1.2.0.docx
- 버전: 1.2.0
- 변경 사항: 5 features, 3 fixes
```

## 3. API 문서 생성

API 스펙을 Word 문서로 내보냅니다.

### Workflow

```
core-supabase/document/test → skill:docx → api-docs.docx
```

### Command

```bash
# RPC 함수 문서화
gh api repos/semicolon-devteam/core-supabase/contents/document/test/posts \
  --jq '.[].name' | while read file; do
    gh api "repos/semicolon-devteam/core-supabase/contents/document/test/posts/$file" \
      --jq '.content' | base64 -d >> api-docs.md
done

# Word 변환
pandoc api-docs.md -o api-docs.docx
```

## 4. Epic 제안서 생성

Epic 승인용 Word 제안서를 생성합니다.

### Workflow

```
epic-master 데이터 → skill:docx → proposal.docx
```

### Template

```javascript
const createEpicProposal = (epicData) => {
  return new Document({
    sections: [{
      children: [
        // Title
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [new TextRun(`[Epic] ${epicData.domain_name}`)]
        }),

        // Problem Statement
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("Problem Statement")]
        }),
        ...epicData.problems.map(p =>
          new Paragraph({ numbering: { reference: "bullet", level: 0 },
            children: [new TextRun(p)] })
        ),

        // Benefits
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("Expected Benefits")]
        }),
        ...epicData.benefits.map(b =>
          new Paragraph({ numbering: { reference: "bullet", level: 0 },
            children: [new TextRun(b)] })
        ),

        // User Stories
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("User Stories")]
        }),
        ...epicData.user_stories.required.map(s =>
          new Paragraph({ children: [new TextRun(s)] })
        )
      ]
    }]
  });
};
```

## 5. 기술 문서 편집 (Tracked Changes)

기존 Word 문서에 Tracked Changes로 수정합니다.

### Workflow

```
기존 document.docx → skill:docx (edit) → reviewed.docx
```

### Process

```bash
# 1. 현재 내용 확인
pandoc --track-changes=all document.docx -o current.md

# 2. 문서 언팩
python scripts/ooxml/unpack.py document.docx unpacked/

# 3. 변경 사항 적용 (Python 스크립트로)
python scripts/apply-changes.py unpacked/ changes.json

# 4. 문서 리팩
python scripts/ooxml/pack.py unpacked/ reviewed.docx

# 5. 검증
pandoc --track-changes=all reviewed.docx -o verification.md
```

### Output

```markdown
[SAX] Skill: docx 호출 - 문서 편집

## 작업 유형: Edit with Tracked Changes
**입력**: document.docx
**출력**: reviewed.docx

## 변경 사항
- Insertions: 3
- Deletions: 2
- Author: Claude
- Date: 2024-01-01

## 검증 결과
- 모든 변경 사항 적용됨
- 원본 서식 유지됨
```

## Integration with SAX Skills

| SAX Skill | docx 연동 | 용도 |
|-----------|----------|------|
| `spec` | spec.md → spec.docx | 외부 공유 |
| `spike` | spike-report.md → spike.docx | 기술 검토 문서 |
| `create-issues` | tasks.md → tasks.docx | 작업 목록 문서화 |
| `project-kickoff` | kickoff.md → kickoff.docx | 프로젝트 시작 문서 |
| `constitution` | constitution.md → constitution.docx | 팀 규칙 문서화 |
