-- 027_kb_manager_skill.sql
-- KB Manager 스킬을 skill_definitions에 등록
-- 모든 봇이 semo CLI를 통해 KB에 접근할 수 있도록 함

INSERT INTO skill_definitions (name, display_name, description, prompt, package, is_active, metadata, version)
VALUES (
  'kb-manager',
  'KB Manager',
  'SEMO KB 조회/검색/수정. semo CLI를 통해 팀 Knowledge Base에 접근.',
  E'---\nname: kb-manager\ndescription: SEMO KB 조회/검색/수정. semo CLI를 통해 팀 Knowledge Base에 접근.\n---\n\n# KB Manager\n\n## 환경 설정\n```bash\nexport SEMO_ROOT=\"/Users/reus/Desktop/Sources/semicolon/projects/semo\"\nsource ~/.semo.env\ncd $SEMO_ROOT/packages/cli\n```\n\n## 명령어\n\n| 작업 | 명령어 |\n|------|--------|\n| 검색 | `npx tsx src/index.ts kb search \"검색어\" --domain <domain> --format json` |\n| 정확 조회 | `npx tsx src/index.ts kb get <domain> <key> [sub_key] --format json` |\n| 목록 | `npx tsx src/index.ts kb list --domain <domain> --format json` |\n| 쓰기 | `npx tsx src/index.ts kb upsert <domain> <key> [sub_key] --content \"내용\"` |\n| 온톨로지 | `npx tsx src/index.ts kb ontology --action <action> --format json` |\n\n## 예시\n```bash\n# 팀원 조회\nnpx tsx src/index.ts kb get semicolon team reus\n\n# 서비스 PO 조회\nnpx tsx src/index.ts kb get by-buyer po\n\n# 검색\nnpx tsx src/index.ts kb search \"PO\" --service by-buyer\n\n# 의사결정 기록\nnpx tsx src/index.ts kb upsert semicolon decision 2026-03-24/example --content \"의사결정 내용\"\n\n# 라우팅 테이블 (저장 위치 판단용)\nnpx tsx src/index.ts kb ontology --action routing-table --format json\n\n# 타입 스키마 조회\nnpx tsx src/index.ts kb ontology --action schema --type service --format json\n\n# 서비스 인스턴스 목록\nnpx tsx src/index.ts kb ontology --action instances --format json\n```\n\n## 규칙\n- psql 직접 쿼리 금지 — 반드시 이 명령어 사용 (임베딩 자동 생성, 스키마 검증)\n- 세션 인사이트 저장 시: ontology routing-table 먼저 확인 → 적절한 domain+key로 upsert\n- 도메인 구조가 불확실하면: ontology --action list 또는 ontology --action instances로 확인\n',
  'core',
  true,
  '{"bot_ids": []}',
  '2.0'
)
ON CONFLICT (name, office_id) DO UPDATE SET
  prompt = EXCLUDED.prompt,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  metadata = EXCLUDED.metadata,
  is_active = true;
