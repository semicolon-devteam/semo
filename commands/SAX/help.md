# /SAX:help Command

SAX-QA 패키지 사용 가이드를 표시합니다.

## Trigger

- `/SAX:help` 명령어
- "도움말", "뭘 해야 하지", "help" 키워드

## Action

QA 워크플로우 가이드와 사용 가능한 명령어를 안내합니다.

## Output Format

```markdown
[SAX] QA 도움말

# SAX-QA 도움말

**패키지**: SAX-QA v{version}
**대상**: QA 테스터

## 📋 사용 가능한 명령어

### 테스트 실행
| 명령어 | 설명 |
|--------|------|
| `/SAX:run-test` | 새 테스트 실행 시작 |
| `/SAX:test-pass` | 테스트 통과 처리 |
| `/SAX:test-fail` | 테스트 실패 및 버그 리포트 |
| `/SAX:test-queue` | 대기 중인 테스트 목록 확인 |

### 피드백
| 명령어 | 설명 |
|--------|------|
| `/SAX:feedback` | SAX 피드백/버그 신고 |

## 🔄 QA 워크플로우

### 1. 테스트 시작
```
/SAX:run-test
```
- GitHub 이슈 선택
- 테스트 케이스 자동 생성
- STG 환경 검증

### 2. 테스트 실행 중
```
"이 이슈 테스트 중이야"
```
- Iteration Tracker로 진행 상황 기록
- 체크리스트 기반 테스트

### 3. 테스트 완료
**통과 시:**
```
/SAX:test-pass
```

**실패 시:**
```
/SAX:test-fail
```
- 버그 리포트 자동 생성
- 개발자에게 알림

### 4. 프로덕션 배포 체크
```
"프로덕션 배포 체크해줘"
```
- Production Gate로 체크리스트 확인
- 배포 가능 여부 판단

## 💡 팁

- **현재 업무 확인**: "지금 뭐 테스트해야 돼?"
- **이슈 상태 변경**: "이 이슈 테스트중으로 바꿔줘"
- **테스트 케이스 검증**: "이 테스트 케이스 검토해줘"

## 🔗 관련 문서

- [QA Master Agent](../../agents/qa-master/qa-master.md)
- [Test Queue Skill](../../skills/test-queue/SKILL.md)
```

## Implementation

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 도움 요청

[SAX] QA 도움말 표시
```

## Related

- [feedback Command](feedback.md) - SAX 피드백
- [run-test Command](run-test.md) - 테스트 시작
