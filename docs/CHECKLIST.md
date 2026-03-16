# SEMO v4 검증 체크리스트

> v4.0.0 리뉴얼 기준 — 실행 가능한 명령어 기반으로 검증한다.
> 각 항목은 독립적으로 실행 가능하며, ✅ / ❌ / ⚠️ 로 결과를 기록한다.

---

## 사전 준비

```bash
# SSH 터널 개설 (DB 접속 필요 시)
ssh -f -N -L 15432:10.0.0.91:5432 -J opc@152.70.244.169 opc@10.0.0.91

# 환경변수 설정
export DATABASE_URL="postgres://app:ProductionPassword2024!%40%23@localhost:15432/appdb"

# CLI 전역 설치 확인
which semo || echo "설치 필요: npm install -g @team-semicolon/semo-cli"
```

---

## 1. CLI 빌드 검증

| # | 검증 항목 | 명령어 | 기대 결과 |
|---|-----------|--------|----------|
| 1-1 | TypeScript 타입 체크 | `cd packages/cli && npx tsc --noEmit` | 오류 없음 |
| 1-2 | 빌드 성공 | `npm run build` | dist/ 생성, exit 0 |
| 1-3 | 버전 확인 | `semo --version` | `4.0.0` |
| 1-4 | 서브커맨드 존재 확인 | `semo --help` | context/bots/get/skills/kb/onto 포함 |
| 1-5 | context 서브커맨드 | `semo context --help` | sync/push 표시 |
| 1-6 | bots 서브커맨드 | `semo bots --help` | status/sessions/sync 표시 |
| 1-7 | get 서브커맨드 | `semo get --help` | projects/bots/kb/ontology/tasks/sessions 표시 |
| 1-8 | skills 서브커맨드 | `semo skills --help` | seed 표시 |

---

## 2. DB 연결 검증

| # | 검증 항목 | 명령어 | 기대 결과 |
|---|-----------|--------|----------|
| 2-1 | 터널 동작 확인 | `nc -z localhost 15432 && echo OK` | OK |
| 2-2 | psql 직접 접속 | `psql $DATABASE_URL -c "SELECT 1"` | `1` 반환 |
| 2-3 | semo 스키마 존재 | `psql $DATABASE_URL -c "\dn semo"` | semo 스키마 표시 |
| 2-4 | 핵심 테이블 목록 | `psql $DATABASE_URL -c "\dt semo.*"` | bot_status/bot_sessions/knowledge_base/ontology 포함 |
| 2-5 | semo doctor | `semo doctor` | PostgreSQL ✓ 표시 (ENOENT 무시) |

---

## 3. `semo context sync` 검증

| # | 검증 항목 | 명령어 | 기대 결과 |
|---|-----------|--------|----------|
| 3-1 | sync 실행 | `semo context sync` | "context sync 완료 — N개 파일 업데이트" |
| 3-2 | memory 디렉토리 생성 | `ls .claude/memory/` | 디렉토리 존재 |
| 3-3 | bots.md 생성 | `cat .claude/memory/bots.md` | 봇 상태 테이블 포함 |
| 3-4 | ontology.md 생성 | `cat .claude/memory/ontology.md` | 온톨로지 도메인 포함 |
| 3-5 | KB 도메인별 파일 | `ls .claude/memory/*.md` | team/projects/decisions/infra/process.md 포함 |
| 3-6 | 옵션: 특정 도메인만 | `semo context sync --domain team` | team.md만 갱신 |
| 3-7 | 옵션: bots 제외 | `semo context sync --no-bots` | bots.md 미변경 |
| 3-8 | DB 미연결 시 graceful | DATABASE_URL 미설정 후 `semo context sync` | 경고 출력 후 종료 (exit 0) |

---

## 4. `semo context push` 검증

| # | 검증 항목 | 명령어 | 기대 결과 |
|---|-----------|--------|----------|
| 4-1 | dry-run 미리보기 | `semo context push --dry-run` | `[dry-run]` 로그 출력, DB 변경 없음 |
| 4-2 | decisions.md 없을 때 | decisions.md 삭제 후 `semo context push` | "파일 없음" 오류 메시지 |
| 4-3 | H2 파싱 확인 | decisions.md에 `## test-key\n내용` 추가 후 `--dry-run` | test-key 항목 표시 |
| 4-4 | 실제 push | `semo context push` | "push 완료: N건 업서트" |
| 4-5 | DB 반영 확인 | `psql $DATABASE_URL -c "SELECT key FROM semo.knowledge_base WHERE domain='decision'"` | push한 key 존재 |
| 4-6 | 재실행 멱등성 | `semo context push` 두 번 실행 | 두 번 모두 성공 (upsert) |

---

## 5. `semo bots sync` 검증

