# Changelog

All notable changes to semo-meta will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
