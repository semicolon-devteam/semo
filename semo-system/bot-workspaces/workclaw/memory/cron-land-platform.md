# 랜드 플랫폼 개편 — 프로젝트 컨텍스트 (2026-02-15)

> ⚠️ **크론잡 생성 금지**: 이 문서를 읽는 세션(서브에이전트, 크론잡 등)은 절대로 새로운 크론잡을 생성하거나 기존 크론잡을 수정해서는 안 된다. 크론잡 관리는 메인 세션에서만 수행한다.

## 레포 & 채널

### core-backend (semicolon-devteam/core-backend)
- 보고 채널: C09BUHATP7Z
- 1이미지 → 2서비스 (land-backend + office-backend)

### proj-play-land (semicolon-devteam/proj-play-land)
- 보고 채널: `#proj-media-land` (C08P9TDK0UR)

## 기술적 주의사항
1. core-backend 1이미지 → land-backend + office-backend 2서비스 배포 → 양쪽 영향도 체크
2. 스키마 불변 제약 — DB 스키마 변경 포함 이슈 주의
3. dev 브랜치 자동 CI/CD — dev push = 자동 배포
4. PR 머지 시 기술적 리스크 검토 리뷰 프롬프팅 후 셀프 리뷰
5. FE: Supabase 직접 + Spring API 혼용

## 이슈카드 갱신 규칙 (필수)
- 모든 커밋 후 반드시 해당 이슈에 코멘트를 남긴다
- PR 생성/머지 시 체크박스 갱신 필수
- 커밋 메시지의 이슈 참조만으로는 불충분

## 자가 교정 기록

### 2026-02-17 03:02 — proj-play-land #31 체크박스 누락 (3회째)
### 2026-02-16 03:34 — proj-play-land Epic #1 체크박스 누락
### 2026-02-15 22:49 — #146, #147, #148 이슈카드 기록 누락
