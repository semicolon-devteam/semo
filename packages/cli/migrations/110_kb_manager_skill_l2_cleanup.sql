-- 110: kb-manager 스킬 프롬프트 L2 leakage 정리
-- migrations 027/031 가 skill_definitions(name='kb-manager') 의 prompt 에
-- 'reus' (팀원 닉네임), 'by-buyer' (세미콜론 L2 서비스), 그리고 027 의 경우
-- '/Users/reus/Desktop/Sources/...' 하드코딩 경로까지 박아 두었다.
-- 027/031 인라인 텍스트는 일반화 (이 migration 시리즈와 함께 적용),
-- 기존 인스턴스의 row 는 이 migration 이 정확 매칭일 때만 갱신.
--
-- 관련 인벤토리: docs/L2-INVENTORY.md (HIGH — kb-manager skill_definitions row)

BEGIN;

UPDATE semo.skill_definitions
SET
  prompt = REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(prompt,
            'semo kb get semicolon team reus', 'semo kb get <org> team alice'),
          'semo kb get by-buyer po', 'semo kb get my-service po'),
        'semo kb search "PO" --service by-buyer', 'semo kb search "PO" --service my-service'),
      'semo kb upsert semicolon decision 2026-03-24/example', 'semo kb upsert <org> decision 2026-03-24/example'),
    'export SEMO_ROOT="/Users/reus/Desktop/Sources/semicolon/projects/semo"\ncd $SEMO_ROOT/packages/cli\n', ''
  ),
  updated_at = NOW()
WHERE name = 'kb-manager'
  AND office_id IS NULL
  AND (
    prompt LIKE '%semo kb get semicolon team reus%'
    OR prompt LIKE '%--service by-buyer%'
    OR prompt LIKE '%/Users/reus/Desktop/Sources/semicolon/projects/semo%'
  );

COMMIT;
