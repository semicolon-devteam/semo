-- Migration 013: Add bot-config, spec, skill ontology domains
-- bot_workspace_files → KB 전환을 위한 새 도메인 추가.
-- 봇 메타/규격, 문서/스펙, 스킬 정의를 KB로 관리.

-- 1. bot-config 도메인: 봇 메타데이터 및 규격 문서
INSERT INTO semo.ontology (domain, schema, description, version)
VALUES (
  'bot-config',
  '{
    "type": "object",
    "properties": {
      "content": { "type": "string", "description": "문서 본문 (Markdown)" },
      "metadata": {
        "type": "object",
        "properties": {
          "bot_id": { "type": "string", "description": "봇 ID (semiclaw, workclaw 등)" },
          "file_type": {
            "type": "string",
            "enum": ["identity", "agents", "rules", "tools", "heartbeat", "bootstrap", "claude"],
            "description": "원본 파일 종류"
          },
          "source_path": { "type": "string", "description": "원본 파일 경로" }
        },
        "required": ["bot_id", "file_type"]
      }
    }
  }'::jsonb,
  '봇 메타데이터 및 규격 문서 (IDENTITY.md, AGENTS.md, RULES.md, TOOLS.md, HEARTBEAT.md, BOOTSTRAP.md, CLAUDE.md)',
  1
)
ON CONFLICT (domain) DO NOTHING;

-- 2. spec 도메인: 프로젝트 스펙/설계 문서
INSERT INTO semo.ontology (domain, schema, description, version)
VALUES (
  'spec',
  '{
    "type": "object",
    "properties": {
      "content": { "type": "string", "description": "스펙 문서 본문 (Markdown)" },
      "metadata": {
        "type": "object",
        "properties": {
          "project": { "type": "string", "description": "관련 프로젝트명" },
          "doc_type": {
            "type": "string",
            "enum": ["prd", "spec", "plan", "design", "epic", "protocol"],
            "description": "문서 유형"
          },
          "author": { "type": "string", "description": "작성자 (봇 ID 또는 사용자)" },
          "source_bot": { "type": "string", "description": "원본이 있던 봇 워크스페이스" }
        }
      }
    }
  }'::jsonb,
  '프로젝트 스펙, PRD, 설계 문서, 구현 계획',
  1
)
ON CONFLICT (domain) DO NOTHING;

-- 3. skill 도메인: 봇 스킬 정의 및 참조 문서
INSERT INTO semo.ontology (domain, schema, description, version)
VALUES (
  'skill',
  '{
    "type": "object",
    "properties": {
      "content": { "type": "string", "description": "스킬 정의 또는 참조 문서 (Markdown)" },
      "metadata": {
        "type": "object",
        "properties": {
          "bot_id": { "type": "string", "description": "스킬 소유 봇 ID" },
          "skill_name": { "type": "string", "description": "스킬 이름" },
          "content_type": {
            "type": "string",
            "enum": ["definition", "reference"],
            "description": "definition=SKILL.md, reference=references/*.md"
          },
          "ref_name": { "type": "string", "description": "참조 문서 이름 (reference 타입일 때)" }
        },
        "required": ["bot_id", "skill_name", "content_type"]
      }
    }
  }'::jsonb,
  '봇 스킬 정의 (SKILL.md) 및 참조 문서 (references/*.md). scripts/는 제외 (로컬 실행 필요)',
  1
)
ON CONFLICT (domain) DO NOTHING;
