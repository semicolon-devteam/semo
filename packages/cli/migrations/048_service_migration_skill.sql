-- 048: service-migration 스킬 등록
--
-- 기존 운영 서비스를 service_projects 테이블에 이식하는 스킬.
-- SemiClaw가 Slack에서 트리거하거나 CLI에서 직접 실행.

INSERT INTO semo.skill_definitions (name, display_name, description, prompt, package, is_active, metadata, version)
VALUES (
  'service-migration',
  'Service Migration',
  '기존 운영 서비스를 service_projects 테이블에 이식. KB 엔트리 감사(audit) + 자동 매핑.',
  E'---\nname: service-migration\ndescription: 기존 운영 서비스를 service_projects 테이블에 이식\n---\n\n# Service Migration\n\n기존 운영 서비스를 `service_projects` 테이블에 등록하는 스킬.\nGFP(신규 서비스 파이프라인)를 거치지 않은 서비스를 경량 온보딩.\n\n## 트리거\n- \"기존 서비스 등록해줘 {domain}\"\n- \"미등록 서비스 전체 등록해줘\"\n- \"서비스 목록 보여줘\"\n\n## CLI 실행\n```bash\n# 단일 서비스 이식\nsemo service migrate --domain {domain}\n\n# 미등록 전체 일괄 이식\nsemo service migrate --all\n\n# 미리보기 (DB 변경 없음)\nsemo service migrate --all --dry-run\n\n# 서비스 목록 (등록/미등록)\nsemo service list\n```\n\n## 이식 흐름\n1. KB에서 base-information, po, status, tech-stack 등 자동 수집\n2. KB status → lifecycle+status 매핑 (active→ops, hold→paused, deprecated→sunset)\n3. service_projects INSERT (lifecycle=''ops'')\n4. pm-summary projection key 자동 생성\n5. 감사(audit) 리포트 출력\n\n## 감사 리포트 해석\n- **mapped**: service_projects 컬럼에 매핑된 KB 엔트리\n- **metadata**: JSONB에 저장된 추가 정보 (repo, slack-channel 등)\n- **kb-only**: KB에만 존재하는 정상 엔트리 (kpi, milestone 등)\n- **warnings**: 비표준 키 → kb_type_schema 등록 제안\n- **missingRequired**: 필수 키 누락 → 사용자에게 보완 요청\n\n## Data Routing\n- service_projects 테이블 = 실행 상태 SoT\n- KB = 서비스 참조 지식 SoT\n- projection key (spec/*, pm-status 등)는 파이프라인만 쓰기 가능\n',
  'core',
  true,
  '{"bot_ids": ["semiclaw"]}',
  '1.0'
)
ON CONFLICT (name, office_id) DO UPDATE SET
  prompt = EXCLUDED.prompt,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  metadata = EXCLUDED.metadata,
  is_active = true;
