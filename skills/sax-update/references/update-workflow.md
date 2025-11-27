# Update Workflow

## 전체 흐름

```
사용자: "SAX 업데이트해줘"
    ↓
Orchestrator: 의도 분석 → SAX 업데이트
    ↓
skill:sax-update 호출
    ↓
1. 설치 방식 감지 (submodule vs 복사)
    ↓
2. 현재 버전 확인
    ↓
3. GitHub에서 최신 버전 pull
    ↓
4. 결과 출력
```

## 설치 방식별 처리

### Submodule 방식 (권장)

```bash
# sax-core 업데이트
cd .claude/sax-core
git fetch origin
git pull origin main
cd ../..

# sax-next 업데이트 (있는 경우)
if [ -d ".claude/sax-next" ]; then
  cd .claude/sax-next
  git fetch origin
  git pull origin main
  cd ../..
fi
```

### 복사 방식

복사 방식은 자동 업데이트가 불가능합니다.

사용자에게 다음을 안내:
1. docs 레포에서 deploy.sh 실행
2. 또는 submodule 방식으로 전환 권장

```bash
# docs 레포에서 실행
./sax/scripts/deploy.sh sax-next /path/to/project
```

## 버전 비교

```bash
# 로컬 버전
LOCAL_CORE=$(cat .claude/sax-core/VERSION)
LOCAL_NEXT=$(cat .claude/sax-next/VERSION 2>/dev/null || cat .claude/VERSION)

# 원격 버전 (GitHub API)
REMOTE_CORE=$(gh api repos/semicolon-devteam/sax-core/contents/VERSION --jq '.content' | base64 -d)
REMOTE_NEXT=$(gh api repos/semicolon-devteam/sax-next/contents/VERSION --jq '.content' | base64 -d)
```

## 롤백

문제 발생 시:

```bash
cd .claude/sax-core
git checkout HEAD~1
cd ../..
```
