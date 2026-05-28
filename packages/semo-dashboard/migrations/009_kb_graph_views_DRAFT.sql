-- SEMO Dashboard v5 — KB Network Graph data pipeline (DRAFT — DO NOT RUN AS-IS)
--
-- Track B Pre-design 결정문 §2 참조.
-- 007_multi_tenancy_DRAFT.sql 와 함께/이후 적용.
--
-- 목적:
--   Knowledge 화면의 KB 네트워크 그래프 (Obsidian 3D 스타일) 를 부드럽게 그리기 위한
--   미리 계산된 노드·엣지 데이터 + 캐싱 전략.
--
-- 설계 결정:
--   - 노드: semo.knowledge_base 의 각 row 1:1
--   - 엣지 3종:
--      (a) hierarchy — domain·parent_domain·sub_key 계층 (강한 엣지)
--      (b) semantic — 임베딩 코사인 유사도 상위 N (약한 엣지)
--      (c) explicit — metadata.references[] (수동/봇 자동 추가, 미래)
--   - 캐시: Materialized View — 임베딩 변경 빈도 낮으므로 1시간 주기 REFRESH
--   - 노드 5,000개 초과 시 클러스터링 view 추가 (Phase 2)
--
-- ⚠️ 검토 사항:
--   a) tenant 격리 — knowledge_base 에 tenant_id 추가 마이그레이션이 선행돼야 함 (cli/migrations/108_*)
--      이 파일은 single-tenant 가정으로 일단 작성하고, tenant 필터는 view 의 WHERE 절에 후속 추가.
--   b) semantic edge 상위 N — N=8 디폴트, tenant 규모별 조정 필요
--   c) REFRESH 비용 — 노드 1만 개에서 임베딩 self-join 은 O(n²) 위험. ivfflat probes 와
--      ef_search 튜닝 + LATERAL JOIN 으로 노드당 top-N 만 계산하도록 작성됨.

-- ============================================================================
-- 1) 노드 뷰 — KB 엔트리 1행 = 그래프 노드 1개
-- ============================================================================

CREATE OR REPLACE VIEW public.kb_graph_nodes AS
SELECT
  kb.kb_id::text AS node_id,
  kb.domain,
  kb.key,
  kb.sub_key,
  COALESCE(NULLIF(kb.key, ''), kb.domain) AS label,
  LEFT(kb.content, 200) AS preview,
  LENGTH(kb.content) AS content_length,
  -- 그래프 시각화 힌트
  CASE
    WHEN kb.key = 'decision' THEN 'decision'
    WHEN kb.key = 'incident' THEN 'incident'
    WHEN kb.key LIKE 'kpi/%' THEN 'kpi'
    WHEN kb.key LIKE 'section/%' THEN 'section'
    WHEN kb.key LIKE 'feature/%' THEN 'feature'
    WHEN kb.key = 'pipeline' THEN 'pipeline'
    WHEN kb.key = 'identity' THEN 'identity'
    ELSE 'other'
  END AS node_kind,
  kb.metadata,
  kb.created_at,
  kb.updated_at
FROM semo.knowledge_base kb;

COMMENT ON VIEW public.kb_graph_nodes IS
  '그래프 노드 — knowledge_base 1:1. node_kind 로 시각화 컬러 매핑.';

-- ============================================================================
-- 2) 계층 엣지 (hierarchy) — VIEW (실시간, 비용 낮음)
-- ============================================================================

CREATE OR REPLACE VIEW public.kb_graph_edges_hierarchy AS
-- (a) 같은 (domain, key) 내 sub_key 부모-자식
WITH ranked_paths AS (
  SELECT kb_id, domain, key, sub_key,
         regexp_split_to_array(sub_key, '/') AS path_parts
  FROM semo.knowledge_base
  WHERE sub_key <> ''
)
SELECT
  parent.kb_id::text AS source_id,
  child.kb_id::text AS target_id,
  'hierarchy' AS edge_kind,
  1.0::float AS weight,
  'parent_of' AS rel
FROM ranked_paths child
JOIN ranked_paths parent
  ON child.domain = parent.domain
 AND child.key = parent.key
 AND parent.sub_key = (
       SELECT array_to_string(child.path_parts[1:array_length(child.path_parts, 1)-1], '/')
     )
 AND parent.kb_id <> child.kb_id

UNION ALL

-- (b) 도메인 메타데이터의 parent_domain (semo → semo-incubator 같은)
SELECT
  parent_pipe.kb_id::text AS source_id,
  child_pipe.kb_id::text AS target_id,
  'hierarchy' AS edge_kind,
  1.0::float AS weight,
  'parent_domain' AS rel
FROM semo.knowledge_base child_pipe
JOIN semo.knowledge_base parent_pipe
  ON parent_pipe.domain = (child_pipe.metadata->>'parent_domain')
 AND parent_pipe.key = 'pipeline'
WHERE child_pipe.key = 'pipeline'
  AND child_pipe.metadata ? 'parent_domain';

COMMENT ON VIEW public.kb_graph_edges_hierarchy IS
  '계층 엣지 — sub_key path + parent_domain. 실시간 view.';

-- ============================================================================
-- 3) 시맨틱 엣지 (semantic) — Materialized View, 1h refresh
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.kb_graph_edges_semantic AS
SELECT
  src.kb_id::text AS source_id,
  nbr.kb_id::text AS target_id,
  'semantic' AS edge_kind,
  nbr.similarity AS weight,
  NULL::text AS rel
