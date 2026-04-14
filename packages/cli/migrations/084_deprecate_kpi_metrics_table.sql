-- Phase 3: service_kpi_metrics 테이블 deprecated 마킹
-- KPI 데이터는 KB metadata가 SoT. 이 테이블은 historical fallback 전용.
-- 전환 완료 후 (1개월 검증) 별도 마이그레이션으로 DROP 예정.

COMMENT ON TABLE semo.service_kpi_metrics IS 'DEPRECATED: KPI data now lives in KB metadata (key=kpi, sub_key=YYYY-MM-DD). This table is retained for historical fallback reads only. Do not insert new records.';
