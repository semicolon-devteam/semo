-- 회의에 서비스/프로젝트 연동 (optional FK)
ALTER TABLE semo.meetings
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES semo.services(service_id);

CREATE INDEX IF NOT EXISTS idx_meetings_service ON semo.meetings (service_id);
