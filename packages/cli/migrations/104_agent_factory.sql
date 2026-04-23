-- 104: Agent Factory 기반 마련
-- 1) bot_status에 Factory 메타 컬럼 추가 (slack/kb/budget/template 하드코딩 제거 준비)
-- 2) bot_id_aliases: 불변 bot_id + 표시명 변경을 위한 별칭 테이블
-- 3) bot_seats: Claude Max seat 물리/논리 분리 (런타임 동적 할당)
-- 4) semiclaw → semobot 리브랜드 1단계 (새 row + alias 활성화)
-- 5) NOTIFY 트리거: bot_status / bot_delegation / bot_id_aliases 변경 시 핫 리로드 시그널

BEGIN;

-- ============================================================
-- 1. bot_status 컬럼 확장
-- ============================================================

ALTER TABLE semo.bot_status
  ADD COLUMN IF NOT EXISTS kb_domains         TEXT[],
  ADD COLUMN IF NOT EXISTS budget_per_message NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS slack_username     TEXT,
  ADD COLUMN IF NOT EXISTS slack_icon_emoji   TEXT,
  ADD COLUMN IF NOT EXISTS created_by_bot_id  TEXT,
  ADD COLUMN IF NOT EXISTS template_bot_id    TEXT;

-- 백필 — 기존 하드코딩 맵(packages/common/src/slack/bot-config.ts)을 DB로 이식
--   kb_domains: orchestrator는 빈 배열(전체 허용), 나머지는 명시적 리스트
--   budget_per_message: 봇별 기본 예산
--   slack_username/icon_emoji: FALLBACK_SLACK_PROFILES
UPDATE semo.bot_status SET
  kb_domains         = '{}',
  budget_per_message = 1.5,
  slack_username     = 'SemiClaw',
  slack_icon_emoji   = ':clipboard:',
  created_by_bot_id  = '__genesis__'
WHERE bot_id = 'semiclaw';

UPDATE semo.bot_status SET
  kb_domains         = ARRAY['semicolon','semo'],
  budget_per_message = 1.0,
  slack_username     = 'PlanClaw',
  slack_icon_emoji   = ':bar_chart:',
  created_by_bot_id  = '__genesis__'
WHERE bot_id = 'planclaw';

UPDATE semo.bot_status SET
  kb_domains         = ARRAY['semicolon'],
  budget_per_message = 1.0,
  slack_username     = 'DesignClaw',
  slack_icon_emoji   = ':art:',
  created_by_bot_id  = '__genesis__'
WHERE bot_id = 'designclaw';

UPDATE semo.bot_status SET
  kb_domains         = ARRAY['semicolon'],
  budget_per_message = 1.5,
  slack_username     = 'WorkClaw',
  slack_icon_emoji   = ':hammer_and_wrench:',
  created_by_bot_id  = '__genesis__'
WHERE bot_id = 'workclaw';

UPDATE semo.bot_status SET
  kb_domains         = ARRAY['semicolon'],
  budget_per_message = 0.8,
  slack_username     = 'ReviewClaw',
  slack_icon_emoji   = ':mag:',
  created_by_bot_id  = '__genesis__'
WHERE bot_id = 'reviewclaw';

UPDATE semo.bot_status SET
  kb_domains         = ARRAY['semicolon','semo'],
  budget_per_message = 1.0,
  slack_username     = 'InfraClaw',
  slack_icon_emoji   = ':gear:',
  created_by_bot_id  = '__genesis__'
WHERE bot_id = 'infraclaw';

UPDATE semo.bot_status SET
  kb_domains         = ARRAY['semicolon'],
  budget_per_message = 0.5,
  slack_username     = 'GrowthClaw',
  slack_icon_emoji   = ':chart_with_upwards_trend:',
  created_by_bot_id  = '__genesis__'
WHERE bot_id = 'growthclaw';

UPDATE semo.bot_status SET
  kb_domains         = ARRAY['semicolon'],
  budget_per_message = 1.0,
  slack_username     = 'Incubator',
  slack_icon_emoji   = ':hatching_chick:',
  created_by_bot_id  = '__genesis__'
