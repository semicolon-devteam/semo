# Changelog

All notable changes to sax-design will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-12-03

### Added

- Initial sax-design package structure
- `orchestrator` Agent - 디자인 작업 라우팅 및 위임
- `onboarding-master` Agent - 디자이너 온보딩 프로세스
- `design-master` Agent - 디자인 작업 총괄
- `health-check` Skill - 디자인 환경 검증
- `generate-mockup` Skill - UI 목업 생성
- `design-handoff` Skill - 디자인-개발 핸드오프 문서 생성
- `/SAX:onboarding` Command - 온보딩 시작
- `/SAX:health-check` Command - 환경 검증
- `/SAX:mockup` Command - 목업 생성
- `/SAX:handoff` Command - 핸드오프 문서 생성
- `.agent/` Antigravity 연동 템플릿

### Integration

- Claude Code + Antigravity 듀얼 설정 지원
- MCP 서버 연동 (playwright, magic, Framelink)
- Figma 연동 지원

[Unreleased]: https://github.com/semicolon-devteam/sax-design/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/semicolon-devteam/sax-design/releases/tag/v0.1.0
