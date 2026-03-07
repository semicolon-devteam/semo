# WorkClaw 진단 리포트 (2026-02-24)

## 🔴 문제 요약
- **증상**: 4시간 동안 "하겠습니다" 반복, tool call 없음, 작업 미진행
- **사건**: 베베케어 버그 리포트 → WorkClaw 작업 선언 → 실제 작업 없음
- **영향**: Roki 신뢰도 하락, PM(SemiClaw) 감독 실패

## 🔍 근본 원인 분석

### 1. 구조화된 작업 vs 비구조화된 작업
**2/23 (정상 작동)**
- GitHub 폴링 → #139 이슈 검출
- 명확한 스펙 (sitemap.xml 개선)
- 체크리스트 따라 구현 → PR 생성 → 라벨 변경 → ReviewClaw 멘션
- ✅ 성공

**2/24 (실패)**
- Slack 자유 대화 → 버그 리포트
- 불명확한 경로 (재현? 이슈 생성? 코드 분석?)
- "하겠습니다" 반복 → tool call 없음 → 작업 정지
- ❌ 실패

**결론**: WorkClaw은 **구조화된 작업(GitHub 이슈)**은 잘 처리하지만, **비구조화된 작업(Slack 자유 대화)**에서 막힌다.

### 2. SOUL.md 원칙 vs 실제 행동 불일치
**SOUL.md에는 명시:**
> **원칙: 한 거 보고해. 할 거 예고하지 마.**
> **Actions speak louder than filler words.**

**실제 행동:**
- "지금 바로 시작하겠습니다" ← 할 거 예고
- "작업 시작합니다!" ← 할 거 예고
- Tool call 없음 ← 행동 없음

**결론**: 프롬프트에는 원칙이 있지만, 실제로 tool call을 트리거하는 메커니즘이 약함.

### 3. 복잡한 작업 → 서브에이전트 활용 실패
**베베케어 버그 작업 단계:**
1. 레포 분석 (경로 확인, 코드 구조 파악)
2. GitHub 이슈 생성 (재현 단계 정리)
3. 로컬 재현 테스트 (또는 스테이징 확인)
4. 원인 파악 및 수정

**WorkClaw이 했어야 할 것:**
- 단계별 tool call (gh repo clone, gh issue create, exec 등)
- 또는 sub-agent로 위임 (`sessions_spawn`)

**실제로 한 것:**
- 말만 함

**결론**: 복잡한 작업을 단계별로 쪼개거나 sub-agent로 위임하는 능력이 부족.

### 4. PM(SemiClaw) 감독 실패
**SemiClaw의 약속:**
- "15분 내 Step 1 완료 안 되면 내가 직접 할게"
- "감독 체계 세팅 완료"

**실제로 한 것:**
- 4시간 동안 방치

**결론**: SemiClaw도 WorkClaw과 똑같은 "하겠습니다" 패턴 반복. **메타 문제**.

## 🛠️ 해결 방안

### 즉시 조치 (오늘 중)

#### 1. WorkClaw AGENTS.md에 "Tool call 먼저" 규칙 추가
```markdown
## 🚨 "하겠습니다" 전면 금지

❌ 금지: "지금 바로 시작하겠습니다" / "작업 시작합니다" / "진행하겠습니다"
✅ 허용: Tool call 먼저 → 그 다음 설명

**원칙:**
1. 말하기 전에 행동
2. Tool call 없는 약속 금지
3. 첫 번째 응답에 반드시 tool call 포함

**예시:**
❌ "레포 클론하겠습니다" → tool call 없음
✅ `gh repo clone ...` → "레포 클론 완료"
```

#### 2. Slack 요청 → 즉시 GitHub 이슈 변환 규칙
```markdown
## Slack 버그/작업 요청 수신 시

1. ❌ "하겠습니다" 말하지 않기
2. ✅ 즉시 GitHub 이슈 생성:
   ```bash
   gh issue create --repo <repo> --title "<요약>" --body "<재현 단계>"
   ```
3. Projects 보드 등록
4. `bot:spec-ready` 또는 `bot:in-progress` 라벨 부착
5. 이슈 URL을 Slack에 공유
6. 이후 GitHub 이슈 워크플로우 따라 진행
```

#### 3. 타임아웃 & 체크인 시스템
```markdown
## 작업 타임아웃

- 작업 시작 선언 후 **15분 내 tool call 없음** → #bot-ops에서 SemiClaw 알림
- 1시간 내 진전 없음 → 자동 bot:blocked 처리
```

### 단기 조치 (이번 주)

#### 4. `bot-tasks-in-progress.json` 시스템
```json
{
  "tasks": [
    {
      "id": "bebecare-bug-2024-02-24",
      "bot": "WorkClaw",
      "start": 1771916523,
      "description": "베베케어 온보딩 버그 처리",
      "checkpoints": [
        "repo clone",
        "issue created",
        "local test",
        "PR created"
      ],
      "lastUpdate": 1771916523,
      "status": "in-progress"
    }
  ]
}
```

- 봇이 작업 시작 선언 → 이 파일에 기록
- Cron job: 15분마다 체크 → 진전 없으면 알림

#### 5. 서브에이전트 활용 체크리스트
```markdown
## 복잡한 작업 = 서브에이전트

**서브에이전트로 위임해야 하는 신호:**
- 3단계 이상 작업 (레포 분석 + 이슈 생성 + 테스트)
- 30분 이상 걸릴 것 같은 작업
- 불명확한 요구사항 (탐색 필요)

**서브에이전트 사용법:**
```bash
sessions_spawn --task "베베케어 레포에서 온보딩 버그 재현 후 GitHub 이슈 생성. 재현 단계: ..." --agentId workclaw
```
```

### 중기 조치 (다음 주)

#### 6. WorkClaw 프롬프트 재설계
- SOUL.md "한 거 보고해" 원칙 강화
- Tool call 트리거 로직 개선
- 복잡한 작업 감지 → 자동으로 sub-agent 제안

#### 7. 봇 헬스체크 시스템
- 주기적으로 각 봇의 "하겠습니다" 패턴 감지
- 패턴 발견 시 자동 재교육 트리거

## 📝 액션 아이템

### SemiClaw (나)
- [ ] WorkClaw AGENTS.md에 "Tool call 먼저" 규칙 추가
- [ ] WorkClaw AGENTS.md에 "Slack → GitHub 이슈 변환" 규칙 추가
- [ ] `memory/decisions.md`에 이번 사건 기록
- [ ] `bot-tasks-in-progress.json` 시스템 설계 (이번 주)
- [ ] 봇 헬스체크 cron job 설계 (다음 주)

### WorkClaw
- [ ] (자동) 규칙 업데이트 후 다음 세션부터 적용

### Roki
- [ ] WorkClaw에게 작업 요청 시: "이슈 생성부터 해줘" 같이 명확한 첫 단계 지시

## 🎯 성공 지표

**단기 (1주일):**
- WorkClaw "하겠습니다" 패턴 0건
- Slack 요청 → GitHub 이슈 전환율 100%
- 타임아웃 알림 작동

**중기 (1개월):**
- 봇 작업 정지(4시간+ 무응답) 0건
- 서브에이전트 활용 증가
- Roki 신뢰도 회복
