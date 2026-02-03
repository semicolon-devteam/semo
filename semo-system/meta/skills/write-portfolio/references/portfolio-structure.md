# Portfolio Structure

포트폴리오 디렉토리 구조 및 파일 컨벤션.

## Directory Structure

```
docs/portfolio/{project-name}/
├── images/
│   ├── screenshot-main.png        # 메인 페이지
│   ├── screenshot-{feature}.png   # 기능별 스크린샷
│   ├── screenshot-mobile-*.png    # 모바일 뷰
│   ├── architecture.png           # 아키텍처 다이어그램
│   └── logo.png                   # 프로젝트 로고
├── documents/
│   ├── PROPOSAL.md               # 프로젝트 제안서/기획서
│   ├── TECH_STACK.md             # 기술스택 상세 문서
│   ├── FEATURES.md               # 기능 명세
│   └── CHALLENGES.md             # 기술적 도전 (선택)
└── README.md                     # 포트폴리오 메인 문서
```

## File Naming Convention

| 유형 | 패턴 | 예시 |
|------|------|------|
| 메인 스크린샷 | `screenshot-main.png` | screenshot-main.png |
| 기능 스크린샷 | `screenshot-{feature}.png` | screenshot-dashboard.png |
| 모바일 스크린샷 | `screenshot-mobile-{page}.png` | screenshot-mobile-main.png |
| 다이어그램 | `{type}.png` | architecture.png, erd.png |

## project-name Convention

- **kebab-case**: 소문자, 하이픈 구분
- **예시**: `my-awesome-project`, `e-commerce-platform`

## GitHub Integration

대상 저장소: `semicolon-devteam/command-center`

```
command-center/
└── docs/
    └── portfolio/
        ├── project-a/
        ├── project-b/
        └── {new-project}/
```
