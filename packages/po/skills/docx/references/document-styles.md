# Document Styles

Semicolon 팀 문서 스타일 가이드입니다.

## Color Palette

| 용도 | 색상 | HEX |
|------|------|-----|
| Primary (Title) | Blue | `2563EB` |
| Heading 1 | Dark Gray | `1F2937` |
| Heading 2 | Gray | `374151` |
| Body Text | Black | `000000` |
| Table Header BG | Light Gray | `F3F4F6` |
| Table Border | Border Gray | `E5E7EB` |
| Muted Text | Muted | `9CA3AF` |

## Typography

| Element | Font | Size (half-points) | Size (pt) |
|---------|------|-------------------|-----------|
| Title | Arial Bold | 48 | 24pt |
| Heading 1 | Arial Bold | 32 | 16pt |
| Heading 2 | Arial Bold | 26 | 13pt |
| Body | Arial | 22 | 11pt |
| Small | Arial | 20 | 10pt |

## Spacing (DXA units)

| Element | Before | After |
|---------|--------|-------|
| Title | 0 | 400 |
| Heading 1 | 400 | 200 |
| Heading 2 | 300 | 150 |
| Paragraph | 0 | 120 |
| List Item | 0 | 60 |

## Page Layout

```javascript
properties: {
  page: {
    margin: {
      top: 1440,    // 1 inch
      right: 1440,  // 1 inch
      bottom: 1440, // 1 inch
      left: 1440    // 1 inch
    }
  }
}
```

## Table Styles

### Standard Table

```javascript
const border = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: "E5E7EB"
};

// Header Cell
{
  shading: { fill: "F3F4F6", type: ShadingType.CLEAR },
  children: [new Paragraph({
    children: [new TextRun({ text: "Header", bold: true })]
  })]
}

// Data Cell
{
  children: [new Paragraph({
    children: [new TextRun("Data")]
  })]
}
```

### Metadata Table (2 columns)

```javascript
columnWidths: [2500, 6860]  // Label: 2500, Value: 6860 (total ~9360 for 1" margins)
```

### Data Table (3 columns)

```javascript
columnWidths: [3120, 3120, 3120]  // Equal thirds
```

## Header/Footer

```javascript
headers: {
  default: new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({
        text: "Semicolon",
        italics: true,
        color: "9CA3AF",
        size: 20
      })]
    })]
  })
},
footers: {
  default: new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "Page ", size: 20 }),
        new TextRun({ children: [PageNumber.CURRENT], size: 20 }),
        new TextRun({ text: " of ", size: 20 }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 20 })
      ]
    })]
  })
}
```

## Document Types

### Epic Proposal

- Title: `[Epic] {Domain Name}`
- Sections: Executive Summary, Problems, Benefits, User Stories, AC, Timeline
- Color accent: Primary Blue

### Requirements Document

- Title: `Requirements: {Feature Name}`
- Sections: Overview, Functional, Non-functional, Constraints
- Numbered requirements: FR-001, NFR-001

### Sprint Report

- Title: `Sprint {N} Report`
- Sections: Summary, Completed, In Progress, Blockers, Next Sprint
- Include metrics table

### Meeting Notes

- Title: `Meeting Notes: {Date}`
- Sections: Attendees, Agenda, Discussion, Action Items
- Action items with owners and due dates
