-- SEMO Dashboard — Google channel integration (extends 014_tenant_channels)
--
-- tenant_channels.channel_type CHECK 제약을 확장해 'google' 을 허용한다.
-- 기존 'slack','kakao','telegram','discord','email','line','instagram' 7개 + 'google' = 8개.
-- 멱등: 기존 제약을 IF EXISTS 로 드롭한 후 동일 이름으로 재생성.

BEGIN;

ALTER TABLE public.tenant_channels DROP CONSTRAINT IF EXISTS tenant_channels_channel_type_check;
ALTER TABLE public.tenant_channels ADD CONSTRAINT tenant_channels_channel_type_check
  CHECK (channel_type IN ('slack','kakao','telegram','discord','email','line','instagram','google'));

COMMIT;
