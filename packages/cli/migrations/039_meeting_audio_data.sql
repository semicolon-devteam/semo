-- 회의 오디오를 DB에 저장 (컨테이너 /tmp 휘발 문제 해결)
ALTER TABLE semo.meetings ADD COLUMN IF NOT EXISTS audio_data bytea;
