# bot:blocked 규칙 위반 사건 (2026-02-23)

## 사건 개요
- **시각**: 2026-02-23 19:56 KST
- **위반 봇**: ReviewClaw
- **레포**: cm-jungchipan
- **이슈**: #150 (bot:blocked 상태)
- **PR**: #154 (ReviewClaw이 리뷰 후 머지됨)

## 경위
1. 이슈 #150에 `bot:blocked` 라벨 존재
2. Harry Lee가 해당 기능 작업 중
3. ReviewClaw이 PR #154 리뷰 시 bot:blocked 확인 누락
4. ReviewClaw이 approve → 머지 진행 (머지자: reus-jeon)
5. Harry Lee가 #proj-jungchipan에서 지적: "bot:blocked 건드리지 말아야 함"

## Harry Lee 요구사항
> "bot:blocked 걸려있는걸 왜 작업하지? 봇 전체에게 blocked 걸려있는거 건들지 않도록 규칙 최우선으로 해야해"

## 현재 조치
- WorkClaw에게 긴급 리버트 요청
- PR #154 리버트 후 이슈 #150은 Harry에게 복귀

## 근본 원인
1. **ReviewClaw 폴링 쿼리에 bot:blocked 제외 조건 없음**
   - 현재 쿼리: `is:pr is:open review:none`
   - 필요 쿼리: `is:pr is:open review:none -label:bot:blocked`

2. **연결된 이슈의 bot:blocked 상태 확인 프로세스 부재**
   - PR 리뷰 시 연결 이슈 라벨 체크 안 함

3. **ReviewClaw SOUL.md에 bot:blocked 최우선 규칙 없음**

## 권장 조치 (Harry 요구사항 반영)
1. **모든 봇에 bot:blocked 최우선 규칙 추가**
   ```markdown
   ## 🚨 최우선 규칙: bot:blocked
   - `bot:blocked` 라벨이 있는 이슈/PR은 절대 작업 금지
   - 연결된 이슈에 bot:blocked 있어도 작업 금지
   - 예외 없음
   ```

2. **ReviewClaw 폴링 쿼리 수정**
   ```
   is:pr is:open review:none -label:bot:blocked
   ```

3. **ReviewClaw에 이슈 라벨 사전 체크 로직 추가**
   - PR 리뷰 전 연결 이슈의 라벨 확인
   - bot:blocked 발견 시 리뷰 스킵 + SemiClaw 알림

## 재발 방지
- 모든 봇 AGENTS.md 상단에 bot:blocked 경고 추가
- 폴링 쿼리에 `-label:bot:blocked` 필수화
- 정기 감사: bot:blocked 이슈/PR에 봇 활동 있는지 체크
