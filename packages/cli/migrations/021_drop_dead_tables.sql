-- 021: Drop dead tables
-- bot_kb_subscriptions: 코드 참조 0건, kb_digest since 파라미터로 대체
-- bot_knowledge: 012에서 DROP 선언되었으나 잔존 가능
-- kb_usage_log: 코드 참조 0건, 계획만 있고 미구현

DROP TABLE IF EXISTS semo.bot_kb_subscriptions;
DROP TABLE IF EXISTS semo.bot_knowledge;
DROP TABLE IF EXISTS semo.kb_usage_log;