| # | 검증 항목 | 명령어 | 기대 결과 |
|---|-----------|--------|----------|
| 5-1 | dry-run 봇 탐지 | `semo bots sync --dry-run` | 7개 봇 목록 출력 (workclaw/reviewclaw 등) |
| 5-2 | IDENTITY.md 파싱 | dry-run 출력에서 name/emoji 확인 | 각 봇의 이름 표시 |
| 5-3 | 실제 sync 실행 | `semo bots sync` | "bots sync 완료: 7개 봇 업서트" |
| 5-4 | DB 반영 확인 | `psql $DATABASE_URL -c "SELECT bot_id, name, status FROM semo.bot_status ORDER BY bot_id"` | 7개 row (status='offline') |
| 5-5 | last_active 기록 | 위 쿼리에 `last_active` 컬럼 추가 | null이 아닌 값 (mtime 기반) |
| 5-6 | 커스텀 경로 | `semo bots sync --semo-system ./semo-system` | 동일 결과 |
| 5-7 | 재실행 멱등성 | `semo bots sync` 두 번 실행 | 오류 없이 동일 결과 |

---

## 6. `semo bots status / sessions` 검증

| # | 검증 항목 | 명령어 | 기대 결과 |
|---|-----------|--------|----------|
| 6-1 | status 테이블 출력 | `semo bots status` | 봇 목록 테이블 (bot_id/이름/상태/마지막활동) |
| 6-2 | JSON 출력 | `semo bots status --format json` | 유효한 JSON 배열 |
| 6-3 | 상태 필터 | `semo bots status --status offline` | offline 봇만 표시 |
| 6-4 | sessions 조회 | `semo bots sessions` | 세션 목록 (없으면 "세션 데이터 없음") |
| 6-5 | 봇 필터 | `semo bots sessions --bot workclaw` | workclaw 세션만 |
| 6-6 | limit 옵션 | `semo bots sessions --limit 5` | 최대 5건 |

---

## 7. `semo get` 검증

| # | 검증 항목 | 명령어 | 기대 결과 |
|---|-----------|--------|----------|
| 7-1 | projects 조회 | `semo get projects` | 프로젝트 테이블 (없으면 KB 기반 fallback) |
| 7-2 | bots 조회 | `semo get bots` | 봇 상태 테이블 |
| 7-3 | kb 조회 | `semo get kb --domain team` | team 도메인 KB 항목 |
| 7-4 | kb 검색 | `semo get kb --search "세미콜론"` | 검색 결과 |
| 7-5 | kb JSON | `semo get kb --domain team --format json` | 유효한 JSON |
| 7-6 | ontology 목록 | `semo get ontology` | 도메인 목록 테이블 |
| 7-7 | ontology 상세 | `semo get ontology --domain <name>` | 스키마 JSON 출력 |
| 7-8 | sessions 조회 | `semo get sessions --limit 5` | 세션 목록 (없으면 "결과 없음") |
| 7-9 | tasks 조회 | `semo get tasks` | 태스크 목록 (없으면 테이블 없음 경고) |

---

## 8. `semo skills seed` 검증

| # | 검증 항목 | 명령어 | 기대 결과 |
|---|-----------|--------|----------|
| 8-1 | dry-run 스킬 탐지 | `semo skills seed --dry-run` | 30개 이상 스킬 목록 |
| 8-2 | 실제 시딩 | `semo skills seed` | "skills seed 완료: N개 업서트" |
| 8-3 | DB 반영 확인 | `psql $DATABASE_URL -c "SELECT COUNT(*) FROM semo.skills"` | 30 이상 |
| 8-4 | 재실행 멱등성 | `semo skills seed` 두 번 실행 | 동일 결과, 오류 없음 |

---

## 9. 훅 등록 검증

> **현재 상태**: `.claude/settings.json`에 SessionStart/Stop 훅이 미등록 상태
> `semo init` 실행 또는 수동으로 settings.json에 추가 필요

| # | 검증 항목 | 방법 | 기대 결과 |
|---|-----------|------|----------|
| 9-1 | 훅 등록 여부 | `cat .claude/settings.json \| grep -c SessionStart` | `1` |
| 9-2 | semo init 실행 | `semo init` (semo 프로젝트 루트에서) | settings.json에 훅 추가 |
| 9-3 | SessionStart 훅 내용 | settings.json 확인 | `"semo context sync 2>/dev/null \|\| true"` |
| 9-4 | Stop 훅 내용 | settings.json 확인 | `"semo context push 2>/dev/null \|\| true"` |
| 9-5 | 훅 동작 검증 | 새 Claude Code 세션 시작 → 완료 후 | `.claude/memory/*.md` 자동 갱신 |

---

## 10. 아카이빙 검증

| # | 검증 항목 | 명령어 | 기대 결과 |
|---|-----------|--------|----------|
| 10-1 | semo-remote 아카이빙 | `ls semo-system/_archived/semo-remote/` | 파일 존재 |
| 10-2 | semo-hooks 아카이빙 | `ls semo-system/_archived/semo-hooks/` | 파일 존재 |
| 10-3 | mcp-server 아카이빙 | `ls packages/_archived/mcp-server/` | 파일 존재 |
| 10-4 | semo-agents 아카이빙 | `ls semo-system/_archived/semo-agents/` | 파일 존재 |
| 10-5 | 레거시 docs 아카이빙 | `ls docs/_archived/` | ARCHITECTURE.md 등 존재 |
| 10-6 | settings.json 잔재 없음 | `cat .claude/settings.json \| grep -c semo-integrations` | `0` |
| 10-7 | CLI 확장 시스템 제거 | `grep -r "biz\|eng\|ops\|EXTENSION_PACKAGES" packages/cli/src/` | 결과 없음 |
| 10-8 | 신규 docs 존재 | `ls docs/` | SPEC.md/ARCHITECTURE.md/README.md 포함 |