WHERE bot_id = 'incubator';

-- ============================================================
-- 2. bot_id_aliases — 표시명 변경 시 기존 bot_id 참조 보존
-- ============================================================

CREATE TABLE IF NOT EXISTS semo.bot_id_aliases (
  alias             TEXT PRIMARY KEY,
  canonical_bot_id  TEXT NOT NULL REFERENCES semo.bot_status(bot_id),
  retired_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_aliases_canonical
  ON semo.bot_id_aliases (canonical_bot_id);

-- ============================================================
-- 3. bot_seats — Claude Max seat 할당 (물리 seat ↔ 논리 bot)
-- ============================================================

CREATE TABLE IF NOT EXISTS semo.bot_seats (
  seat_id            TEXT PRIMARY KEY,
  claude_config_dir  TEXT NOT NULL,
  max_concurrent     INT  NOT NULL DEFAULT 1,
  current_bot_id     TEXT REFERENCES semo.bot_status(bot_id),
  allocated_at       TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'available'
                     CHECK (status IN ('available','allocated','quarantined')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_seats_status
  ON semo.bot_seats (status);

CREATE INDEX IF NOT EXISTS idx_bot_seats_current_bot
  ON semo.bot_seats (current_bot_id) WHERE current_bot_id IS NOT NULL;

-- ============================================================
-- 4. semiclaw → semobot 리브랜드 1단계
-- ============================================================

-- 4.1 semobot row 생성 (semiclaw를 템플릿으로 복사)
INSERT INTO semo.bot_status (
  bot_id, name, emoji, role, workspace_path, status,
  kb_domains, budget_per_message, slack_username, slack_icon_emoji,
  created_by_bot_id, template_bot_id
)
SELECT
  'semobot', 'SemoBot', ':robot_face:', 'orchestrator',
  REPLACE(workspace_path, 'semiclaw', 'semobot'),
  status,
  kb_domains, budget_per_message, 'SemoBot', ':robot_face:',
  '__genesis__', 'semiclaw'
FROM semo.bot_status WHERE bot_id = 'semiclaw'
ON CONFLICT (bot_id) DO NOTHING;

-- 4.2 alias 활성화 (semiclaw → semobot)
INSERT INTO semo.bot_id_aliases (alias, canonical_bot_id)
VALUES ('semiclaw', 'semobot')
ON CONFLICT (alias) DO NOTHING;

-- 4.3 semobot agents 온톨로지 row (entity_type='agents')
INSERT INTO semo.ontology (domain, entity_type, schema, description)
VALUES ('semobot', 'agents', '{}'::jsonb, 'SEMO 오케스트레이터 (semiclaw 후계)')
ON CONFLICT (domain) DO UPDATE SET
  entity_type = EXCLUDED.entity_type,
  description = EXCLUDED.description;

-- 4.4 semobot KB 키 복사 (identity, delegation, model-config, status, slack-config 등)
INSERT INTO semo.knowledge_base (domain, key, sub_key, content, metadata, created_by)
SELECT
  'semobot', key, sub_key, content, metadata, 'migration-104'
FROM semo.knowledge_base
WHERE domain = 'semiclaw'
  AND key IN ('identity','delegation','model-config','status','slack-config','slack-profile','cron-schedule','tools','skills','kb-access')
ON CONFLICT (domain, key, sub_key) DO NOTHING;

-- 4.5 identity 콘텐츠의 이름은 SemoBot으로 덮어쓰기
UPDATE semo.knowledge_base
SET content = format(
  E'name: %s\nemoji: %s\ntagline: %s\nrole: %s\nagent_type: %s',
  'SemoBot', ':robot_face:', 'SEMO 오케스트레이터', 'orchestrator', 'orchestrator'
), updated_at = NOW()
WHERE domain = 'semobot' AND key = 'identity' AND sub_key = '';

-- 4.6 slack-profile 덮어쓰기 (SemoBot 표시명)
UPDATE semo.knowledge_base
SET content = E'username: SemoBot\nicon_emoji: ":robot_face:"', updated_at = NOW()
WHERE domain = 'semobot' AND key IN ('slack-profile','slack-config') AND sub_key = '';

-- 4.7 bot_delegation 복제 — 기존 semiclaw → X 위임을 semobot → X 로 복제
--     (semiclaw 행은 alias 호환성 유지 차원에서 삭제하지 않음)
INSERT INTO semo.bot_delegation (
  from_bot_id, to_bot_id, delegation_type, domains, method, channel,
  max_roundtrips, priority, is_active
)
SELECT
  'semobot', to_bot_id, delegation_type, domains, method, channel,
  max_roundtrips, priority, is_active
FROM semo.bot_delegation
WHERE from_bot_id = 'semiclaw'
ON CONFLICT (from_bot_id, to_bot_id, delegation_type) DO NOTHING;

-- ============================================================
-- 5. bot_seats 초기 행 — snamanager0 (현재 유일한 Claude Max seat)
-- ============================================================

INSERT INTO semo.bot_seats (seat_id, claude_config_dir, current_bot_id, allocated_at, status)
VALUES ('snamanager0', '$HOME/.claude/snamanager0', 'semobot', NOW(), 'allocated')
ON CONFLICT (seat_id) DO UPDATE SET
  current_bot_id = EXCLUDED.current_bot_id,
  allocated_at   = EXCLUDED.allocated_at,
  status         = EXCLUDED.status;

-- ============================================================
-- 6. NOTIFY 트리거 — 라우팅 설정 변경 시 핫 리로드 시그널
-- ============================================================

CREATE OR REPLACE FUNCTION semo.notify_routing_reload()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  op      TEXT := TG_OP;
  tbl     TEXT := TG_TABLE_NAME;
  bot_id  TEXT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF (tbl = 'bot_status') THEN
      bot_id := OLD.bot_id;
    ELSIF (tbl = 'bot_delegation') THEN
      bot_id := OLD.to_bot_id;
    ELSIF (tbl = 'bot_id_aliases') THEN
      bot_id := OLD.canonical_bot_id;
    END IF;
  ELSE
    IF (tbl = 'bot_status') THEN
      bot_id := NEW.bot_id;
    ELSIF (tbl = 'bot_delegation') THEN
      bot_id := NEW.to_bot_id;
    ELSIF (tbl = 'bot_id_aliases') THEN
      bot_id := NEW.canonical_bot_id;
    END IF;
  END IF;

  payload := jsonb_build_object('op', op, 'table', tbl, 'bot_id', bot_id, 'at', NOW());
  PERFORM pg_notify('semo_routing_reload', payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_bot_status') THEN
    CREATE TRIGGER trg_notify_bot_status
      AFTER INSERT OR UPDATE OR DELETE ON semo.bot_status
      FOR EACH ROW EXECUTE FUNCTION semo.notify_routing_reload();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_bot_delegation') THEN
    CREATE TRIGGER trg_notify_bot_delegation
      AFTER INSERT OR UPDATE OR DELETE ON semo.bot_delegation
      FOR EACH ROW EXECUTE FUNCTION semo.notify_routing_reload();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_bot_aliases') THEN
    CREATE TRIGGER trg_notify_bot_aliases
      AFTER INSERT OR UPDATE OR DELETE ON semo.bot_id_aliases
      FOR EACH ROW EXECUTE FUNCTION semo.notify_routing_reload();
  END IF;
END $$;

-- ============================================================
-- 7. 검증용 헬퍼 뷰
-- ============================================================

CREATE OR REPLACE VIEW semo.v_bot_factory_status AS
SELECT
  bs.bot_id,
  bs.name,
  bs.status,
  bs.role,
  bs.created_by_bot_id,
  bs.template_bot_id,
  bs.slack_username,
  bs.budget_per_message,
  bs.kb_domains,
  COALESCE(
    (SELECT array_agg(alias ORDER BY alias) FROM semo.bot_id_aliases WHERE canonical_bot_id = bs.bot_id),
    '{}'
  ) AS aliases,
  seat.seat_id AS seat_id,
  seat.claude_config_dir AS claude_config_dir
FROM semo.bot_status bs
LEFT JOIN semo.bot_seats seat ON seat.current_bot_id = bs.bot_id;

COMMIT;
