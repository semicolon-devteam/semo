-- GFP → 프로젝트 파이프라인 용어 통합: skill_definitions 리네이밍
-- See: semicolon/decision/gfp-terminology-removal

UPDATE semo.skill_definitions
SET name = 'service-project-manager',
    prompt = REPLACE(prompt, '/api/gfp', '/api/projects')
WHERE name = 'gfp-manager';
