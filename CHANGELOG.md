# Changelog

All notable changes to sax-core will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.30.0] - 2025-12-11

### Added
- `evaluation/` - Promptfoo 기반 Agentic Evaluation 시스템
  - `promptfoo.yaml` - 평가 설정 (sax-next 파일럿)
  - `prompts/` - 프롬프트 템플릿 (code-generation, bug-fix, component-creation)
  - `metrics.md` - Pass@k 메트릭 정의
- `security/SECURITY_AUDIT.md` - 보안 감사 보고서
- Doppler MCP 설정 가이드 (`_shared/mcp-config.md`)

### Security
- Slack Bot Token 하드코딩 이슈 식별 및 마이그레이션 계획 수립
- 중앙 집중식 비밀 관리 (Doppler) 도입 권장

## [0.24.0] - 2025-12-11

### Added
- `skill:circuit-breaker` - 무한 루프 및 토큰 폭주 방지를 위한 서킷 브레이커
- `_shared/package-index.md` - SEMO 패키지 인덱스 및 라우팅 가이드

### Changed
- SAX 정의 수정: "Semicolon Agent eXperience" → "Semicolon AI Transformation"
- SEMO 명확화 블록 추가 (모든 CLAUDE.md)

## [0.23.0] - 2025-12-10

### Added
- Initial release with core principles and message rules
