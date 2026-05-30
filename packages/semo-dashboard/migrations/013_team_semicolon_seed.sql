-- SEMO Dashboard v5 — "세미콜론 팀" demo tenant SEED (appdb / public 스키마)
--
-- 010(tenants, agent_listings, agent_installs, agent_activity) +
-- 011(subscriptions, usage_meters, payment_events) 위에서 동작.
-- 데모용 team tenant 1개에 5개 active install + 12 activity + 3 usage_meter + 2 payment_event 를 시드.
--
-- 멱등성: tenants.metadata 의 'seed_v' 키 존재 여부로 gate. 한번 적재되면 재실행해도 no-op.
-- ON CONFLICT 키는 각 테이블의 UNIQUE 제약과 일치:
--   subscriptions  : UNIQUE(tenant_id)
--   usage_meters   : UNIQUE(tenant_id, metric, period_start)
--   agent_installs : UNIQUE(tenant_id, listing_id, instance_name)
--   agent_activity / payment_events : UNIQUE 없음 (seed_v gate 로 중복 방지)

BEGIN;

-- 1) tenant upsert (slug UNIQUE)
INSERT INTO public.tenants (slug, display_name, tenant_type, owner_user_id, plan_slug)
VALUES ('team-semicolon', '세미콜론 팀', 'team', NULL, 'starter')
ON CONFLICT (slug) DO NOTHING;

-- 2) 멱등 게이트 + seed 적재
DO $$
DECLARE
  tid uuid;
  seeded boolean;
BEGIN
  SELECT id, (metadata ? 'seed_v')
    INTO tid, seeded
    FROM public.tenants
   WHERE slug = 'team-semicolon';

  IF tid IS NULL OR seeded THEN
    RETURN;
  END IF;

  -- subscription (tenant_id UNIQUE)
  INSERT INTO public.subscriptions (tenant_id, plan_slug, status, next_billing_at, payment_method)
  VALUES (
    tid,
    'starter',
    'active',
    now() + interval '25 days',
    '{"brand":"신한","last4":"1234","holder":"전준영","exp":"08/27"}'::jsonb
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  -- agent_installs: 5개 active (UNIQUE: tenant_id, listing_id, instance_name)
  INSERT INTO public.agent_installs
    (tenant_id, listing_id, instance_name, install_status, today_summary, avatar_state, last_activity_at)
  SELECT
    tid,
    al.id,
    al.display_name,
    'active',
    s.summary,
    s.state,
    now() - interval '10 minutes'
  FROM public.agent_listings al
  JOIN (VALUES
    ('jumuni',       '주문 12건 응대 — 핫초코 추천 2회',           'working'),
    ('hwegyedo-ri',  '카드 정산 3건 확인 — 부가세 메모 작성',       'idle'),
    ('algorim-i',    '재고 알림 7건 처리 — 우유 발주 예약',         'working'),
    ('sem-i',        'SNS 게시 2건 발행 — 신메뉴 캐러셀 초안',      'idle'),
    ('bi-seo',       '문의 응답 5건 — 미팅 요약 1건 정리',          'idle')
  ) AS s(agent_slug, summary, state)
    ON s.agent_slug = al.agent_slug
  ON CONFLICT (tenant_id, listing_id, instance_name) DO NOTHING;

  -- agent_activity: 12 rows, 다양한 시간 버킷
  INSERT INTO public.agent_activity
    (tenant_id, listing_id, verb, target, detail, is_ai, status, occurred_at)
  SELECT
    tid,
    al.id,
    a.verb,
    a.target,
    a.detail,
    true,
    a.status,
    a.occurred_at
  FROM public.agent_listings al
  JOIN (VALUES
    -- 4개: 최근 15분 이내
    ('jumuni',       '주문 응대',   '테이블 4',       '아메리카노 2 + 크로플 1 주문 받음',           'done',     now() - interval '3 minutes'),
    ('algorim-i',    '재고 알림',   '우유 2L',        '잔여 1팩 — 자동 발주 예약 완료',              'done',     now() - interval '7 minutes'),
    ('sem-i',        'SNS 발행',    '인스타그램',     '신메뉴 "딸기 라떼" 캐러셀 게시 완료',         'done',     now() - interval '11 minutes'),
    ('bi-seo',       '문의 응답',   '카카오 채널',    '단체 예약 가능 시간 안내 답변',                'done',     now() - interval '14 minutes'),
    -- 4개: 오늘 1h~10h 전
    ('jumuni',       '추천',         '단골 김지훈',    '핫초코 + 마들렌 세트 추천 — 수락',            'done',     now() - interval '1 hour 10 minutes'),
    ('hwegyedo-ri',  '정산',         '신한 카드',      '5월 28일 매출 1,247,000원 일별 마감',         'done',     now() - interval '3 hours'),
    ('sem-i',        'SNS 발행',     '네이버 블로그',  '"세미콜론 팀 카페 오픈일지 #14" 발행',         'done',     now() - interval '5 hours 20 minutes'),
    ('bi-seo',       '미팅 요약',    '주간 운영회의',  '논의 5건 / 액션 3건 자동 정리',               'done',     now() - interval '8 hours 45 minutes'),
    -- 4개: 1~2일 전
    ('algorim-i',    '재고 알림',    '시럽 — 카라멜', '잔여 0.5병 — 거래처 발주 메일 초안 생성',     'pending',  now() - interval '1 day 2 hours'),
    ('hwegyedo-ri',  '세금계산서',   '거래처 미림상사','5월분 50만원 세금계산서 발행 요청 전송',       'done',     now() - interval '1 day 9 hours'),
    ('bi-seo',       '문서 초안',    '직원 채용공고',  '홀 파트타이머 채용공고 초안 — 검토 요청',     'done',     now() - interval '1 day 17 hours'),
    ('jumuni',       '주문 응대',    '테이블 7',       '단체 6인 예약 손님 응대 — 후기 요청 메모',    'done',     now() - interval '2 days 1 hour')
  ) AS a(agent_slug, verb, target, detail, status, occurred_at)
    ON a.agent_slug = al.agent_slug;

  -- usage_meters (tenant_id, metric, period_start UNIQUE)
  INSERT INTO public.usage_meters (tenant_id, metric, used, limit_val, period_start)
  VALUES
    (tid, 'ai_responses',  342, 1000, date_trunc('month', now())::date),
    (tid, 'kb_storage_mb', 178,  500, date_trunc('month', now())::date),
    (tid, 'employees',       5,   10, date_trunc('month', now())::date)
  ON CONFLICT (tenant_id, metric, period_start) DO NOTHING;

  -- payment_events: 2 rows
  INSERT INTO public.payment_events
    (tenant_id, event_type, amount_krw, status, invoice_label, occurred_at)
  VALUES
    (tid, 'charge', 29000, 'paid', '2026-05 Starter', now() - interval '5 days'),
    (tid, 'charge', 29000, 'paid', '2026-04 Starter', now() - interval '35 days');

  -- seed gate 마감
  UPDATE public.tenants
     SET metadata = metadata || jsonb_build_object('seed_v', '1', 'seeded_at', to_jsonb(now()))
   WHERE id = tid;
END $$;

COMMIT;
