-- 126: channel_domain_map — Slack/Discord 채널 → KB 도메인 매핑의 단일 SoT
--
-- 설계: docs/superpowers/specs/2026-06-03-colony-daily-digest-design.md
-- 배경: Colony 일일 digest 가 "참여 채널에서 수집한 지식을 올바른 KB 도메인에 적재"하려면
--       채널→도메인 매핑이 DB 단일 SoT 여야 한다. 기존 후보(ontology.slack_channel substring,
--       KB markdown slack-channel-monitor)는 sparse/dirty/파싱불가이고 drift 실증됨
--       (채널 C0A5MLV4BL7 가 reader 마다 by-buyer vs feel-free 로 해소). 정규화 테이블로 승격.
--
-- 주의: domain 은 의도적으로 hard FK 를 걸지 않는다(일부 매핑 도메인이 아직 semo.ontology 에
--       미등록일 수 있어 backfill/upsert 가 막히는 brittleness 회피). 대신 'semo channel map'
--       CLI 가 write 시 ontology 존재를 soft-검증(경고)한다. 핵심 무결성은 UNIQUE(platform,channel_id).

BEGIN;

CREATE TABLE IF NOT EXISTS semo.channel_domain_map (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform       text NOT NULL DEFAULT 'slack'
                   CHECK (platform IN ('slack', 'discord')),
  channel_id     text NOT NULL,                  -- 순수 외부 채널 ID 만 (라벨 glue 금지)
  channel_name   text,                           -- 표시용 (예: "#proj-axoracle")
  domain         text NOT NULL,                  -- KB 도메인 (soft-validated against semo.ontology)
  purpose        text NOT NULL DEFAULT 'project'
                   CHECK (purpose IN ('project', 'org-common', 'incubator', 'ops')),
  ingest_enabled boolean NOT NULL DEFAULT true,  -- Colony/digest 가 이 플래그만 읽음
  route_enabled  boolean NOT NULL DEFAULT true,  -- (후속) 봇 라우터용 — ingest 와 분리
  created_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, channel_id)                  -- 이중 도메인 충돌 구조적 차단
);

CREATE INDEX IF NOT EXISTS idx_cdm_domain ON semo.channel_domain_map (domain);
CREATE INDEX IF NOT EXISTS idx_cdm_ingest
  ON semo.channel_domain_map (platform, channel_id)
  WHERE ingest_enabled;

COMMIT;
