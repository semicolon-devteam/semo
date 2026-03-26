-- 032_kebab_case_keys.sql
-- KB 스키마 키 네이밍 컨벤션 통일: snake_case → kebab-case
-- 영향: kb_type_schema (스키마 정의) + knowledge_base (실제 엔트리)

BEGIN;

-- ============================================================
-- 1. kb_type_schema: 스키마 키 이름 변환
-- ============================================================

UPDATE semo.kb_type_schema SET scheme_key = 'base-information'    WHERE scheme_key = 'base_information';
UPDATE semo.kb_type_schema SET scheme_key = 'current-situation'   WHERE scheme_key = 'current_situation';
UPDATE semo.kb_type_schema SET scheme_key = 'service-url'         WHERE scheme_key = 'service_url';
UPDATE semo.kb_type_schema SET scheme_key = 'tech-stack'          WHERE scheme_key = 'tech_stack';
UPDATE semo.kb_type_schema SET scheme_key = 'slack-channel'       WHERE scheme_key = 'slack_channel';
UPDATE semo.kb_type_schema SET scheme_key = 'gateway-config'      WHERE scheme_key = 'gateway_config';
UPDATE semo.kb_type_schema SET scheme_key = 'cron-schedule'       WHERE scheme_key = 'cron_schedule';
UPDATE semo.kb_type_schema SET scheme_key = 'slack-config'        WHERE scheme_key = 'slack_config';

-- ============================================================
-- 2. knowledge_base: 실제 엔트리 key 변환
-- ============================================================

UPDATE semo.knowledge_base SET key = 'base-information'    WHERE key = 'base_information';
UPDATE semo.knowledge_base SET key = 'current-situation'   WHERE key = 'current_situation';
UPDATE semo.knowledge_base SET key = 'service-url'         WHERE key = 'service_url';
UPDATE semo.knowledge_base SET key = 'tech-stack'          WHERE key = 'tech_stack';
UPDATE semo.knowledge_base SET key = 'slack-channel'       WHERE key = 'slack_channel';
UPDATE semo.knowledge_base SET key = 'gateway-config'      WHERE key = 'gateway_config';
UPDATE semo.knowledge_base SET key = 'cron-schedule'       WHERE key = 'cron_schedule';
UPDATE semo.knowledge_base SET key = 'slack-config'        WHERE key = 'slack_config';

COMMIT;
