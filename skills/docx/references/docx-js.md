# docx-js Guide

JavaScript/TypeScript로 Word 문서를 생성하는 가이드입니다.

## Setup

```javascript
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        LevelFormat, ShadingType, PageBreak } = require('docx');
```

## Basic Document

```javascript
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 24 } } }, // 12pt
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal",
        run: { size: 32, bold: true },
        paragraph: { spacing: { before: 240, after: 240 } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal",
        run: { size: 28, bold: true },
        paragraph: { spacing: { before: 180, after: 180 } } }
    ]
  },
  sections: [{
    properties: {
      page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
    },
    children: [/* content */]
  }]
});

// Save
Packer.toBuffer(doc).then(buffer => fs.writeFileSync("doc.docx", buffer));
```

## Text & Formatting

```javascript
// Basic paragraph
new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [
    new TextRun({ text: "Bold", bold: true }),
    new TextRun({ text: "Italic", italics: true }),
    new TextRun({ text: "Colored", color: "FF0000" })
  ]
})

// Headings
new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Title")] })
```

## Lists

```javascript
const doc = new Document({
  numbering: {
    config: [
      { reference: "bullet-list",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbered-list",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }
    ]
  },
  sections: [{
    children: [
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 },
        children: [new TextRun("First item")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 },
        children: [new TextRun("Second item")] })
    ]
  }]
});
```

## Tables

```javascript
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: border, bottom: border, left: border, right: border };

new Table({
  columnWidths: [4680, 4680],
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          borders: cellBorders,
          width: { size: 4680, type: WidthType.DXA },
          shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
          children: [new Paragraph({ children: [new TextRun({ text: "Header", bold: true })] })]
        })
      ]
    })
  ]
})
```

## Page Breaks

```javascript
// Manual page break - MUST be inside Paragraph
new Paragraph({ children: [new PageBreak()] })

// Page break before paragraph
new Paragraph({ pageBreakBefore: true, children: [new TextRun("New Page")] })
```

## Critical Rules

| Rule | Correct | Wrong |
|------|---------|-------|
| Line breaks | Separate `Paragraph` | `\n` in TextRun |
| Page breaks | Inside `Paragraph` | Standalone `PageBreak()` |
| Bullets | `LevelFormat.BULLET` | Unicode symbols |
| Cell shading | `ShadingType.CLEAR` | `ShadingType.SOLID` |
| Measurements | DXA (1440 = 1 inch) | - |

## Semicolon Template

```javascript
// Semicolon 스타일 문서 생성
const createSemicolonDoc = (title, content) => {
  return new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        { id: "Title", name: "Title", run: { size: 48, bold: true, color: "2563EB" } },
        { id: "Heading1", name: "Heading 1", run: { size: 32, bold: true } },
        { id: "Heading2", name: "Heading 2", run: { size: 26, bold: true, color: "374151" } }
      ]
    },
    sections: [{
      headers: {
        default: new Header({ children: [
          new Paragraph({ alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Semicolon", italics: true, color: "9CA3AF" })] })
        ]})
      },
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)] }),
        ...content
      ]
    }]
  });
};
```
