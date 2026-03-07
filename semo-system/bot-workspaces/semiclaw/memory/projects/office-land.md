# 오피스랜드 (cm-office) 이슈 & 특이사항

## 배포 역할 분담 (2026-03-02 미팅)
- **bon**: 배포 시 프로덕트 태깅까지 담당
- **Goni**: 태깅 이후 다음 단계 담당
- 출처: Roki 전달 (3/3)

## 이미지 최적화 이슈 (2026-02-14)
- **제기**: Garden, #proj-office-land 16:23 (스레드 13개, Roki/kyago/Reus/bon 참여)
- **핵심**: 이미지 캐싱이 아닌 **미디어 파일 자체 최적화** 필요
- **히스토리**:
  - 1/25: bon — 게시글 이미지 미노출 수정, 파일서버 이슈, dev/stg 파일업로드 안됨 (Supabase 직접업로드 에러)
  - 1/25: GitHub #240 — 업로드 이미지 게시글 미노출 버그 (High)
  - 1/26: Garden — DEV/STG 정상화 완료
  - 1/26: bon — Supabase `getPublicUrl`에서 배포 환경 `internal:8000` URL 문제
  - 2/14: Garden — 근본 원인인 미디어 파일 최적화 필요 판단
- **다음 액션**: bon 기존 로직 분석 → 작업 계획 공유, Roki GitHub 이슈 등록
- Reus, bon ✅ 확인 완료
