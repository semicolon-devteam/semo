-- 018: type_schema (공개 배포용 no-op 스텁)
--
-- 이 번호의 마이그레이션은 세미콜론 내부 DB 에 이미 적용 완료됨.
-- 원본은 packages/_archived/migrations-historical/018_type_schema.sql 에 보존되어 있으며
-- semicolon tenant 전용 데이터(서비스 도메인 샘플 예시 등)를 포함하므로
-- 공개 배포 빌드에서는 실행되지 않는다.
--
-- 세미콜론 DB 는 schema_migrations 에 018_type_schema 가 이미 기록되어 있어 이 파일을 skip.
-- 신규(공개) 설치자는 이 파일이 실행되어도 ontology 스키마에 영향 없음.
BEGIN;
-- historical no-op
COMMIT;
