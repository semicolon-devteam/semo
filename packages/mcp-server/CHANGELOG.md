# Changelog

All notable changes to semo-mcp will be documented in this file.

## [2.1.0] - 2025-12-12

### Added
- **암호화 토큰 시스템**: 팀 공용 토큰 암호화 내장
  - `crypto.ts`: AES-256-CBC 암호화/복호화 모듈
  - `tokens.ts`: 암호화된 토큰 저장소
  - `scripts/generate-tokens.js`: CI/CD용 토큰 생성 스크립트

### Changed
- **토큰 우선순위 적용**: 환경변수 > 암호화된 팀 토큰
- **보안 강화**: 하드코딩된 토큰 제거

### Security
- 소스코드에서 평문 토큰 제거
- CI/CD에서 암호화 토큰 생성 후 배포

## [2.0.0] - 2025-12-10

### Added
- Initial semo-mcp release
- Slack integration (send message, lookup user)
- GitHub integration (create issue, create PR)
- Supabase integration (query)
- SEMO Orchestrator routing
