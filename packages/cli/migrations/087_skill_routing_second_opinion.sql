-- 087: second-opinion 스킬 라우팅 등록

INSERT INTO semo.bot_delegation (from_bot_id, to_bot_id, delegation_type, domains, method, metadata)
VALUES
  ('orchestrator', 'reviewclaw', 'skill-routing',
    ARRAY['second-opinion','세컨드 오피니언','cross-model','교차 검증','/second-opinion'],
    'keyword', '{"skill":"second-opinion","label":"second-opinion"}')
ON CONFLICT DO NOTHING;
