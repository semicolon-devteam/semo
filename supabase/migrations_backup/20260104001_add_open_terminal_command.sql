-- =============================================================================
-- remote_commands: command_type 체크 제약조건 업데이트
-- open_terminal 타입 추가 (새 터미널 세션 생성 요청)
-- =============================================================================

-- 기존 체크 제약조건 삭제
ALTER TABLE remote_commands
DROP CONSTRAINT IF EXISTS remote_commands_command_type_check;
-- 새 체크 제약조건 추가
ALTER TABLE remote_commands
ADD CONSTRAINT remote_commands_command_type_check
CHECK (command_type IN (
    'text_input',           -- 텍스트 입력 응답
    'selection',            -- 선택 응답 (AskUserQuestion)
    'permission_response',  -- 권한 요청 응답
    'abort',                -- 작업 중단
    'send_text',            -- 터미널 텍스트 전송
    'key_input',            -- 특수 키 입력 (Ctrl+C 등)
    'refresh_screen',       -- 화면 새로고침 요청
    'health_check',         -- 헬스체크 (orphan 세션 정리)
    'open_terminal'         -- 새 터미널 세션 생성 요청
));
