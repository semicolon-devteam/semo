-- Migration 012: Drop bot_knowledge and bot_kb_subscriptions
-- bot_knowledge 데이터를 knowledge_base로 이관 후 테이블 DROP.
-- 봇 프라이빗 KB를 폐기하고 knowledge_base 단일 테이블로 통일.

-- 1. bot_knowledge → knowledge_base 이관 (중복 시 skip)
INSERT INTO semo.knowledge_base (domain, key, content, metadata, embedding, created_by)
SELECT domain, key, content, metadata, embedding, bot_id AS created_by
FROM semo.bot_knowledge
ON CONFLICT (domain, key) DO NOTHING;

-- 2. 테이블 DROP
DROP TABLE IF EXISTS semo.bot_knowledge;
DROP TABLE IF EXISTS semo.bot_kb_subscriptions;

-- 3. bot:* 온톨로지 제거 (봇 프라이빗 KB 폐기로 불필요)
DELETE FROM semo.ontology WHERE domain LIKE 'bot:%';
