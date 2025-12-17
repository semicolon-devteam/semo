# /SEMO:feedback

SEMO 피드백을 제출합니다.

## 사용법

```
/SEMO:feedback
```

## 동작

`feedback` 스킬을 호출하여 SEMO에 대한 피드백(버그 리포트, 기능 요청)을 GitHub 이슈로 생성합니다.

## 워크플로우

1. **피드백 유형 선택**
   - 버그 리포트: `[Bug]` 라벨
   - 기능 요청: `[Feature]` 라벨

2. **이슈 생성**
   - `semicolon-devteam/semo` 레포지토리에 이슈 생성
   - 이슈관리 프로젝트에 자동 추가

3. **확인 메시지**
   ```
   [SEMO] Skill: feedback → 피드백 등록 완료

   📋 이슈: #123
   🔗 https://github.com/semicolon-devteam/semo/issues/123
   ```

## 예시

```
User: /SEMO:feedback

Claude: 어떤 피드백을 등록하시겠습니까?

1. 🐛 버그 리포트
2. ✨ 기능 요청

선택:
```

## 참조 스킬

- `feedback` - 피드백 및 이슈 관리 스킬