---

## 11. 봇 헬스비트 스크립트 검증

| # | 검증 항목 | 명령어 | 기대 결과 |
|---|-----------|--------|----------|
| 11-1 | 스크립트 존재 | `ls semo-system/bot-workspaces/semiclaw/scripts/bot-status-sync.sh` | 파일 존재 |
| 11-2 | 실행 권한 | `ls -l semo-system/bot-workspaces/semiclaw/scripts/bot-status-sync.sh` | `-rwxr-xr-x` |
| 11-3 | dry-run 실행 | `semo bots sync --dry-run` (스크립트 내부 명령 수동 실행) | 7개 봇 출력 |

---

## 12. 엔드투엔드 시나리오

### 시나리오 A: 새 Claude Code 세션에서 팀 컨텍스트 즉시 로드

```bash
# 전제: 훅 등록 완료, DB 연결 가능
# 1. 세션 시작 → SessionStart 훅 자동 실행 → semo context sync
# 2. Claude에게 "지금 팀 구성원이 누구야?" 질문
# 기대: .claude/memory/team.md 기반으로 답변
```

**체크**: memory/team.md 내용이 실제 팀 KB와 일치하는가?

---

### 시나리오 B: 결정사항 자동 보존

```bash
# 1. Claude 세션 중 .claude/memory/decisions.md에 ## 새 결정 추가
# 2. 세션 종료 → Stop 훅 → semo context push 자동 실행
# 3. psql로 semo.knowledge_base 확인
psql $DATABASE_URL -c "SELECT key FROM semo.knowledge_base WHERE domain='decision'"
# 기대: '새 결정' key 존재
```

---

### 시나리오 C: 봇 상태 조회

```bash
# 1. bots sync 실행
semo bots sync

# 2. 봇 상태 조회
semo bots status

# 3. context sync로 memory 갱신
semo context sync

# 4. .claude/memory/bots.md 확인
cat .claude/memory/bots.md
# 기대: 7개 봇 상태 테이블 (last_active 포함)
```

---

## 결과 기록 (2026-03-15 검증 완료)

| 섹션 | 통과 | 실패 | 비고 |
|------|------|------|------|
| 1. CLI 빌드 | 8/8 | 0 | v4.0.0, 모든 서브커맨드 확인 |
| 2. DB 연결 | 5/5 | 0 | SSH 터널 + pg 라이브러리 직접 연결 |
| 3. context sync | 8/8 | 0 | 7개 memory 파일 생성 확인 |
| 4. context push | 6/6 | 0 | 16건 decision KB 반영 |
| 5. bots sync | 7/7 | 0 | 7개 봇 upsert, last_active 기록 |
| 6. bots status/sessions | 6/6 | 0 | 테이블/JSON 출력 정상 |
| 7. get | 9/9 | 0 | tasks 스키마 불일치 발견 후 수정 완료 |
| 8. skills seed | 4/4 | 0 | 30개 스킬 DB 적재 |
| 9. 훅 등록 | 4/4 | 0 | settings.json에 직접 추가 완료 |
| 10. 아카이빙 | 8/8 | 0 | 모든 레거시 패키지/문서 아카이빙 확인 |
| 11. 헬스비트 스크립트 | 3/3 | 0 | -rwxr-xr-x, 동작 확인 |

---

## 검증 중 발견된 버그 및 수정 내역

| 항목 | 내용 | 조치 |
|------|------|------|
| `get tasks` 스키마 불일치 | 쿼리에 `assignee` 컬럼 사용, 실제 컬럼명은 `assignee_name` | `get.ts` 수정 후 재빌드 완료 |
| `skills seed` 경로 오류 | CLI 패키지 디렉토리에서 실행 시 `semo-system` 경로 미탐지 | 프로젝트 루트에서 실행하면 정상 (문서화) |
| designclaw/infraclaw/reviewclaw IDENTITY.md | 템플릿 미작성 상태 (이름/이모지가 플레이스홀더) | 봇 운영 시 작성 필요 (CLI 버그 아님) |

---

## 알려진 제한사항

| 항목 | 설명 | 영향도 |
|------|------|--------|
| `semo doctor` ENOENT | `.claude/agents/architect` 파일 없어 경고 발생 (기존 버그) | 낮음 |
| `skills seed` 실행 위치 | 프로젝트 루트(`semo/`)에서 실행해야 semo-system 경로 탐지 | 낮음 |
| bot_sessions 비어있음 | 봇들이 세션 정보를 DB에 기록하는 훅 미설정 (중기 과제) | 낮음 |
| semo.tasks 비어있음 | 팀이 GitHub Issues 사용 중, tasks 테이블 미사용 | 낮음 |
