-- 029: AGENTS.md max_lines 150 → 155 (citation + 쓰기 고지 규칙 추가로 줄 수 증가)
UPDATE semo.bot_workspace_standard
SET content_rules = jsonb_set(content_rules, '{max_lines}', '155'),
    updated_at = NOW()
WHERE path_pattern = 'AGENTS.md'
  AND spec_version = '2.0';
