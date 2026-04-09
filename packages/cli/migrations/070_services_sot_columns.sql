-- 070: services 테이블 SoT 강화 — KB-only 메타데이터를 DB 컬럼으로 이전
-- KB의 singleton 키(tech-stack, service-url, bm, repo, slack-channel)를 services 컬럼으로 승격.
-- status, po(owner_name)는 이미 DB에 있으므로 KB 키만 제거 대상.

BEGIN;

-- 1. 컬럼 추가
ALTER TABLE semo.services
  ADD COLUMN IF NOT EXISTS tech_stack TEXT[],
  ADD COLUMN IF NOT EXISTS service_url TEXT,
  ADD COLUMN IF NOT EXISTS bm TEXT,
  ADD COLUMN IF NOT EXISTS repo TEXT,
  ADD COLUMN IF NOT EXISTS slack_channel TEXT;

-- 2. KB → DB 데이터 이전 (tech-stack)
UPDATE semo.services s SET tech_stack = (
  SELECT string_to_array(
    regexp_replace(kb.content, E'\\s*,\\s*', ',', 'g'),
    ','
  )
  FROM semo.knowledge_base kb
  WHERE kb.domain = s.service_domain
    AND kb.key = 'tech-stack' AND kb.sub_key = ''
    AND kb.content IS NOT NULL AND kb.content != ''
    AND kb.content NOT LIKE '%(미입력)%'
)
WHERE s.service_domain IS NOT NULL AND s.tech_stack IS NULL;

-- 3. KB → DB 데이터 이전 (service-url)
UPDATE semo.services s SET service_url = (
  SELECT kb.content
  FROM semo.knowledge_base kb
  WHERE kb.domain = s.service_domain
    AND kb.key = 'service-url' AND kb.sub_key = ''
    AND kb.content IS NOT NULL AND kb.content != ''
    AND kb.content NOT LIKE '%(미입력)%'
)
WHERE s.service_domain IS NOT NULL AND s.service_url IS NULL;

-- 4. KB → DB 데이터 이전 (bm)
UPDATE semo.services s SET bm = (
  SELECT kb.content
  FROM semo.knowledge_base kb
  WHERE kb.domain = s.service_domain
    AND kb.key = 'bm' AND kb.sub_key = ''
    AND kb.content IS NOT NULL AND kb.content != ''
    AND kb.content NOT LIKE '%(미입력)%'
)
WHERE s.service_domain IS NOT NULL AND s.bm IS NULL;

-- 5. KB → DB 데이터 이전 (repo)
UPDATE semo.services s SET repo = (
  SELECT kb.content
  FROM semo.knowledge_base kb
  WHERE kb.domain = s.service_domain
    AND kb.key = 'repo' AND kb.sub_key = ''
    AND kb.content IS NOT NULL AND kb.content != ''
    AND kb.content NOT LIKE '%(미입력)%'
)
WHERE s.service_domain IS NOT NULL AND s.repo IS NULL;

-- 6. KB → DB 데이터 이전 (slack-channel)
UPDATE semo.services s SET slack_channel = (
  SELECT kb.content
  FROM semo.knowledge_base kb
  WHERE kb.domain = s.service_domain
    AND kb.key = 'slack-channel' AND kb.sub_key = ''
    AND kb.content IS NOT NULL AND kb.content != ''
    AND kb.content NOT LIKE '%(미입력)%'
)
WHERE s.service_domain IS NOT NULL AND s.slack_channel IS NULL;

-- 7. KB service 타입 스키마에서 이전된 키 제거
DELETE FROM semo.kb_type_schema
WHERE type_key = 'service'
  AND scheme_key IN ('tech-stack', 'service-url', 'bm', 'repo', 'slack-channel', 'status', 'po');

-- 8. 이전된 KB 엔트리는 보존 (향후 정리 시 수동 삭제 가능)
-- KB 데이터 자체는 삭제하지 않음 — 스키마 키만 제거하여 신규 upsert 차단

COMMIT;
