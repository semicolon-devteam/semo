# OOXML Guide

Python으로 기존 Word 문서를 편집하는 가이드입니다.

## Overview

`.docx` 파일은 ZIP 아카이브로, XML 파일들을 포함합니다:

```
document.docx (unzipped)
├── word/
│   ├── document.xml    # 메인 문서 내용
│   ├── comments.xml    # 댓글
│   ├── styles.xml      # 스타일 정의
│   └── media/          # 이미지, 미디어
├── _rels/
└── [Content_Types].xml
```

## Basic Workflow

### 1. Unpack Document

```bash
python scripts/ooxml/unpack.py document.docx unpacked/
```

### 2. Edit XML

```python
from defusedxml import ElementTree as ET

# Read document.xml
tree = ET.parse('unpacked/word/document.xml')
root = tree.getroot()

# Define namespaces
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

# Find and modify text
for t in root.findall('.//w:t', ns):
    if 'OLD_TEXT' in t.text:
        t.text = t.text.replace('OLD_TEXT', 'NEW_TEXT')

# Save
tree.write('unpacked/word/document.xml', xml_declaration=True, encoding='UTF-8')
```

### 3. Pack Document

```bash
python scripts/ooxml/pack.py unpacked/ edited.docx
```

## Tracked Changes (Redlining)

Word의 변경 내용 추적 기능을 사용한 편집:

### Read with Tracked Changes

```bash
# pandoc으로 변경 내용 포함 마크다운 변환
pandoc --track-changes=all document.docx -o changes.md
```

### Add Tracked Changes

```python
# Insertion (추가)
insertion_xml = '''
<w:ins w:author="Claude" w:date="2024-01-01T00:00:00Z">
  <w:r><w:t>NEW TEXT</w:t></w:r>
</w:ins>
'''

# Deletion (삭제)
deletion_xml = '''
<w:del w:author="Claude" w:date="2024-01-01T00:00:00Z">
  <w:r><w:delText>OLD TEXT</w:delText></w:r>
</w:del>
'''
```

### Minimal Change Principle

```python
# BAD - 전체 문장 교체
'<w:del><w:r><w:delText>The term is 30 days.</w:delText></w:r></w:del>'
'<w:ins><w:r><w:t>The term is 60 days.</w:t></w:r></w:ins>'

# GOOD - 변경된 부분만
'<w:r><w:t>The term is </w:t></w:r>'
'<w:del><w:r><w:delText>30</w:delText></w:r></w:del>'
'<w:ins><w:r><w:t>60</w:t></w:r></w:ins>'
'<w:r><w:t> days.</w:t></w:r>'
```

## Key XML Elements

| Element | Description |
|---------|-------------|
| `<w:p>` | Paragraph |
| `<w:r>` | Run (텍스트 블록) |
| `<w:t>` | Text |
| `<w:ins>` | Insertion (추가) |
| `<w:del>` | Deletion (삭제) |
| `<w:comment>` | Comment |
| `<w:tbl>` | Table |
| `<w:tr>` | Table Row |
| `<w:tc>` | Table Cell |

## Text Extraction

```bash
# 단순 텍스트 추출
pandoc document.docx -o output.md

# 변경 내용 포함
pandoc --track-changes=all document.docx -o output.md

# 변경 수락/거부
pandoc --track-changes=accept document.docx -o output.md
pandoc --track-changes=reject document.docx -o output.md
```

## Document to Images

```bash
# DOCX → PDF
soffice --headless --convert-to pdf document.docx

# PDF → Images
pdftoppm -jpeg -r 150 document.pdf page
# Output: page-1.jpg, page-2.jpg, ...
```

## Safety Notes

- **defusedxml 사용**: XML 파싱 시 보안 취약점 방지
- **원본 백업**: 편집 전 항상 원본 복사
- **Namespace 주의**: Word XML은 복잡한 namespace 사용
