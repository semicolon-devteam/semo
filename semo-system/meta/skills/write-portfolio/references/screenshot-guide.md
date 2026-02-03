# Screenshot Guide

Playwright MCP를 활용한 서비스 스크린샷 캡처 가이드.

## Playwright MCP Tools

### 1. 페이지 접속

```
mcp__playwright__playwright_navigate
├── url: {service-url}
├── width: 1280
├── height: 720
└── waitUntil: "networkidle"
```

### 2. 스크린샷 캡처

```
mcp__playwright__playwright_screenshot
├── name: "screenshot-main"
├── fullPage: false          # 뷰포트만
├── savePng: true
└── downloadsDir: "{portfolio-path}/images"
```

### 3. 반응형 캡처

```
mcp__playwright__playwright_resize
├── device: "iPhone 13"      # 또는 width/height 직접 지정
└── orientation: "portrait"

→ 이후 screenshot 호출
```

## 캡처 시나리오

### 기본 캡처 세트

| 순서 | 페이지 | 파일명 |
|------|--------|--------|
| 1 | 메인/랜딩 | screenshot-main.png |
| 2 | 로그인 (있으면) | screenshot-login.png |
| 3 | 대시보드/홈 | screenshot-dashboard.png |
| 4 | 핵심 기능 1 | screenshot-feature-1.png |
| 5 | 핵심 기능 2 | screenshot-feature-2.png |

### 모바일 캡처 (선택)

```
1. playwright_resize → device: "iPhone 13"
2. playwright_screenshot → screenshot-mobile-main.png
3. 주요 화면 반복
```

## 캡처 팁

### 인증이 필요한 경우

```
사용자에게 요청:
1. 테스트 계정 정보
2. 또는 직접 스크린샷 제공 요청
```

### 동적 콘텐츠

```
playwright_evaluate
└── script: "await new Promise(r => setTimeout(r, 2000))"

→ 콘텐츠 로딩 대기 후 캡처
```

### 특정 요소만 캡처

```
mcp__playwright__playwright_screenshot
├── selector: ".hero-section"  # CSS 선택자
└── name: "hero-section"
```

## 저장 경로

```
docs/portfolio/{project-name}/images/
├── screenshot-main.png
├── screenshot-dashboard.png
├── screenshot-feature-1.png
├── screenshot-mobile-main.png
└── ...
```

## 에러 처리

| 상황 | 대응 |
|------|------|
| URL 접근 불가 | 사용자에게 스크린샷 직접 요청 |
| 인증 필요 | 테스트 계정 또는 직접 제공 요청 |
| 동적 로딩 실패 | 대기 시간 늘리기, 재시도 |
| 캡처 저장 실패 | 경로 확인, 권한 확인 |