FROM semo.knowledge_base src
CROSS JOIN LATERAL (
  SELECT kb2.kb_id,
         (1 - (kb2.embedding <=> src.embedding))::float AS similarity
  FROM semo.knowledge_base kb2
  WHERE kb2.kb_id <> src.kb_id
    AND kb2.embedding IS NOT NULL
  ORDER BY kb2.embedding <=> src.embedding
  LIMIT 8                                              -- 노드당 top-8
) nbr
WHERE src.embedding IS NOT NULL
  AND nbr.similarity >= 0.70;                          -- 잡음 컷오프

CREATE INDEX IF NOT EXISTS idx_kb_edges_semantic_source
  ON public.kb_graph_edges_semantic(source_id);
CREATE INDEX IF NOT EXISTS idx_kb_edges_semantic_target
  ON public.kb_graph_edges_semantic(target_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kb_edges_semantic_pair
  ON public.kb_graph_edges_semantic(source_id, target_id);  -- CONCURRENTLY refresh 가능

COMMENT ON MATERIALIZED VIEW public.kb_graph_edges_semantic IS
  '시맨틱 엣지 — 임베딩 코사인 유사도 노드당 top-8 (>=0.70). 1h refresh.';

-- ============================================================================
-- 4) 명시적 링크 엣지 (explicit) — metadata.references[]
-- ============================================================================

CREATE OR REPLACE VIEW public.kb_graph_edges_explicit AS
SELECT
  src.kb_id::text AS source_id,
  tgt.kb_id::text AS target_id,
  'explicit' AS edge_kind,
  1.0::float AS weight,
  COALESCE(ref->>'rel', 'references') AS rel
FROM semo.knowledge_base src
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(src.metadata->'references', '[]'::jsonb)
) AS ref
JOIN semo.knowledge_base tgt
  ON tgt.domain = (ref->>'domain')
 AND tgt.key = (ref->>'key')
 AND COALESCE(tgt.sub_key, '') = COALESCE(ref->>'sub_key', '')
WHERE src.metadata ? 'references';

COMMENT ON VIEW public.kb_graph_edges_explicit IS
  '명시 링크 — metadata.references = [{domain,key,sub_key,rel?}]. 실시간 view.';

-- ============================================================================
-- 5) 통합 엣지 뷰 (UI 가 한 번에 가져갈 것)
-- ============================================================================

CREATE OR REPLACE VIEW public.kb_graph_edges AS
  SELECT source_id, target_id, edge_kind, weight, rel FROM public.kb_graph_edges_hierarchy
  UNION ALL
  SELECT source_id, target_id, edge_kind, weight, rel FROM public.kb_graph_edges_semantic
  UNION ALL
  SELECT source_id, target_id, edge_kind, weight, rel FROM public.kb_graph_edges_explicit;

-- ============================================================================
-- 6) Refresh 함수 + 권장 크론
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_kb_graph_semantic()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.kb_graph_edges_semantic;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supabase pg_cron 또는 SEMO 크론으로 1시간 주기 실행 권장:
--   SELECT cron.schedule('kb-graph-semantic-refresh', '0 * * * *',
--                        $$SELECT public.refresh_kb_graph_semantic()$$);
--
-- 초기 1회 수동 호출:
--   SELECT public.refresh_kb_graph_semantic();

-- ============================================================================
-- 7) RLS — 노드·엣지 모두 KB 본체 권한에 종속
-- ============================================================================

-- VIEW 는 underlying table 의 RLS 를 상속. semo.knowledge_base 에 tenant_id 추가 후
-- 그 정책이 자연스럽게 그래프에도 적용됨. (현재는 단일 테넌트 가정.)

-- Materialized view 는 RLS 미적용 — 별도 가드 함수 또는 user-facing wrapper RPC 권장:
--   CREATE OR REPLACE FUNCTION public.kb_graph_for_current_tenant() ...
-- 후속 마이그레이션에서 추가.

-- ============================================================================
-- 8) UI 가 호출할 RPC (1차 시안)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.kb_graph_snapshot(
  p_domains TEXT[] DEFAULT NULL,                       -- 카테고리 필터
  p_since   TIMESTAMPTZ DEFAULT NULL,                  -- 시간축 슬라이더
  p_limit   INTEGER DEFAULT 1000
)
RETURNS TABLE (
  nodes JSONB,
  edges JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT jsonb_agg(to_jsonb(n)) FROM (
        SELECT * FROM public.kb_graph_nodes
        WHERE (p_domains IS NULL OR domain = ANY(p_domains))
          AND (p_since IS NULL OR updated_at >= p_since)
        ORDER BY updated_at DESC LIMIT p_limit
     ) n) AS nodes,
    (SELECT jsonb_agg(to_jsonb(e)) FROM public.kb_graph_edges e
       WHERE e.source_id IN (
         SELECT node_id FROM public.kb_graph_nodes
         WHERE (p_domains IS NULL OR domain = ANY(p_domains))
           AND (p_since IS NULL OR updated_at >= p_since)
         ORDER BY updated_at DESC LIMIT p_limit
       )
    ) AS edges;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.kb_graph_snapshot IS
  'UI 의 한 번 호출로 노드+엣지 페이로드. 도메인·시간 필터 지원.';
