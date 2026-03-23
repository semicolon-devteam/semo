-- 020: bot_workspace_standard — 봇 워크스페이스 규격 SoT 테이블
-- v2.0 규격을 DB로 통합하여 MCP 도구/audit/셸 스크립트가 단일 소스에서 규칙 로드

CREATE TABLE IF NOT EXISTS semo.bot_workspace_standard (
  id              BIGSERIAL PRIMARY KEY,
  path_pattern    VARCHAR(255) NOT NULL,     -- "SOUL.md", ".claude/", "*.ovpn"
  entry_type      VARCHAR(20)  NOT NULL,     -- 'file' | 'dir' | 'symlink' | 'glob'
  level           VARCHAR(20)  NOT NULL,     -- 'required' | 'optional' | 'forbidden'
  severity        VARCHAR(10)  NOT NULL DEFAULT 'error',  -- 'error' | 'warn'
  category        VARCHAR(50)  NOT NULL DEFAULT 'structure', -- 'structure' | 'legacy' | 'hygiene'
  bot_scope       VARCHAR(20)  NOT NULL DEFAULT 'all',    -- 'all' | 'include' | 'exclude'
  bot_ids         TEXT[]       DEFAULT '{}',
  symlink_target  TEXT,                      -- 심링크 타겟 (템플릿: $HOME)
  content_rules   JSONB,                     -- 콘텐츠 검증 규칙
  description     TEXT,
  fix_action      VARCHAR(50),               -- 'create_file' | 'create_dir' | 'create_symlink' | null
  fix_template    TEXT,                      -- --fix 시 생성할 콘텐츠 ($BOT_ID 치환)
  spec_version    VARCHAR(20)  NOT NULL DEFAULT '2.0',
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (path_pattern, spec_version)
);

CREATE INDEX IF NOT EXISTS idx_bws_level ON semo.bot_workspace_standard(level);
CREATE INDEX IF NOT EXISTS idx_bws_version ON semo.bot_workspace_standard(spec_version);

-- ============================================================
-- Seed data (v2.0 규격 ~35행)
-- ============================================================

