-- 075_routing_delegation.sql
-- bot_delegation에 KB-driven 라우팅 데이터 추가
-- orchestrator router.ts의 하드코딩 라우팅을 DB 기반으로 전환

BEGIN;

-- 1. metadata 컬럼 추가 (스킬 힌트, 정렬 순서 등 확장용)
ALTER TABLE semo.bot_delegation ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. unique constraint 완화 (같은 봇에 routing 여러 행 허용 — designclaw stitch + 일반)
ALTER TABLE semo.bot_delegation
  DROP CONSTRAINT IF EXISTS bot_delegation_from_bot_id_to_bot_id_delegation_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS bot_delegation_unique_v2
  ON semo.bot_delegation (from_bot_id, to_bot_id, delegation_type, COALESCE(metadata->>'label', ''));

-- 3. 키워드 라우팅 시드 (orchestrator → 봇, metadata.order로 우선순위 관리)
INSERT INTO semo.bot_delegation (from_bot_id, to_bot_id, delegation_type, domains, method, priority, metadata) VALUES
  ('orchestrator', 'designclaw', 'routing', ARRAY['stitch 리뷰 완료','스티치 리뷰 완료','스티치 완료','디자인 승인'], 'keyword', 'high',   '{"label":"stitch","order":1}'),
  ('orchestrator', 'infraclaw',  'routing', ARRAY['인프라','배포','cicd','deploy','서버','쿠버','k8s','docker','argocd'], 'keyword', 'medium', '{"label":"infra","order":2}'),
  ('orchestrator', 'designclaw', 'routing', ARRAY['디자인','ui','ux','컬러','폰트','레이아웃','tailwind','css','퍼블리싱'], 'keyword', 'medium', '{"label":"design","order":3}'),
  ('orchestrator', 'reviewclaw', 'routing', ARRAY['리뷰','review','qa','테스트','test','버그','bug','품질'], 'keyword', 'medium', '{"label":"review","order":4}'),
  ('orchestrator', 'growthclaw', 'routing', ARRAY['마케팅','seo','그로스','트래픽','전환율','키워드','콘텐츠','광고','트래킹','커뮤니티 게시','백링크','조회수'], 'keyword', 'medium', '{"label":"growth","order":5}'),
  ('orchestrator', 'workclaw',   'routing', ARRAY['코딩','구현','개발','코드','fix','feature','pr','풀리퀘'], 'keyword', 'medium', '{"label":"work","order":6}'),
  ('orchestrator', 'planclaw',   'routing', ARRAY['기획','스펙','prd','요구사항','epic','유저스토리','플로우'], 'keyword', 'medium', '{"label":"plan","order":7}')
ON CONFLICT DO NOTHING;

-- 4. 스킬 라우팅 시드 (orchestrator → 봇 + 스킬 힌트)
INSERT INTO semo.bot_delegation (from_bot_id, to_bot_id, delegation_type, domains, method, metadata) VALUES
  ('orchestrator', 'semiclaw', 'skill-routing', ARRAY['액션아이템','action item','할일','todo 확인','할일 추적'], 'keyword', '{"skill":"action-item-tracker","label":"action-items"}'),
  ('orchestrator', 'semiclaw', 'skill-routing', ARRAY['서비스 현황','서비스 상태','서비스 조회','서비스 목록','서비스 브리핑','service status','service list'], 'keyword', '{"skill":"service-briefing","label":"service-briefing"}')
ON CONFLICT DO NOTHING;

COMMIT;
