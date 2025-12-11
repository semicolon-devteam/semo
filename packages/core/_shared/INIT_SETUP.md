# SAX 세션 초기화 (공통)

> 모든 SAX 패키지에서 공통으로 사용하는 세션 초기화 프로세스

## 트리거 조건

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SAX가 설치된 프로젝트 (`.claude/sax-*` 존재)

## 초기화 흐름

```text
[세션 시작] → version-updater 호출 (4-Phase)
                    ↓
              ┌─────┴─────┐
              │ Phase 1   │ 버전 체크 (로컬 vs 원격)
              └─────┬─────┘
                    ↓
              ┌─────┴─────┐
              │ Phase 2   │ 구조 검증 (sax-architecture-checker)
              └─────┬─────┘
                    ↓
              ┌─────┴─────┐
              │ Phase 3   │ 동기화 검증 (sax-core 존재 시)
              └─────┬─────┘
                    ↓
              ┌─────┴─────┐
              │ Phase 4   │ 메모리 복원 (.claude/memory/ 존재 시)
              └─────┬─────┘
                    ↓
              [초기화 완료 리포트]
```

## 버전 체크 (Phase 1)

```bash
LOCAL=$(cat .claude/sax-{package}/VERSION 2>/dev/null)
REMOTE=$(gh api repos/semicolon-devteam/sax-{package}/contents/VERSION --jq '.content' | base64 -d 2>/dev/null)
```

| 결과 | 동작 |
|------|------|
| `LOCAL == REMOTE` | ✅ 최신 버전 |
| `LOCAL < REMOTE` | ⚠️ 업데이트 안내 (`/SAX:update`) |

## 구조 검증 (Phase 2)

**스킬 호출** (폴백 체인):
1. `.claude/skills/sax-architecture-checker/` → 실행
2. `.claude/sax-core/skills/sax-architecture-checker/` → 폴백

**검증 항목**:
- CLAUDE.md 심링크 유효성
- agents/, skills/, commands/SAX/ 병합 상태
- 깨진 심링크 탐지

## 초기화 완료 출력

```markdown
[SAX_INITIALIZED]
[SAX] 세션 초기화 완료
- 버전: {version} ✅
- 구조: 정상 ✅
- 메모리: 복원됨 ✅ (선택)
```

## 체크 캐싱

- `[SAX_INITIALIZED]` 마커 존재 시 재체크 스킵
- 동일 대화 내 재실행 불필요
