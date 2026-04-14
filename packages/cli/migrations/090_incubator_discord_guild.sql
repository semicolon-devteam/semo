-- 090_incubator_discord_guild.sql
-- incubator_sessions에 discord_guild 컬럼 추가 (Discord guild 단위 incubator 라우팅)
ALTER TABLE semo.incubator_sessions ADD COLUMN IF NOT EXISTS discord_guild TEXT;

-- SEMO Incubator 1기 서버 매핑
UPDATE semo.incubator_sessions
SET discord_guild = '1493481703002476658'
WHERE status = 'active' AND discord_guild IS NULL;
