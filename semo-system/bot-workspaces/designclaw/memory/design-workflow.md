# 디자인 작업 워크플로우

## 산출물 제공 필수 규칙 (2026-03-01)

### ❌ 절대 안 되는 것
- 코드만 작성하고 시각적 산출물 없이 전달
- 마크다운 문서만 제공
- "컴포넌트 코드 작성했습니다" 같은 보고

### ✅ 반드시 해야 하는 것
**디자인 산출물은 무조건 시각적으로 확인 가능한 형태로 제공**

1. **인터랙티브 프리뷰 (우선순위 1위)**
   - HTML 파일로 실제 동작하는 UI 제공
   - `workspace/preview/` 디렉토리에 저장
   - 인덱스 페이지 + 개별 페이지 구성
   - 로컬 파일 경로 또는 Canvas로 제공

2. **스크린샷/이미지 (우선순위 2위)**
   - 각 화면별 스크린샷 캡처
   - 주요 상태별 이미지 (정상/에러/로딩 등)

3. **프로토타입 링크 (우선순위 3위)**
   - CodePen / StackBlitz 등 온라인 플랫폼

### 표준 디렉토리 구조
```
workspace/
├── preview/                # 인터랙티브 프리뷰
│   ├── index.html         # 프리뷰 인덱스
│   ├── page1.html         # 개별 페이지
│   └── page2.html
├── screenshots/           # 스크린샷 (필요 시)
└── [project-name]-design.md  # 디자인 문서 (코드 포함)
```

### 제공 순서
1. **먼저**: 인터랙티브 프리뷰 파일 생성
2. **그 다음**: 파일 경로 공유 (또는 Canvas/Browser로 렌더링)
3. **마지막**: 디자인 문서 (기술 스펙, 타입 정의 등)

### Slack 보고 포맷
```
🎨 디자인 시안 완료!

📱 **인터랙티브 프리뷰**:
file:///Users/reus/.openclaw-designclaw/workspace/preview/index.html

**포함된 화면**:
- 계정 연동 페이지 (토큰 발급/입력)
- 포인트 교환 페이지 (금액 입력/확인 모달)
- 교환 내역 페이지 (리스트/페이지네이션)

📄 **디자인 문서**: workspace/[project]-design.md

브라우저에서 바로 열어서 확인 가능합니다!
```

## 웹 공유 방법 (필수!)

### GitHub Gist + htmlpreview.github.io (표준 방법)

**업로드 명령어**:
```bash
cd workspace/preview
gh gist create --public index.html [file1.html] [file2.html] -d "프로젝트명 - 디자인 프리뷰"
```

**공유 링크 생성**:
- Gist URL: `https://gist.github.com/reus-jeon/[gist-id]`
- 프리뷰 URL: `https://htmlpreview.github.io/?https://gist.githubusercontent.com/reus-jeon/[gist-id]/raw/[filename]`

**예시**:
```
Gist ID: cc8c23373a89396869fff9943294231d

프리뷰 링크:
- 인덱스: https://htmlpreview.github.io/?https://gist.githubusercontent.com/reus-jeon/cc8c23373a89396869fff9943294231d/raw/index.html
- 계정 연동: https://htmlpreview.github.io/?https://gist.githubusercontent.com/reus-jeon/cc8c23373a89396869fff9943294231d/raw/account-linking.html
```

**중요**: 로컬 파일 경로는 PC 간 공유 불가 → 반드시 Gist로 업로드!

## 주의사항
- **검토 전 이슈 생성 금지**: 디자인 승인 후 이슈 생성
- **실제 동작 필수**: 버튼/폼/모달이 실제로 작동해야 함
- **모바일 반응형 확인**: 작은 화면에서도 테스트
- **웹 공유 필수**: Gist + htmlpreview.github.io로 공유

## 교육 이력
- 2026-03-01 17:40: Reus — "디자인 요청했는데 구현 이슈부터 생성" 문제 지적
  - 규칙: 디자인 산출물 → 검토/승인 → 이슈 생성 순서 준수
- 2026-03-01 21:03: Reus — "로컬 파일은 PC 간 공유 불가, 웹으로 공유"
  - 해결: GitHub Gist + htmlpreview.github.io 표준 방법 적용
