-- 082_discord_channel.sql
-- services 테이블에 discord_channel 컬럼 추가 (멀티플랫폼 채널→서비스 매핑)
ALTER TABLE semo.services ADD COLUMN IF NOT EXISTS discord_channel TEXT;
