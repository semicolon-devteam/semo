# SEMO v4 테스트 케이스 & E2E 검증

> 모든 테스트는 SSH 터널이 열려 있고 DATABASE_URL이 설정된 상태에서 실행합니다.
>
> ```bash
> ssh -f -N -L 15432:10.0.0.91:5432 -J opc@152.70.244.169 opc@10.0.0.91
> export DATABASE_URL='postgres://app:ProductionPassword2024!%40%23@localhost:15432/appdb'
> export OPENAI_API_KEY='sk-proj-...'
> ```

---

## 단위 테스트 케이스

### TC-01: DB 연결

```bash
semo doctor
# 기대값: "✅ 설치 상태 정상" (크래시 없음)
```

---

### TC-02: context sync (DB → memory)

```bash
semo context sync
# 기대값:
# "✔ context sync 완료 — 7개 파일 업데이트"
# 생성 파일: .claude/memory/{team,bots,decisions,infra,ontology,process,projects}.md
ls -la .claude/memory/*.md
```

---

### TC-03: context push (memory → DB)

```bash
# decisions.md에 테스트 항목 추가
cat >> .claude/memory/decisions.md << 'EOF'

## test-push-verification

테스트용 임시 decision. push 검증 후 삭제 예정.
EOF

semo context push
# 기대값: "✔ push 완료: N건 업서트"

# DB에서 확인
psql "$DATABASE_URL" -c "SELECT key, content FROM semo.knowledge_base WHERE domain='decision' AND key='test-push-verification';"

# 정리 (테스트 후)
# decisions.md에서 해당 섹션 제거 후 semo context push 재실행
```

---

### TC-04: bots sync (bot-workspaces → DB)

```bash
semo bots sync
# 기대값: "✔ bots sync 완료: 7개 봇 업서트"

semo bots status
# 기대값: 7개 봇 목록, 이름/이모지 정상 표시
# designclaw: 🎨 DesignClaw
# infraclaw:  🏗️ InfraClaw
# reviewclaw: 🔍 ReviewClaw
```

---

### TC-05: bots set-status (온라인/오프라인 수동 전환)

```bash
semo bots set-status workclaw online
semo bots status | grep workclaw
# 기대값: "● online"

semo bots set-status workclaw offline
semo bots status | grep workclaw
# 기대값: "○ offline"
```

---

### TC-06: kb search (OpenAI 시맨틱 검색)

```bash
semo kb search "봇 역할 분담"
# 기대값: 10개 결과, similarity_pct > 30%
# OPENAI_API_KEY 미설정 시: "검색 결과 없음" (시맨틱 검색 불가 — 정상)
```

---

### TC-07: kb embed (임베딩 생성)

```bash
# 임베딩 없는 항목 확인
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM semo.knowledge_base WHERE embedding IS NULL;"

semo kb embed
# 기대값: 0건 (이미 모두 임베딩 완료)
# 강제 재생성: semo kb embed --force (시간 소요)
```

---

### TC-08: get 명령 (리소스 조회)

```bash
semo get projects
# 기대값: 프로젝트 목록 출력

semo get bots
# 기대값: 7개 봇 JSON 출력

semo get kb --domain team
# 기대값: team 도메인 KB 항목 목록

semo get kb --search "인프라"
# 기대값: 시맨틱 검색 결과
```

---

### TC-09: OpenClaw 훅 — command:new (온라인 전환)

```bash
# 봇 OpenClaw 인스턴스에서 /new 실행 후:
semo bots status | grep <botname>
# 기대값: "● online"

# 로그 확인
# OpenClaw 게이트웨이 콘솔에서: "[semo-bot-status] workclaw → online"
```

---

### TC-10: OpenClaw 훅 — command:stop (오프라인 전환)

```bash
# 봇 OpenClaw 인스턴스에서 /stop 실행 후:
semo bots status | grep <botname>
# 기대값: "○ offline"
```

---

### TC-11: 크론잡 실행 검증

```bash
# 크론잡 등록 확인
crontab -l | grep semo
# 기대값: "*/15 * * * * ... semo bots sync ..."

# 수동 실행 테스트 (크론 대신)
/bin/sh -c "export DATABASE_URL='postgres://app:ProductionPassword2024!%40%23@localhost:15432/appdb' && semo bots sync"
# 기대값: "✔ bots sync 완료: 7개 봇 업서트"

# 15분 후 로그 확인
cat /tmp/semo-bots-sync.log
```

---

### TC-12: SessionStart 훅 자동 실행

```bash
# .claude/settings.json 훅 확인
cat .claude/settings.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['hooks'], indent=2))"
# 기대값:
# SessionStart → "semo context sync && semo bots sync"
# Stop → "semo context push"

# 새 Claude Code 세션 시작 후 memory 파일 mtime 확인
ls -la .claude/memory/*.md
# 기대값: 최신 시간으로 갱신됨
```

---

## E2E 검증 시나리오

### E2E-01: Reus 로컬 세션 전체 흐름

**시나리오**: Reus가 Claude Code 세션을 시작하고 작업 후 종료

