-- 004_session_count_trigger.sql
-- P0-3: session_count 경쟁 조건 해결
-- bot_sessions INSERT/DELETE 시 bot_status.session_count 자동 갱신 트리거

CREATE OR REPLACE FUNCTION semo.update_session_count()
RETURNS TRIGGER AS $$
DECLARE
  target_bot_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_bot_id := OLD.bot_id;
  ELSE
    target_bot_id := NEW.bot_id;
  END IF;

  UPDATE semo.bot_status
  SET session_count = (
    SELECT COUNT(*) FROM semo.bot_sessions WHERE bot_id = target_bot_id
  )
  WHERE bot_id = target_bot_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 있으면 교체
DROP TRIGGER IF EXISTS trg_session_count ON semo.bot_sessions;

CREATE TRIGGER trg_session_count
  AFTER INSERT OR DELETE ON semo.bot_sessions
  FOR EACH ROW EXECUTE FUNCTION semo.update_session_count();
