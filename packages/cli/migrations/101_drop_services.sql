-- 101: services 허브 테이블 최종 DROP
-- 전제 조건: sandbox.ts의 semo.services 참조(8곳)가 KB 기반으로 전환 완료되어야 함
-- migration 100에서 데이터 이식은 이미 완료됨

DROP TABLE IF EXISTS semo.services CASCADE;
