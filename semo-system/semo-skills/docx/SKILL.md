---
name: docx
description: |
  문서 생성 (README/CONTRIBUTING/API). Use when:
  (1) README 작성, (2) API 문서, (3) 가이드 문서.
tools: [Read, Write]
model: inherit
---

> **호출 시 메시지**: 이 Skill이 호출되면 반드시 `[SEMO] Skill: docx 호출 - {type}` 시스템 메시지를 첫 줄에 출력하세요.

# docx Skill

> 문서 생성 (README, CONTRIBUTING, API 문서)

## Document Types

| Type | 설명 | 파일 |
|------|------|------|
| **readme** | 프로젝트 README | README.md |
| **contributing** | 기여 가이드 | CONTRIBUTING.md |
| **api** | API 문서 | docs/api.md |
| **guide** | 사용자 가이드 | docs/guide.md |

---

## Type: readme

### 템플릿

```markdown
# {프로젝트명}

> {한 줄 설명}

## Features
- {기능1}
- {기능2}

## Installation
```bash
npm install
```

## Usage
```typescript
import { Something } from 'package';
```

## API
### `functionName(param)`
{설명}

## Contributing
[CONTRIBUTING.md](CONTRIBUTING.md)

## License
MIT
```

---

## Type: api (API 문서)

### 템플릿

```markdown
# API Documentation

## Endpoints

### GET /api/users
사용자 목록 조회

**Request**
```
GET /api/users?page=1&limit=10
```

**Response**
```json
{
  "users": [...],
  "total": 100
}
```

### POST /api/users
사용자 생성

**Request**
```json
{
  "email": "string",
  "name": "string"
}
```

**Response**
```json
{
  "id": "uuid",
  "email": "string"
}
```
```

---

## 출력

```markdown
[SEMO] Skill: docx 완료 (readme)

✅ README.md 생성 완료

**파일**: README.md
**섹션**: 7개
```

---

## Related

- `spec` - 스펙 문서
- `meeting` - 회의록
- `report` - 보고서
