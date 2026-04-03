-- 044: GFP Stitch screenshot storage
-- Stitch SDK에서 생성된 스크린샷 base64 데이터 + 공유 URL 저장

ALTER TABLE semo.gfp_materials
  ADD COLUMN IF NOT EXISTS screenshot_data TEXT,
  ADD COLUMN IF NOT EXISTS stitch_share_url VARCHAR(500);

COMMENT ON COLUMN semo.gfp_materials.screenshot_data IS 'Base64-encoded PNG screenshot from Stitch getImage()';
COMMENT ON COLUMN semo.gfp_materials.stitch_share_url IS 'Public shareable URL from Stitch getShareUrl()';