```
1. SSH 터널 열기
   → ssh -f -N -L 15432:10.0.0.91:5432 -J opc@152.70.244.169 opc@10.0.0.91

2. Claude Code 세션 시작 (터미널에서)
   → SessionStart 훅 자동 실행
   → semo context sync: DB → .claude/memory/ 7개 파일 갱신
   → semo bots sync: bot-workspaces → semo.bot_status 7개 봇 갱신

3. 검증
   → ls -la .claude/memory/ (최신 mtime 확인)
   → semo bots status (7개 봇 표시)

4. decisions.md 수정 (아키텍처 결정 기록)
   → .claude/memory/decisions.md에 새 섹션 추가

5. Claude Code 세션 종료
   → Stop 훅 자동 실행
   → semo context push: decisions.md → semo.knowledge_base DB 업서트

6. DB에서 확인
   → psql "$DATABASE_URL" -c "SELECT key FROM semo.knowledge_base WHERE domain='decision' ORDER BY updated_at DESC LIMIT 5;"
```

**통과 기준**: decisions.md의 새 항목이 DB에 존재하면 통과

---

### E2E-02: OpenClaw 봇 세션 상태 동기화

**시나리오**: WorkClaw 봇이 세션 시작 → 작업 → 종료

```
1. 현재 workclaw 상태 확인
   → semo bots status | grep workclaw (offline 예상)

2. WorkClaw OpenClaw 인스턴스에서 /new 실행
   → command:new 이벤트 → semo-bot-status 훅 실행
   → semo bots set-status workclaw online

3. 로컬에서 확인
   → semo bots status | grep workclaw (● online 예상)
   → semo context sync → .claude/memory/bots.md에 online 반영 확인

4. WorkClaw에서 /stop 실행
   → command:stop 이벤트 → semo-bot-status 훅 실행
   → semo bots set-status workclaw offline

5. 확인
   → semo bots status | grep workclaw (○ offline 예상)
```

**통과 기준**: 봇 상태가 online/offline으로 DB에 실시간 반영되면 통과

---

### E2E-03: IDENTITY.md 변경 → 전파

**시나리오**: 봇의 이름/이모지를 변경하고 크론이 자동 전파

```
1. IDENTITY.md 수정 (예: workclaw)
   → semo-system/bot-workspaces/workclaw/IDENTITY.md 수정

2. 크론 수동 트리거
   → sh -c "export DATABASE_URL='...' && semo bots sync"

3. DB 확인
   → semo bots status | grep workclaw (새 이름/이모지 반영)

4. memory 파일 확인
   → semo context sync && grep workclaw .claude/memory/bots.md
```

**통과 기준**: IDENTITY.md 변경 → DB 갱신 → memory 반영까지 완전 전파되면 통과

---

### E2E-04: 시맨틱 검색 전체 파이프라인

**시나리오**: KB 항목 추가 → 임베딩 생성 → 검색

```
1. KB 항목 추가
   → psql "$DATABASE_URL" -c "INSERT INTO semo.knowledge_base (domain, key, content, created_by) VALUES ('test', 'e2e-test', 'E2E 테스트용 임시 항목', 'reus');"

2. 임베딩 생성
   → semo kb embed (OPENAI_API_KEY 필요)

3. 시맨틱 검색
   → semo kb search "e2e 테스트"
   # 기대값: 'test/e2e-test' 결과에 포함

4. 정리
   → psql "$DATABASE_URL" -c "DELETE FROM semo.knowledge_base WHERE key='e2e-test';"
```

**통과 기준**: 추가한 항목이 시맨틱 검색 결과에 나타나면 통과

---

### E2E-05: 크론 자동화 + 봇 워크스페이스 동기화

**시나리오**: 15분 주기 크론이 정상 실행되는지 확인

```
1. 현재 시간 기록
   → BEFORE=$(date +%s)

2. 15분 대기 or 수동 트리거
   → (수동) sh -c "export DATABASE_URL='...' && semo bots sync >> /tmp/semo-bots-sync.log 2>&1"

3. 로그 확인
   → tail -5 /tmp/semo-bots-sync.log
   # 기대값: "✔ bots sync 완료: 7개 봇 업서트"

4. DB synced_at 확인
   → psql "$DATABASE_URL" -c "SELECT bot_id, synced_at FROM semo.bot_status ORDER BY synced_at DESC;"
   # 기대값: 모든 봇의 synced_at이 BEFORE 이후 시간
```

**통과 기준**: 크론 로그에 성공 메시지 + DB synced_at 갱신되면 통과

---

## 빠른 전체 검증 스크립트

```bash
scripts/test-semo-hooks.sh
```

결과 예시:
```
[TC-01] semo doctor          ✅
[TC-02] context sync         ✅ 7 files
[TC-03] context push         ✅ 16 upserted
[TC-04] bots sync            ✅ 7 bots
[TC-05] bots set-status      ✅ online/offline
[TC-06] kb search            ✅ 10 results
[TC-07] kb embed             ✅ 0 missing
[TC-08] get commands         ✅
[TC-09] cron registered      ✅
[TC-10] hooks registered     ✅ 7 bots
```
