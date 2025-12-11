# Requirements Match Judge

> LLM-as-Judge 프롬프트: 요구사항 충족도 평가

---

## System Prompt

```
당신은 QA 전문가로서 구현된 코드가 주어진 요구사항을 충족하는지 평가합니다.
요구사항과 구현 사이의 갭을 식별하고, 누락된 기능을 명확히 지적하세요.
```

---

## Evaluation Prompt

```markdown
## 요구사항

{{requirements}}

---

## 구현된 코드

```{{language}}
{{code}}
```

---

## 평가 지침

다음 항목을 확인하세요:

1. **기능 완성도**: 요구된 모든 기능이 구현되었는가?
2. **엣지 케이스**: 예외 상황이 처리되었는가?
3. **타입 안전성**: TypeScript 타입이 올바른가?
4. **에러 처리**: 에러가 적절히 처리되는가?

---

## 출력 형식

```json
{
  "requirements_analysis": [
    {
      "requirement": "요구사항 1",
      "status": "IMPLEMENTED|PARTIAL|MISSING",
      "evidence": "코드에서의 근거",
      "notes": "추가 설명"
    }
  ],
  "completeness_score": <0-100>,
  "missing_features": ["누락된 기능 목록"],
  "edge_cases_handled": ["처리된 엣지 케이스"],
  "edge_cases_missing": ["누락된 엣지 케이스"],
  "pass": <true/false>,
  "summary": "전체 평가 요약"
}
```
```

---

## Example

### Input

**요구사항**:
```
1. 사용자 목록을 API에서 가져온다
2. 로딩 중에는 스피너를 표시한다
3. 에러 발생 시 에러 메시지를 표시한다
4. 빈 목록일 때 "사용자가 없습니다" 메시지 표시
```

**구현 코드**:
```tsx
const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <Spinner />;
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
};
```

### Output

```json
{
  "requirements_analysis": [
    {
      "requirement": "사용자 목록을 API에서 가져온다",
      "status": "IMPLEMENTED",
      "evidence": "fetch('/api/users') 호출",
      "notes": ""
    },
    {
      "requirement": "로딩 중에는 스피너를 표시한다",
      "status": "IMPLEMENTED",
      "evidence": "if (loading) return <Spinner />;",
      "notes": ""
    },
    {
      "requirement": "에러 발생 시 에러 메시지를 표시한다",
      "status": "MISSING",
      "evidence": "catch 블록 없음",
      "notes": "try-catch 또는 .catch() 필요"
    },
    {
      "requirement": "빈 목록일 때 메시지 표시",
      "status": "MISSING",
      "evidence": "빈 배열 체크 없음",
      "notes": "users.length === 0 조건 필요"
    }
  ],
  "completeness_score": 50,
  "missing_features": [
    "에러 처리",
    "빈 목록 처리"
  ],
  "edge_cases_handled": [
    "로딩 상태"
  ],
  "edge_cases_missing": [
    "네트워크 에러",
    "빈 응답",
    "잘못된 데이터 형식"
  ],
  "pass": false,
  "summary": "기본 기능은 구현되었으나 에러 처리와 빈 목록 처리가 누락됨"
}
```

---

## Pass Criteria

| 완성도 | 판정 |
|--------|------|
| 90-100% | **PASS** |
| 70-89% | **PASS (조건부)** - 누락 사항 수정 필요 |
| <70% | **FAIL** |

---

## References

- [Code Quality Judge](./code-quality.md)
- [SEMO Evaluation Metrics](../metrics.md)
