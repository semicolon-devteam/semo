# Epic Proposal Template

Epic 제안서 생성을 위한 템플릿과 스크립트입니다.

## Template Structure

```javascript
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        HeadingLevel, AlignmentType, BorderStyle, WidthType } = require('docx');

const createEpicProposal = (epicData) => {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" };
  const cellBorders = { top: border, bottom: border, left: border, right: border };

  return new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        { id: "Title", name: "Title",
          run: { size: 48, bold: true, color: "2563EB" },
          paragraph: { spacing: { after: 400 } } },
        { id: "Heading1", name: "Heading 1",
          run: { size: 32, bold: true, color: "1F2937" },
          paragraph: { spacing: { before: 400, after: 200 } } },
        { id: "Heading2", name: "Heading 2",
          run: { size: 26, bold: true, color: "374151" },
          paragraph: { spacing: { before: 300, after: 150 } } }
      ]
    },
    sections: [{
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
      },
      children: [
        // Title
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [new TextRun(`[Epic] ${epicData.domain_name}`)]
        }),

        // Metadata Table
        createMetadataTable(epicData, cellBorders),

        // Executive Summary
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("1. Executive Summary")]
        }),
        new Paragraph({
          children: [new TextRun(epicData.domain_description)]
        }),

        // Problem Statement
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("2. Problem Statement")]
        }),
        ...epicData.problems.map(p => createBulletParagraph(p)),

        // Expected Benefits
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("3. Expected Benefits")]
        }),
        ...epicData.benefits.map(b => createBulletParagraph(b)),

        // User Stories
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("4. User Stories")]
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("4.1 Required")]
        }),
        ...epicData.user_stories.required.map(s => createBulletParagraph(s)),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("4.2 Optional")]
        }),
        ...epicData.user_stories.optional.map(s => createBulletParagraph(s)),

        // Acceptance Criteria
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("5. Acceptance Criteria")]
        }),
        ...epicData.acceptance_criteria.map((c, i) =>
          new Paragraph({
            children: [new TextRun(`AC-${String(i + 1).padStart(3, '0')}: ${c}`)]
          })
        ),

        // Timeline & Resources
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("6. Timeline & Resources")]
        }),
        createResourceTable(epicData, cellBorders)
      ]
    }]
  });
};

// Helper: Metadata Table
const createMetadataTable = (data, borders) => {
  return new Table({
    columnWidths: [2500, 6860],
    rows: [
      createTableRow("Priority", data.priority, borders),
      createTableRow("Complexity", data.complexity, borders),
      createTableRow("Target Repos", data.target_repos.join(", "), borders),
      createTableRow("Dependencies", data.dependencies.join(", ") || "None", borders)
    ]
  });
};

// Helper: Table Row
const createTableRow = (label, value, borders) => {
  return new TableRow({
    children: [
      new TableCell({
        borders,
        width: { size: 2500, type: WidthType.DXA },
        shading: { fill: "F3F4F6", type: "clear" },
        children: [new Paragraph({
          children: [new TextRun({ text: label, bold: true })]
        })]
      }),
      new TableCell({
        borders,
        width: { size: 6860, type: WidthType.DXA },
        children: [new Paragraph({
          children: [new TextRun(value)]
        })]
      })
    ]
  });
};

// Helper: Bullet Paragraph (simplified - use numbering in real impl)
const createBulletParagraph = (text) => {
  return new Paragraph({
    indent: { left: 720 },
    children: [new TextRun(`• ${text}`)]
  });
};

module.exports = { createEpicProposal };
```

## Usage

```javascript
const fs = require('fs');
const { Packer } = require('docx');
const { createEpicProposal } = require('./epic-proposal-template');

const epicData = {
  domain_name: "Comments",
  domain_description: "게시글에 댓글 기능을 추가하여 사용자 간 소통을 활성화합니다.",
  problems: [
    "사용자가 게시글에 의견을 남길 방법이 없음",
    "커뮤니티 활성화에 한계가 있음"
  ],
  benefits: [
    "사용자 참여도 증가",
    "커뮤니티 활성화",
    "피드백 수집 용이"
  ],
  user_stories: {
    required: [
      "사용자로서 게시글에 댓글을 작성할 수 있다",
      "사용자로서 내 댓글을 수정/삭제할 수 있다"
    ],
    optional: [
      "사용자로서 댓글에 답글을 달 수 있다",
      "사용자로서 댓글에 좋아요를 누를 수 있다"
    ]
  },
  acceptance_criteria: [
    "로그인한 사용자만 댓글 작성 가능",
    "본인 댓글만 수정/삭제 가능",
    "댓글은 최신순으로 정렬"
  ],
  target_repos: ["community-fe", "core-supabase"],
  dependencies: ["User Authentication"],
  priority: "High",
  complexity: "Medium"
};

const doc = createEpicProposal(epicData);
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('epic-proposal-comments.docx', buffer);
  console.log('Epic proposal created: epic-proposal-comments.docx');
});
```

## Output Example

생성된 문서 구조:

```
[Epic] Comments
─────────────────────────────────
Priority      | High
Complexity    | Medium
Target Repos  | community-fe, core-supabase
Dependencies  | User Authentication
─────────────────────────────────

1. Executive Summary
게시글에 댓글 기능을 추가하여 사용자 간 소통을 활성화합니다.

2. Problem Statement
• 사용자가 게시글에 의견을 남길 방법이 없음
• 커뮤니티 활성화에 한계가 있음

3. Expected Benefits
• 사용자 참여도 증가
• 커뮤니티 활성화
• 피드백 수집 용이

...
```
