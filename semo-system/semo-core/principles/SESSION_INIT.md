# Session Init

> 새 세션 시작 시 반드시 실행되는 초기화 프로세스

## 트리거 조건

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SEMO가 설치된 프로젝트 (`semo-system/` 존재)

## Step 1: 버전 체크

```bash
# 각 패키지 로컬 vs 원격 VERSION 비교
LOCAL=$(cat semo-system/{package}/VERSION 2>/dev/null)
REMOTE=$(gh api repos/semicolon-devteam/semo/contents/{package}/VERSION --jq '.content' | base64 -d 2>/dev/null)

# 비교 후 업데이트 안내
if [ "$LOCAL" != "$REMOTE" ]; then
  echo "업데이트 가능: $LOCAL → $REMOTE"
fi
```

## Step 2: 구조 검증

`skill:semo-architecture-checker` 호출:

- CLAUDE.md 심링크 유효성
- agents/, skills/, commands/SEMO/ 병합 상태
- 깨진 심링크 탐지 및 자동 복구

## 완료 출력

```markdown
[SEMO] 세션 초기화 완료
- semo-core: x.y.z ✅
- semo-skills: x.y.z ✅
- 구조: 정상 ✅
```

## 업데이트 필요 시

```markdown
[SEMO] 버전 체크 완료

📦 업데이트 가능:
  - semo-core: 1.0.0 → 1.0.1

💡 "semo update" 또는 "SEMO 업데이트해줘"로 업데이트하세요.
```
