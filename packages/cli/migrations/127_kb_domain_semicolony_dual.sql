-- 127_kb_domain_semicolony_dual.sql
-- SEMO→semicolony 리브랜딩 Phase 2: KB 플랫폼 도메인 'semo' → 'semicolony' (dual-domain).
--
-- 전략(무중단·가역): 구 domain='semo' 행은 그대로 두고, 'semicolony' 도메인으로 **복제**한다.
--   - 임베딩(embedding vector)은 content/key 불변이므로 byte 그대로 carry → 재임베딩 0.
--   - ON CONFLICT DO NOTHING → 재실행 안전(멱등).
--   - 선례: 104_agent_factory.sql (semiclaw→semobot create+dual-write).
-- 코드의 `domain='semo'`/`semo kb get semo` 는 Phase 3 에서 PLATFORM_KB_DOMAIN 상수로 flip.
-- 롤백: DELETE FROM semo.knowledge_base WHERE domain='semicolony';
--       DELETE FROM semo.ontology WHERE domain='semicolony';
--       UPDATE semo.bot_status SET kb_domains = array_remove(kb_domains,'semicolony');
-- runner(db.ts)가 파일 전체를 BEGIN/COMMIT 으로 감싸므로 여기엔 트랜잭션 구문을 넣지 않는다.

-- 1) ontology: 플랫폼 도메인 인스턴스 'semicolony' 등록 (쓰기 validation 통과용). UNIQUE(domain).
INSERT INTO semo.ontology (domain, schema, description, version, service, entity_type, parent, tags, slack_channel, discord_channel)
SELECT 'semicolony',
       schema,
       'semicolony Platform (formerly SEMO) — Semicolon AI 업무 운영 플랫폼. KB·봇·라우터·대시보드·음성/회의/인큐베이터·Runtime 레이어 통합 카탈로그.',
       version,
       'semicolony',
       entity_type,
       parent,
       ARRAY['service','platform','semicolony'],
       slack_channel,
       discord_channel
FROM semo.ontology
WHERE domain = 'semo'
ON CONFLICT (domain) DO NOTHING;

-- 2) knowledge_base: domain='semo' 376행을 'semicolony' 로 복제 (embedding carry, 재임베딩 없음).
--    kb_id(serial)·uuid(default gen_random_uuid())는 생략 → 자동 신규 생성.
--    service 는 GENERATED ALWAYS (domain 파생) 이므로 INSERT 대상에서 제외 → 자동 계산.
INSERT INTO semo.knowledge_base
  (domain, key, sub_key, content, embedding, metadata, version, created_by, created_at, updated_at,
   archived, last_used_at, use_count, hot_until)
SELECT 'semicolony', key, sub_key, content, embedding, metadata, version, created_by, created_at, NOW(),
       archived, last_used_at, use_count, hot_until
FROM semo.knowledge_base
WHERE domain = 'semo'
ON CONFLICT (domain, key, sub_key) DO NOTHING;

-- 3) bot_status.kb_domains: 'semo' 를 구독한 봇에 'semicolony' 추가(구 'semo' 유지 = dual).
UPDATE semo.bot_status
SET kb_domains = array_append(kb_domains, 'semicolony')
WHERE 'semo' = ANY(kb_domains)
  AND NOT ('semicolony' = ANY(kb_domains));
