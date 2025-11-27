# Output Format

> feedback 스킬 출력 형식

## 초기 메시지

### 명시적 트리거

```markdown
[SAX] Skill: feedback 호출

## 📝 SAX 피드백

어떤 유형의 피드백인가요?

1. **🐛 버그**: 의도한 대로 동작하지 않았어요
2. **💡 제안**: 개선 아이디어가 있어요

번호를 선택하거나 자유롭게 설명해주세요.
```

### 암시적 트리거 (문제 해결 후)

```markdown
[SAX] 문제 해결 완료

**원인**: {문제 원인 설명}

---

⚠️ **{원인}** (으)로 인해 사용자가 의도하지 않은 동작이 발생했습니다.

협업 매니저 Reus를 위해 이 이슈를 피드백할까요?

> "피드백해줘" 또는 "괜찮아"로 응답해주세요.
```

## 정보 수집 메시지

### 버그 유형

```markdown
## 🐛 버그 리포트

다음 정보를 알려주세요:

1. **어떤 명령/질문을 했나요?**
2. **어떤 결과가 나왔나요?**
3. **어떤 결과를 원했나요?**

자유롭게 설명해주시면 제가 정리해드릴게요.
```

### 제안 유형

```markdown
## 💡 개선 제안

어떤 개선을 원하시나요?

자유롭게 설명해주시면 제가 정리해드릴게요.
```

## 확인 메시지

### 이슈 미리보기

```markdown
## 📋 이슈 미리보기

다음 내용으로 이슈를 생성할게요:

**제목**: {issue_title}
**유형**: {bug/enhancement}
**대상 저장소**: semicolon-devteam/sax-next

---

{이슈 본문 미리보기}

---

이대로 생성할까요? (Y/n)
```

## 완료 메시지

### 성공

```markdown
[SAX] Feedback: 이슈 생성 완료

✅ 피드백이 등록되었습니다!

**이슈**: semicolon-devteam/sax-next#{issue_number}
**제목**: {issue_title}
**유형**: {버그/제안}
**URL**: https://github.com/semicolon-devteam/sax-next/issues/{issue_number}

협업 매니저 Reus가 검토 후 처리할 예정입니다.
감사합니다! 🙏
```

### 실패

```markdown
[SAX] Feedback: 이슈 생성 실패

❌ 이슈 생성 중 오류가 발생했습니다.

**오류**: {error_message}

**대안**:
1. 수동으로 이슈 생성: https://github.com/semicolon-devteam/sax-next/issues/new
2. 나중에 다시 시도

문제가 지속되면 협업 매니저 Reus에게 직접 문의해주세요.
```

## 취소 메시지

```markdown
[SAX] Feedback: 취소됨

피드백 생성이 취소되었습니다.

나중에 피드백하고 싶으시면 `/SAX:feedback` 명령어를 사용해주세요.
```
