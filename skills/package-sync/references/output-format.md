# Output Format

> package-sync Skill의 출력 형식

## 성공 시

```json
{
  "status": "✅ SUCCESS",
  "package": "sax-po",
  "source": "sax/packages/sax-po/",
  "target": ".claude/sax-po/",
  "files_synced": {
    "claude_md": 1,
    "agents": 6,
    "skills": 12,
    "commands": 3,
    "templates": 1,
    "total": 23
  },
  "actions": {
    "added": 2,
    "updated": 5,
    "deleted": 0
  },
  "next_steps": [
    "변경사항 테스트",
    "git add .claude/",
    "git commit"
  ]
}
```

## 실패 시

```json
{
  "status": "❌ FAIL",
  "package": "sax-po",
  "error": "소스 패키지를 찾을 수 없습니다",
  "source_path": "sax/packages/sax-po/",
  "resolution": "sax/packages/sax-po/ 디렉토리 확인"
}
```

## 부분 성공 시

```json
{
  "status": "⚠️ PARTIAL",
  "package": "sax-po",
  "files_synced": 20,
  "files_failed": 3,
  "failed_items": [
    "agents/corrupted.md",
    "skills/broken/"
  ],
  "warning": "일부 파일 동기화 실패"
}
```

## Error Types

| Error | 설명 | 해결 방법 |
|-------|------|----------|
| SOURCE_NOT_FOUND | 소스 패키지 없음 | 경로 확인 |
| TARGET_NOT_WRITABLE | 대상 쓰기 권한 없음 | 권한 확인 |
| RSYNC_FAILED | rsync 명령 실패 | rsync 설치 확인 |
| VALIDATION_FAILED | 동기화 후 검증 실패 | 수동 확인 |

## 출력 예시 (터미널)

```
[SAX] Skill: package-sync 호출 - sax-po

📦 동기화 시작: sax-po

소스: sax/packages/sax-po/
대상: .claude/sax-po/

sending incremental file list
CLAUDE.md
agents/orchestrator.md
skills/health-check/SKILL.md
...

✅ 동기화 완료

📊 결과:
- 추가: 2개
- 업데이트: 5개
- 삭제: 0개
- 합계: 23개 파일

[SAX] Sync: sax-po 동기화 완료 (23개 파일)
```
