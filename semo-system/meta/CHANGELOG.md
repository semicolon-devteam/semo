# Changelog

All notable changes to semo-meta will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.52.0] - 2025-12-12

### Added
- **CLAUDE.md 템플릿** (`semo-core/templates/CLAUDE.md`)
  - Orchestrator-First Policy 포함 표준 템플릿
  - 카테고리별 라우팅 테이블 내장
  - 배포 및 업데이트 시 자동 적용
- **Orchestrator-First 테스트 케이스** (`semo-core/tests/cases/`)
  - `orchestrator-first.json` - Skill 라우팅 검증
  - `agent-routing.json` - Agent 호출 검증
- `/SEMO:onboarding` 커맨드 - 신규 개발자 온보딩 자동화

### Changed
- `package-deploy` Skill - CLAUDE.md 자동 설정 프로세스 추가
- `/SEMO:update` 커맨드 - CLAUDE.md 동기화 단계 추가
- `version-updater` Skill - Phase 1.5 CLAUDE.md 동기화 추가

## [0.51.0] - 2025-12-11

### Added
- `/SEMO:*` 커맨드 추가 (SEMO 커맨드와 병행)
  - `/SEMO:help`, `/SEMO:slack`, `/SEMO:update`, `/SEMO:feedback`, `/SEMO:audit`, `/SEMO:health`
- `scripts/sax-to-semo-migrate.sh` - SEMO → SEMO 마이그레이션 스크립트
- `docs/SAX_TO_SEMO_MIGRATION.md` - 마이그레이션 가이드

### Changed
- CLAUDE.md 공통 커맨드 섹션 업데이트 (SEMO 커맨드 권장)

## [0.50.0] - 2025-12-11

### Added
- `docs/SEMO_NAMING_CONVENTION.md` - SEMO → SEMO 리브랜딩 용어 매핑 및 전환 가이드
- Context Mesh 섹션 (CLAUDE.md) - 전체 아키텍처 뷰 및 패키지 라우팅

### Changed
- SEMO 정의 수정: "Semicolon Agent eXperience" → "Semicolon AI Transformation"
- SEMO 명확화 블록 추가 (모든 CLAUDE.md)

## [0.49.0] - 2025-12-10

### Added
- Initial semo-meta package setup
