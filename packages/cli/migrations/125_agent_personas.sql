-- 125: agent_personas — 고객용 base 에이전트 행동 SoT (Semi/Colony 및 향후 고객 봇)
--
-- 설계: docs/superpowers/specs/2026-06-02-agent-behavior-sot-and-propagation-design.md
-- 배경: Semi/Colony 행동(SOUL.md)의 단일 SoT 를 DB 로 승격. 프로토타입 hermes SOUL.md 와
--       미래 고객 install 이 모두 여기서 resolve. operator(슬랙)가 컨펌 기반으로 편집.
-- 주의: semo.agent_definitions(내부 7봇 → ~/.claude/agents 동기화)와는 별개 테이블이다.

BEGIN;

CREATE TABLE IF NOT EXISTS semo.agent_personas (
  slug         TEXT PRIMARY KEY,                 -- 'semi','colony','jumuni' ...
  display_name TEXT,
  soul_md      TEXT NOT NULL,                    -- 행동 정의 본문 (= 현 SOUL.md)
  version      INTEGER NOT NULL DEFAULT 1,
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'deprecated')),
  updated_by   TEXT,                             -- 'mark' | 'reus' | ... (감사)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 편집 이력 (롤백·감사·diff 근거). 매 편집마다 append.
CREATE TABLE IF NOT EXISTS semo.agent_persona_revisions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL REFERENCES semo.agent_personas(slug) ON DELETE CASCADE,
  version    INTEGER NOT NULL,
  soul_md    TEXT NOT NULL,
  updated_by TEXT,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_persona_revisions_slug
  ON semo.agent_persona_revisions(slug, version);

COMMIT;
