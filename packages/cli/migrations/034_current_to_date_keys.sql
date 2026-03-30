-- 034_current_to_date_keys.sql
-- action-item, kpi: current 서브키 → 날짜 기반({YYYY-MM-DD}) 컨벤션으로 변경
-- 기존 current 서브키를 폐기하고 날짜 기반 서브키로 통일

-- action-item: value_hint 업데이트
UPDATE semo.kb_type_schema
SET value_hint = '날짜 기반 서브키 사용. 예: action-item/2026-03-29. 최신은 가장 큰 날짜로 조회.'
WHERE scheme_key = 'action-item';

-- kpi: value_hint 업데이트
UPDATE semo.kb_type_schema
SET value_hint = '날짜 기반 서브키 사용. 예: kpi/2026-03-29. 최신은 가장 큰 날짜로 조회.'
WHERE scheme_key = 'kpi';
