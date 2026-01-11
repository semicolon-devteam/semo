-- SEMO Package Definitions 시드 데이터
-- Standard + Extension 패키지 정보

-- Standard 패키지 (필수)
INSERT INTO package_definitions (name, display_name, description, layer, package_type, source_path, is_required, install_order, version) VALUES
  ('semo-core', 'SEMO Core', '원칙, 오케스트레이터, 공통 커맨드', 'standard', 'standard', 'semo-system/semo-core', true, 10, '3.8.0'),
  ('semo-skills', 'SEMO Skills', '13개 통합 스킬 (coder, tester, planner 등)', 'standard', 'standard', 'semo-system/semo-skills', true, 20, '3.8.0'),
  ('semo-scripts', 'SEMO Scripts', '자동화 스크립트', 'standard', 'standard', 'semo-system/semo-scripts', true, 30, '3.8.0')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  source_path = EXCLUDED.source_path,
  version = EXCLUDED.version,
  updated_at = NOW();

-- Business Layer Extension
INSERT INTO package_definitions (name, display_name, description, layer, package_type, source_path, aliases, install_order, version) VALUES
  ('biz/discovery', 'Discovery', '아이템 발굴, 시장 조사, Epic/Task', 'biz', 'extension', 'semo-system/biz/discovery', ARRAY['discovery'], 100, '1.0.0'),
  ('biz/design', 'Design', '컨셉 설계, 목업, UX', 'biz', 'extension', 'semo-system/biz/design', ARRAY['design'], 101, '1.0.0'),
  ('biz/management', 'Management', '일정/인력/스프린트 관리', 'biz', 'extension', 'semo-system/biz/management', ARRAY['management'], 102, '1.0.0'),
  ('biz/poc', 'PoC', '빠른 PoC, 패스트트랙', 'biz', 'extension', 'semo-system/biz/poc', ARRAY['poc', 'mvp'], 103, '1.0.0')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  aliases = EXCLUDED.aliases,
  updated_at = NOW();

-- Engineering Layer Extension
INSERT INTO package_definitions (name, display_name, description, layer, package_type, source_path, detect_files, aliases, install_order, version) VALUES
  ('eng/nextjs', 'Next.js', 'Next.js 프론트엔드 개발', 'eng', 'extension', 'semo-system/eng/nextjs', ARRAY['next.config.js', 'next.config.mjs', 'next.config.ts'], ARRAY['nextjs', 'next'], 110, '1.0.0'),
  ('eng/spring', 'Spring', 'Spring Boot 백엔드 개발', 'eng', 'extension', 'semo-system/eng/spring', ARRAY['pom.xml', 'build.gradle'], ARRAY['spring', 'backend'], 111, '1.0.0'),
  ('eng/ms', 'Microservice', '마이크로서비스 아키텍처', 'eng', 'extension', 'semo-system/eng/ms', ARRAY[]::TEXT[], ARRAY['ms'], 112, '1.0.0'),
  ('eng/infra', 'Infra', '인프라/배포 관리', 'eng', 'extension', 'semo-system/eng/infra', ARRAY['docker-compose.yml', 'Dockerfile'], ARRAY['infra'], 113, '1.0.0')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  detect_files = EXCLUDED.detect_files,
  aliases = EXCLUDED.aliases,
  updated_at = NOW();

-- Operations Layer Extension
INSERT INTO package_definitions (name, display_name, description, layer, package_type, source_path, aliases, install_order, version) VALUES
  ('ops/qa', 'QA', '테스트/품질 관리', 'ops', 'extension', 'semo-system/ops/qa', ARRAY['qa'], 120, '1.0.0'),
  ('ops/monitor', 'Monitor', '서비스 현황 모니터링', 'ops', 'extension', 'semo-system/ops/monitor', ARRAY['monitor'], 121, '1.0.0'),
  ('ops/improve', 'Improve', '개선 제안', 'ops', 'extension', 'semo-system/ops/improve', ARRAY['improve'], 122, '1.0.0')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  aliases = EXCLUDED.aliases,
  updated_at = NOW();

-- Meta Layer
INSERT INTO package_definitions (name, display_name, description, layer, package_type, source_path, detect_files, aliases, install_order, version) VALUES
  ('meta', 'Meta', 'SEMO 프레임워크 자체 개발/관리', 'meta', 'extension', 'semo-system/meta', ARRAY['semo-core', 'semo-skills'], ARRAY[]::TEXT[], 200, '3.8.0')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  detect_files = EXCLUDED.detect_files,
  version = EXCLUDED.version,
  updated_at = NOW();

-- System Layer
INSERT INTO package_definitions (name, display_name, description, layer, package_type, source_path, aliases, install_order, version) VALUES
  ('semo-hooks', 'Hooks', 'Claude Code Hooks 기반 로깅 시스템', 'system', 'extension', 'semo-system/semo-hooks', ARRAY['hooks'], 210, '1.0.0'),
  ('semo-remote', 'Remote', 'Claude Code 원격 제어 (모바일 PWA)', 'system', 'extension', 'semo-system/semo-remote', ARRAY['remote'], 211, '1.0.0')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  aliases = EXCLUDED.aliases,
  updated_at = NOW();
