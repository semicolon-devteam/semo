# Issue Parsing

이슈 본문에서 QA 테스트 체크리스트 파싱

## QA 테스트 섹션 형식

### 표준 형식

```markdown
## QA 테스트

- [ ] 로그인 기능 테스트
- [x] 회원가입 기능 테스트
- [ ] 비밀번호 재설정 테스트
```

### 변형 형식

```markdown
### QA 테스트

- [ ] 테스트 항목 1
- [x] 테스트 항목 2
```

```markdown
## QA Test

- [ ] Test case 1
- [x] Test case 2
```

## 정규식 패턴

### 섹션 헤더 매칭

```regex
^##+ QA (테스트|Test)
```

### 체크리스트 매칭

```regex
^- \[([ x])\] (.+)$
```

캡처 그룹:
1. 체크 상태: ` ` (미완료) 또는 `x` (완료)
2. 항목 내용

## 파싱 예시

### 입력

```markdown
## 설명

이슈 설명 내용

## QA 테스트

- [x] 로그인 기능 테스트
- [ ] 회원가입 기능 테스트
- [ ] 비밀번호 재설정 테스트

## 추가 정보

기타 내용
```

### 파싱 결과

```json
{
  "total": 3,
  "completed": 1,
  "incomplete": 2,
  "items": [
    {"checked": true, "text": "로그인 기능 테스트"},
    {"checked": false, "text": "회원가입 기능 테스트"},
    {"checked": false, "text": "비밀번호 재설정 테스트"}
  ],
  "progress": 33.33
}
```

## Bash 구현

```bash
#!/bin/bash

# 이슈 본문 가져오기
body=$(gh issue view $issue_number --json body --jq '.body')

# QA 테스트 섹션 추출
qa_section=$(echo "$body" | awk '/^## QA (테스트|Test)/,/^##/')

# 체크리스트 파싱
total=0
completed=0

while IFS= read -r line; do
    if [[ "$line" =~ ^-\ \[([\ x])\]\ (.+)$ ]]; then
        total=$((total + 1))
        check="${BASH_REMATCH[1]}"
        text="${BASH_REMATCH[2]}"

        if [ "$check" = "x" ]; then
            completed=$((completed + 1))
            echo "✅ $text"
        else
            echo "⬜ $text"
        fi
    fi
done <<< "$qa_section"

# 진행률 계산
if [ $total -gt 0 ]; then
    progress=$((completed * 100 / total))
    echo ""
    echo "진행률: $completed/$total ($progress%)"
fi
```

## jq 구현

```bash
# 이슈 본문을 파일로 저장
gh issue view $issue_number --json body --jq '.body' > issue_body.md

# Python으로 파싱 (jq는 마크다운 파싱에 한계)
python3 << 'EOF'
import re
import sys

with open('issue_body.md', 'r') as f:
    body = f.read()

# QA 테스트 섹션 추출
qa_match = re.search(r'^## QA (테스트|Test)\s*\n((?:- \[[ x]\] .+\n?)+)', body, re.MULTILINE)

if not qa_match:
    print("⚠️ QA 테스트 섹션이 없습니다")
    sys.exit(1)

qa_content = qa_match.group(2)

# 체크리스트 파싱
items = re.findall(r'^- \[([ x])\] (.+)$', qa_content, re.MULTILINE)

total = len(items)
completed = sum(1 for check, _ in items if check == 'x')

for check, text in items:
    if check == 'x':
        print(f"✅ {text}")
    else:
        print(f"⬜ {text}")

if total > 0:
    progress = completed * 100 / total
    print(f"\n진행률: {completed}/{total} ({progress:.0f}%)")
EOF
```

## 엣지 케이스

### QA 테스트 섹션 없음

```markdown
## 설명

QA 테스트 체크리스트가 없는 이슈
```

처리:
```
⚠️ QA 테스트 섹션이 없습니다
```

### 빈 체크리스트

```markdown
## QA 테스트

(체크리스트 항목 없음)
```

처리:
```
⚠️ QA 테스트 항목이 없습니다
```

### 다중 섹션

```markdown
## QA 테스트 (기능)

- [x] 기능 테스트 1

## QA 테스트 (성능)

- [ ] 성능 테스트 1
```

처리: 첫 번째 섹션만 파싱 또는 모든 섹션 병합

## 참고

- [GitHub Flavored Markdown](https://github.github.com/gfm/)
- [Task Lists](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/about-task-lists)
