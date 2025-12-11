# Figma Import Workflow

> `/figma` 명령어로 호출되는 워크플로우

## 트리거

```
/figma {figma_url}
/figma {file_key} {node_id}
```

## 프로세스

### 1. URL 파싱

Figma URL에서 정보를 추출합니다:
- `fileKey`: 파일 식별자
- `nodeId`: 노드 식별자 (있는 경우)

예시 URL:
```
https://www.figma.com/file/abc123/ProjectName?node-id=0%3A1
→ fileKey: abc123
→ nodeId: 0:1
```

### 2. 데이터 조회

Figma API를 통해 디자인 데이터를 가져옵니다:
- 레이아웃 정보
- 색상 값
- 타이포그래피
- 컴포넌트 구조

### 3. 스펙 추출

디자인 데이터에서 구현에 필요한 스펙을 추출합니다:
- CSS 값 변환
- 디자인 토큰 매핑
- 구조 분석

### 4. 결과 제공

추출된 스펙을 구조화된 형태로 제공합니다.

---

## 예시

### 입력
```
/figma https://www.figma.com/file/abc123/LoginScreen?node-id=1%3A234
```

### 출력
```
[SEMO] Skill: figma-import - Figma 데이터 조회

## Figma 디자인: Login Screen

### 파일 정보
- File Key: abc123
- Node ID: 1:234
- 노드 이름: Login Form

### 추출된 스펙

#### 레이아웃
- 너비: 400px
- 높이: auto
- Padding: 32px

#### 색상
| 요소 | Figma 이름 | 값 |
|------|-----------|-----|
| Background | Gray/50 | #F9FAFB |
| Primary | Blue/600 | #2563EB |
| Text | Gray/900 | #111827 |

#### 타이포그래피
| 요소 | 폰트 | 크기 | 굵기 |
|------|------|------|------|
| Title | Inter | 24px | 600 |
| Label | Inter | 14px | 500 |
| Body | Inter | 16px | 400 |

#### 컴포넌트 구조
- Frame: LoginForm
  - Text: Title
  - Frame: InputGroup (Email)
  - Frame: InputGroup (Password)
  - Button: Submit
  - Frame: SocialLogin
```

---

## Figma URL 형식

### 지원 형식

```
# 파일 URL
https://www.figma.com/file/{fileKey}/{fileName}

# 노드 URL
https://www.figma.com/file/{fileKey}/{fileName}?node-id={nodeId}

# 디자인 URL (새 형식)
https://www.figma.com/design/{fileKey}/{fileName}?node-id={nodeId}
```

### URL 파싱 규칙

```
fileKey: URL의 /file/ 또는 /design/ 다음 세그먼트
nodeId: ?node-id= 파라미터 (URL 디코딩 필요, %3A → :)
```

---

## 에러 처리

### 접근 권한 없음
```
⚠️ Figma 파일에 접근할 수 없습니다.

해결 방법:
1. Figma에 로그인되어 있는지 확인
2. 파일 접근 권한이 있는지 확인
3. 공개 파일인 경우 URL 확인
```

### 잘못된 URL
```
⚠️ 올바른 Figma URL이 아닙니다.

올바른 형식:
https://www.figma.com/file/{fileKey}/{fileName}
```

---

## Claude Code 연동

Figma 데이터를 Claude Code에서 활용:

```
[Antigravity]
1. /figma로 디자인 데이터 조회
2. 스펙 추출 및 정리
   ↓
[Claude Code]
3. Framelink MCP로 동일 데이터 조회
4. 컴포넌트 구현
```

또는 핸드오프 문서로 전달:
```
[Antigravity]
1. /figma로 데이터 조회
2. /handoff로 문서 생성
   ↓ (design-handoff.md)
[Claude Code]
3. 문서 기반 구현
```
