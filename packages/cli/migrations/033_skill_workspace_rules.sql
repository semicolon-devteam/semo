-- 033_skill_workspace_rules.sql
-- 스킬 디렉토리 SKILL.md 검증 규칙을 bot_workspace_standard에 추가

INSERT INTO semo.bot_workspace_standard
  (path_pattern, entry_type, level, severity, category, bot_scope, content_rules, description, spec_version)
VALUES
  ('skills/*/SKILL.md', 'glob', 'required', 'warn', 'structure', 'all',
   '{"max_lines": 500, "required_patterns": ["^---"]}',
   '각 스킬에 SKILL.md 필수 (frontmatter + 500줄 이하)', '2.0')
ON CONFLICT DO NOTHING;