INSERT INTO semo.bot_workspace_standard (path_pattern, entry_type, level, severity, category, bot_scope, bot_ids, symlink_target, content_rules, description, fix_action, fix_template)
VALUES
  -- 필수 파일
  ('SOUL.md', 'file', 'required', 'error', 'structure', 'all', '{}', NULL,
   '{"max_lines": 120, "required_sections": ["## Identity", "## R&R", "## KB Lookup", "## Operating Procedures", "## NON-NEGOTIABLE"], "forbidden_patterns": ["U[0-9A-Z]{8,11}", "C[0-9A-Z]{8,11}"]}'::jsonb,
   '봇 페르소나 + R&R + 행동강령', 'create_file',
   '# $BOT_ID — SOUL\n\n## Identity\n\n> TODO\n\n## R&R\n\n> TODO\n\n## KB Lookup\n\n> kb_get/kb_search로 팀 정보 조회\n\n## Operating Procedures\n\n> TODO\n\n## NON-NEGOTIABLE\n\n1. TODO'),

  ('AGENTS.md', 'symlink', 'required', 'error', 'structure', 'all', '{}',
   '$HOME/.openclaw-shared/AGENTS.md',
   '{"max_lines": 150, "required_patterns": ["Every Session", "KB-First"]}'::jsonb,
   '공통 세션 운영 규칙 (심링크)', 'create_symlink', NULL),

  ('USER.md', 'file', 'required', 'error', 'structure', 'all', '{}', NULL,
   '{"max_lines": 15}'::jsonb,
   '사용자 컨텍스트', 'create_file',
   '# USER\n\n> TODO: $BOT_ID 사용자 정보'),

  ('MEMORY.md', 'file', 'required', 'error', 'structure', 'all', '{}', NULL,
   '{"max_lines": 30, "required_patterns": ["KB SoT|KB.*SoT|Single Source"]}'::jsonb,
   'KB 도메인 인덱스 (main 세션만)', 'create_file',
   '# MEMORY\n\n> KB SoT — 팀 정보는 kb_search/kb_get으로 조회'),

  ('HEARTBEAT.md', 'file', 'required', 'error', 'structure', 'include', '{semiclaw}', NULL,
   NULL,
   '크론 작업 정의 (semiclaw 전용)', NULL, NULL),

  ('.claude/settings.json', 'file', 'required', 'error', 'structure', 'all', '{}', NULL,
   '{"required_patterns": ["semo-kb"]}'::jsonb,
   'MCP 서버 설정', NULL, NULL),

  -- 필수 디렉토리
  ('.claude/', 'dir', 'required', 'error', 'structure', 'all', '{}', NULL, NULL,
   'Claude 설정 디렉토리', 'create_dir', NULL),

  ('hooks/', 'dir', 'required', 'error', 'structure', 'all', '{}', NULL, NULL,
   'OpenClaw 훅', 'create_dir', NULL),

  ('memory/', 'dir', 'required', 'error', 'structure', 'all', '{}', NULL, NULL,
   '일일로그 디렉토리', 'create_dir', NULL),

  ('skills/', 'dir', 'required', 'error', 'structure', 'all', '{}', NULL, NULL,
   '봇 전용 스킬', 'create_dir', NULL),

  -- 선택 디렉토리/파일
  ('scripts/', 'dir', 'optional', 'warn', 'structure', 'all', '{}', NULL, NULL,
   '유틸리티 스크립트', NULL, NULL),

  ('shared/', 'dir', 'optional', 'warn', 'structure', 'all', '{}', NULL, NULL,
   '공유 리소스 (심링크)', NULL, NULL),

  ('.gh-pat', 'file', 'optional', 'warn', 'structure', 'all', '{}', NULL, NULL,
   'GitHub PAT 파일', NULL, NULL),

  ('.gitignore', 'file', 'optional', 'warn', 'structure', 'all', '{}', NULL, NULL,
   'Git ignore', NULL, NULL),

  -- 레거시 파일 (금지)
  ('IDENTITY.md', 'file', 'forbidden', 'error', 'legacy', 'all', '{}', NULL, NULL,
   'v1 레거시 — SOUL.md ## Identity로 대체됨', NULL, NULL),

  ('TOOLS.md', 'file', 'forbidden', 'error', 'legacy', 'all', '{}', NULL, NULL,
   'v1 레거시 — KB lookup 지시로 대체', NULL, NULL),

  ('RULES.md', 'file', 'forbidden', 'error', 'legacy', 'all', '{}', NULL, NULL,
   'v1 레거시 — SOUL.md ## NON-NEGOTIABLE로 통합', NULL, NULL),

  ('CLAUDE.md', 'file', 'forbidden', 'warn', 'legacy', 'all', '{}', NULL, NULL,
   'v1 레거시 — 프로젝트 .claude/CLAUDE.md에 이미 존재', NULL, NULL),

  ('BOOTSTRAP.md', 'file', 'forbidden', 'warn', 'legacy', 'all', '{}', NULL, NULL,
   'v1 레거시', NULL, NULL),

  -- 위생 (금지)
  ('*/.git', 'glob', 'forbidden', 'error', 'hygiene', 'all', '{}', NULL, NULL,
   '클론된 리포 — workspace에 git clone 금지', NULL, NULL),

  ('node_modules', 'glob', 'forbidden', 'error', 'hygiene', 'all', '{}', NULL, NULL,
   'npm install 산출물', NULL, NULL),

  ('dist/', 'dir', 'forbidden', 'error', 'hygiene', 'all', '{}', NULL, NULL,
   '빌드 산출물', NULL, NULL),

  ('build/', 'dir', 'forbidden', 'error', 'hygiene', 'all', '{}', NULL, NULL,
   '빌드 산출물', NULL, NULL),

  ('.next/', 'dir', 'forbidden', 'error', 'hygiene', 'all', '{}', NULL, NULL,
   'Next.js 빌드 산출물', NULL, NULL),

  ('out/', 'dir', 'forbidden', 'error', 'hygiene', 'all', '{}', NULL, NULL,
   '빌드 산출물', NULL, NULL),

  ('*.ovpn', 'glob', 'forbidden', 'warn', 'hygiene', 'all', '{}', NULL, NULL,
   'VPN 설정 파일 — 보안', NULL, NULL),

  ('*.pem', 'glob', 'forbidden', 'warn', 'hygiene', 'all', '{}', NULL, NULL,
   '인증서 파일 — 보안', NULL, NULL),

  ('*.key', 'glob', 'forbidden', 'warn', 'hygiene', 'all', '{}', NULL, NULL,
   '비밀키 파일 — 보안', NULL, NULL),

  ('credentials/', 'dir', 'forbidden', 'warn', 'hygiene', 'all', '{}', NULL, NULL,
   '인증 정보 디렉토리', NULL, NULL),

  ('*.png', 'glob', 'forbidden', 'warn', 'hygiene', 'all', '{}', NULL, NULL,
   '바이너리 이미지 파일', NULL, NULL),

  ('*.jpg', 'glob', 'forbidden', 'warn', 'hygiene', 'all', '{}', NULL, NULL,
   '바이너리 이미지 파일', NULL, NULL),

  ('*.zip', 'glob', 'forbidden', 'warn', 'hygiene', 'all', '{}', NULL, NULL,
   '압축 파일', NULL, NULL),

  ('*.tgz', 'glob', 'forbidden', 'warn', 'hygiene', 'all', '{}', NULL, NULL,
   '압축 파일', NULL, NULL),

  ('temp/', 'glob', 'forbidden', 'warn', 'hygiene', 'all', '{}', NULL, NULL,
   '임시 디렉토리', NULL, NULL),

  ('tmp/', 'glob', 'forbidden', 'warn', 'hygiene', 'all', '{}', NULL, NULL,
   '임시 디렉토리', NULL, NULL),

  ('*.tmp', 'glob', 'forbidden', 'warn', 'hygiene', 'all', '{}', NULL, NULL,
   '임시 파일', NULL, NULL),

  ('go.mod', 'file', 'forbidden', 'warn', 'hygiene', 'all', '{}', NULL, NULL,
   'Go 모듈 파일 — workspace에 불필요', NULL, NULL),

  ('go.sum', 'file', 'forbidden', 'warn', 'hygiene', 'all', '{}', NULL, NULL,
   'Go 체크섬 파일 — workspace에 불필요', NULL, NULL)

ON CONFLICT (path_pattern, spec_version) DO UPDATE SET
  entry_type     = EXCLUDED.entry_type,
  level          = EXCLUDED.level,
  severity       = EXCLUDED.severity,
  category       = EXCLUDED.category,
  bot_scope      = EXCLUDED.bot_scope,
  bot_ids        = EXCLUDED.bot_ids,
  symlink_target = EXCLUDED.symlink_target,
  content_rules  = EXCLUDED.content_rules,
  description    = EXCLUDED.description,
  fix_action     = EXCLUDED.fix_action,
  fix_template   = EXCLUDED.fix_template,
  updated_at     = NOW();
