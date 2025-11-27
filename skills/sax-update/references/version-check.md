# Version Check

## 버전 파일 위치

| 패키지 | 버전 파일 경로 |
|--------|---------------|
| sax-core | `.claude/sax-core/VERSION` |
| sax-next | `.claude/sax-next/VERSION` 또는 `.claude/VERSION` |

## 버전 확인 명령

```bash
# 전체 버전 확인
echo "=== SAX 버전 정보 ==="
echo "sax-core: $(cat .claude/sax-core/VERSION 2>/dev/null || echo 'not installed')"
echo "sax-next: $(cat .claude/sax-next/VERSION 2>/dev/null || cat .claude/VERSION 2>/dev/null || echo 'not installed')"
```

## GitHub 최신 버전 확인

```bash
# GitHub API로 최신 버전 확인
gh api repos/semicolon-devteam/sax-core/contents/VERSION --jq '.content' | base64 -d
gh api repos/semicolon-devteam/sax-next/contents/VERSION --jq '.content' | base64 -d
```

## 버전 비교 로직

```bash
LOCAL=$(cat .claude/sax-core/VERSION | tr -d '\n')
REMOTE=$(gh api repos/semicolon-devteam/sax-core/contents/VERSION --jq '.content' | base64 -d | tr -d '\n')

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "✅ 최신 버전입니다: $LOCAL"
else
  echo "⬆️ 업데이트 가능: $LOCAL → $REMOTE"
fi
```

## Semantic Versioning

SAX는 Semantic Versioning을 따릅니다:

- **MAJOR**: Breaking changes
- **MINOR**: 새 기능 추가 (Agent/Skill/Command)
- **PATCH**: 버그 수정, 오타 수정
