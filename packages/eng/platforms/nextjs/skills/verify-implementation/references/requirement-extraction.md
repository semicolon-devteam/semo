# Requirement Extraction

> 이슈 본문에서 요구사항을 추출하는 패턴

## 추출 대상 패턴

### 1. 체크리스트 항목

```markdown
- [ ] 미완료 항목
- [x] 완료된 항목
* [ ] 별표 체크리스트
```

**정규표현식**:

```regex
^[-*]\s*\[([ x])\]\s*(.+)$
```

### 2. 섹션 기반 추출

다음 헤딩 하위 내용 추출:

- `## 요구사항` / `## Requirements`
- `## 기능` / `## Features`
- `## Acceptance Criteria`
- `## 완료 조건`
- `### 필수 기능`
- `### 추가 기능`

### 3. 번호 목록

```markdown
1. 첫 번째 요구사항
2. 두 번째 요구사항
```

### 4. User Story 패턴

```markdown
- 사용자는 ~할 수 있다
- As a user, I can ~
```

## 추출 우선순위

1. **체크리스트** (가장 명확)
2. **Acceptance Criteria 섹션**
3. **요구사항/기능 섹션**
4. **번호 목록**
5. **User Story 패턴**

## 키워드 추출

요구사항에서 코드 검색용 키워드 추출:

| 요구사항 패턴 | 추출 키워드 |
|--------------|-------------|
| "게시글 목록 조회" | `게시글`, `목록`, `조회`, `posts`, `list` |
| "페이지네이션 지원" | `페이지`, `pagination`, `page`, `limit`, `offset` |
| "검색 필터 기능" | `검색`, `필터`, `search`, `filter`, `query` |

## 예시

### 입력 (이슈 본문)

```markdown
## 기능 설명

게시글 CRUD 기능 구현

## 요구사항

- [ ] 게시글 목록 조회 API
- [ ] 게시글 상세 조회 API
- [x] 게시글 작성 API
- [ ] 페이지네이션 지원

## Acceptance Criteria

1. 목록 API는 10개씩 페이지네이션
2. 상세 조회 시 조회수 증가
```

### 출력 (추출된 요구사항)

```json
[
  {"text": "게시글 목록 조회 API", "completed": false, "keywords": ["게시글", "목록", "조회", "posts", "list"]},
  {"text": "게시글 상세 조회 API", "completed": false, "keywords": ["게시글", "상세", "조회", "detail"]},
  {"text": "게시글 작성 API", "completed": true, "keywords": ["게시글", "작성", "create", "post"]},
  {"text": "페이지네이션 지원", "completed": false, "keywords": ["페이지", "pagination", "page"]},
  {"text": "목록 API는 10개씩 페이지네이션", "completed": null, "keywords": ["목록", "페이지", "10"]},
  {"text": "상세 조회 시 조회수 증가", "completed": null, "keywords": ["상세", "조회수", "viewCount"]}
]
```
