-- 086: 신규 스킬 6종 라우팅 등록

INSERT INTO semo.bot_delegation (from_bot_id, to_bot_id, delegation_type, domains, method, metadata)
VALUES
  ('orchestrator', 'reviewclaw', 'skill-routing',
    ARRAY['/security-scan','보안 스캔','security scan','취약점 점검','OWASP','시크릿 스캔','secret scan','npm audit'],
    'keyword', '{"skill":"security-scan","label":"security-scan"}'),
  ('orchestrator', 'reviewclaw', 'skill-routing',
    ARRAY['테스트 생성','test generate','테스트 만들어','add tests','missing tests','테스트 커버리지'],
    'keyword', '{"skill":"test-generator","label":"test-generator"}'),
  ('orchestrator', 'designclaw', 'skill-routing',
    ARRAY['visual qa','visual-qa','/visual-qa','시각 QA','레이아웃 점검','UI 검증','스크린샷 비교','visual regression'],
    'keyword', '{"skill":"visual-qa","label":"visual-qa"}'),
  ('orchestrator', 'growthclaw', 'skill-routing',
    ARRAY['/seo-check','seo crawl','seo 크롤링','메타태그 점검','on-page seo','heading 점검','sitemap 확인'],
    'keyword', '{"skill":"seo-crawl","label":"seo-crawl"}'),
  ('orchestrator', 'infraclaw', 'skill-routing',
    ARRAY['/canary-check','canary check','배포 후 점검','post-deploy check','카나리 체크','서비스 헬스체크','deploy health'],
    'keyword', '{"skill":"canary-monitor","label":"canary-monitor"}'),
  ('orchestrator', 'workclaw', 'skill-routing',
    ARRAY['migration verify','마이그레이션 검증','migration 검증','migration check','마이그레이션 점검','db migration'],
    'keyword', '{"skill":"migration-verify","label":"migration-verify"}')
ON CONFLICT DO NOTHING;
