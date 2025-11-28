---
name: docx
description: |
  Word 문서(.docx) 생성, 편집, 변환 Skill. Use when:
  (1) spec.md를 외부 공유용 Word로 변환, (2) 릴리스 노트 Word 생성,
  (3) 기술 문서 docx 내보내기, (4) 기존 docx 편집/Tracked Changes.
  Based on Anthropic Skills standard.
tools: [Bash, Read, Write]
---

> **SAX Message**: `[SAX] Skill: docx 호출 - {작업 유형}`

# DOCX Skill

Word 문서 생성, 편집, 변환을 위한 통합 Skill입니다.

## Quick Start

### Workflow Decision Tree

| 작업 | 사용 방법 |
|------|----------|
| **새 문서 생성** | docx-js (JavaScript) |
| **기존 문서 편집** | OOXML (Python) |
| **Markdown → Word** | pandoc 변환 |
| **Word → Markdown** | pandoc 추출 |

## Use Cases

### 1. Spec 문서 내보내기

```bash
# spec.md → docx 변환
pandoc specs/{domain}/spec.md -o specs/{domain}/spec.docx \
  --reference-doc=templates/semicolon-template.docx
```

### 2. 릴리스 노트 생성

```bash
# CHANGELOG.md → release-notes.docx
pandoc CHANGELOG.md -o release-notes.docx
```

### 3. 새 문서 생성 (docx-js)

```javascript
const { Document, Packer, Paragraph, TextRun } = require('docx');

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({ children: [new TextRun({ text: "Title", bold: true })] })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => fs.writeFileSync("doc.docx", buffer));
```

### 4. 기존 문서 편집 (OOXML)

```bash
# 1. 문서 언팩
python scripts/ooxml/unpack.py document.docx unpacked/

# 2. XML 편집 후 리팩
python scripts/ooxml/pack.py unpacked/ edited.docx
```

## SAX Message

```markdown
[SAX] Skill: docx 호출 - {spec 변환 | 릴리스 노트 | 문서 생성 | 문서 편집}

## 작업 유형: {type}
**입력**: {input_file}
**출력**: {output_file}

## 실행 결과
- 생성된 파일: {file_path}
- 페이지 수: {pages}
```

## Dependencies

| 도구 | 설치 명령 | 용도 |
|------|----------|------|
| pandoc | `brew install pandoc` | Markdown ↔ Word 변환 |
| docx | `npm install -g docx` | JavaScript 문서 생성 |
| defusedxml | `pip install defusedxml` | 안전한 XML 파싱 |

## References

- [docx-js Guide](references/docx-js.md) - JavaScript 문서 생성 상세
- [OOXML Guide](references/ooxml.md) - Python 문서 편집 상세
- [Workflow Examples](references/workflow-examples.md) - SAX 워크플로우 연동

## Related

- `spec` - spec.md 생성 (docx 변환 입력)
- `implement` - 개발 문서화
- `project-kickoff` - 프로젝트 문서 생성
