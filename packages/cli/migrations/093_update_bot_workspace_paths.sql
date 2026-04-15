-- 093: bot_status.workspace_path 레거시 경로 정리
--
-- Migration 078 (incubator_agent) 및 초기 시드가 workspace_path를
-- '~/.semo-bot-sessions/{bot}' 또는 '~/.openclaw-{bot}/workspace'로 기록.
-- 2026-04-15 봇 워크스페이스 통합 이후 SoT는 '~/.semo/workspaces/{bot}'.
-- `semo bots sync`로 자동 반영되는 봇은 이미 갱신됐으나, sync 경로를 타지 않는
-- 봇(incubator 등)은 수동 정리가 필요하다.

UPDATE semo.bot_status
SET workspace_path = '~/.semo/workspaces/' || bot_id
WHERE workspace_path LIKE '~/.semo-bot-sessions/%'
   OR workspace_path LIKE '~/.openclaw-%'
   OR workspace_path LIKE '/Users/%/.openclaw-%'
   OR workspace_path LIKE '/Users/%/.semo-bot-sessions/%'
   OR workspace_path LIKE '/Users/%/.semo/workspaces/%';
