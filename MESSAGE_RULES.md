# SAX Message Rules

> SAX 메시지 포맷 및 출력 규칙 상세 정의

## 1. 메시지 포맷

### 1.1 기본 구조

```
[SAX] {Type}: {name} {action}
```

**구성 요소**:

| 요소 | 필수 | 설명 | 예시 |
|------|------|------|------|
| `[SAX]` | ✅ | 고정 접두사 | `[SAX]` |
| `Type` | ✅ | 메시지 유형 | `Agent`, `Skill`, `Reference` |
| `name` | ✅ | 대상 이름 | `epic-master`, `create-epic` |
| `action` | ✅ | 수행 동작 | `호출`, `사용`, `참조` |
| `(사유: ...)` | ❌ | 부가 설명 | `(사유: Epic 생성 요청)` |

### 1.2 확장 구조

```
[SAX] {Type}: {name} {action} → {result}
```

**추가 요소**:

| 요소 | 필수 | 설명 | 예시 |
|------|------|------|------|
| `→ {result}` | ❌ | 동작 결과 | `→ Epic 생성 완료` |

---

## 2. 메시지 유형 (Type)

### 2.1 Orchestrator

**용도**: 라우팅 결정 및 의도 분석

**포맷**:
```markdown
[SAX] Orchestrator: 의도 분석 완료 → {intent_category}

[SAX] Agent 위임: {agent_name} (사유: {reason})
```

**예시**:
```markdown
[SAX] Orchestrator: 의도 분석 완료 → Epic 생성 요청

[SAX] Agent 위임: epic-master (사유: 새 기능 Epic 생성)
```

### 2.2 Agent

**용도**: 에이전트 활성화 알림

**포맷**:
```markdown
[SAX] Agent: {agent_name} 호출 (트리거: {trigger})
```

**예시**:
```markdown
[SAX] Agent: implementation-master 호출 (트리거: "구현해줘" 키워드)
```

### 2.3 Skill

**용도**: 스킬 사용 알림

**포맷**:
```markdown
[SAX] Skill: {skill_name} 사용
```

**예시**:
```markdown
[SAX] Skill: scaffold-domain 사용

[SAX] Skill: fetch-supabase-example 사용
```

### 2.4 Reference

**용도**: 외부 리소스 참조 알림

**포맷**:
```markdown
[SAX] Reference: {source} 참조
```

**예시**:
```markdown
[SAX] Reference: core-supabase/document/test/posts 참조

[SAX] Reference: core-interface/openapi.yaml 참조
```

---

## 3. 출력 규칙

### 3.1 필수 규칙

| 규칙 | 설명 |
|------|------|
| **별도 줄 출력** | 각 SAX 메시지는 반드시 별도의 줄에 출력 |
| **빈 줄 삽입** | SAX 메시지들 사이에 반드시 빈 줄 삽입 |
| **본문 전 빈 줄** | SAX 메시지 출력 후 일반 텍스트 시작 전에 빈 줄 필수 |

### 3.2 올바른 예시

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 구현 요청

[SAX] Agent 위임: implementation-master (사유: 코드 구현)

## 구현을 시작합니다

...
```

### 3.3 잘못된 예시

```markdown
❌ [SAX] Orchestrator: 의도 분석 완료 → 구현 요청 [SAX] Agent 위임: implementation-master
(한 줄에 여러 메시지)

❌ [SAX] Agent 위임: implementation-master
## 구현을 시작합니다
(빈 줄 누락)
```

---

## 4. 상황별 메시지 패턴

### 4.1 Agent 라우팅 성공

```markdown
[SAX] Orchestrator: 의도 분석 완료 → {category}

[SAX] Agent 위임: {agent} (사유: {reason})
```

### 4.2 Agent 라우팅 실패

```markdown
[SAX] Orchestrator: 라우팅 실패 → 적절한 Agent 없음

⚠️ **직접 처리 필요**

현재 요청에 적합한 전담 Agent가 없습니다.

**요청 유형**: {request_type}
**처리 방법**:
1. 새 Agent 생성 필요 (권장: `Semicolon AX 새 에이전트 만들어줘`)
2. 또는 Claude Code 기본 동작으로 처리
```

### 4.3 Skill 체이닝

여러 Skill 연속 사용 시:

```markdown
[SAX] Skill: fetch-api-spec 사용

[SAX] Reference: core-interface/openapi.yaml 참조

[SAX] Skill: scaffold-domain 사용
```

### 4.4 Agent 간 위임

Agent가 다른 Agent 호출 시:

```markdown
[SAX] Agent: spec-master → quality-master 위임 (사유: 검증 필요)
```

---

## 5. 메시지 우선순위

### 5.1 출력 순서

1. **Orchestrator 분석** (최상위)
2. **Agent 위임/호출**
3. **Skill 사용**
4. **Reference 참조**

### 5.2 예시 시퀀스

```markdown
[SAX] Orchestrator: 의도 분석 완료 → Supabase 연동 구현

[SAX] Agent 위임: implementation-master (사유: Repository 구현)

[SAX] Skill: fetch-supabase-example 사용

[SAX] Reference: core-supabase/document/test/posts 참조

## CommentRepository 구현

RPC 함수 `comments_read`를 사용하여...
```

---

## 6. 특수 케이스

### 6.1 SAX 메타 작업

"Semicolon AX" 키워드 감지 시:

```markdown
[SAX] Agent: sax-architect 호출 (트리거: "Semicolon AX" 키워드)
```

### 6.2 Cross-Package Reference

다른 SAX 패키지 참조 시:

```markdown
[SAX] Reference: SAX-Core/PRINCIPLES.md 참조

[SAX] Reference: SAX-PO/templates/epic-template.md 참조
```

### 6.3 Error Handling

SAX 관련 오류 시:

```markdown
[SAX] Error: {error_type} → {description}
```

예시:
```markdown
[SAX] Error: Skill 실패 → fetch-api-spec에서 API 스펙을 찾을 수 없음
```

---

## 7. 금지 사항

### 7.1 메시지 생략

SAX 메시지는 **생략 불가**:

```markdown
❌ (Skill 사용 후 SAX 메시지 없이 바로 결과 출력)

✅ [SAX] Skill: verify 사용

   검증 결과: 모든 테스트 통과
```

### 7.2 포맷 변경

SAX 메시지 포맷은 **변경 불가**:

```markdown
❌ [SAX Agent] implementation-master 호출
❌ SAX: Agent implementation-master 호출
❌ [Agent] implementation-master 호출

✅ [SAX] Agent: implementation-master 호출
```

### 7.3 중첩 메시지

SAX 메시지는 **중첩 불가**:

```markdown
❌ [SAX] Agent: epic-master 호출 [SAX] Skill: create-epic 사용

✅ [SAX] Agent: epic-master 호출

   [SAX] Skill: create-epic 사용
```

---

## 8. 검증 체크리스트

SAX 메시지 출력 시 확인:

- [ ] `[SAX]` 접두사 포함
- [ ] Type이 정의된 유형 중 하나 (Orchestrator, Agent, Skill, Reference)
- [ ] name이 명확하게 명시됨
- [ ] action이 포함됨
- [ ] 각 메시지가 별도 줄에 출력됨
- [ ] 메시지 간 빈 줄 삽입됨
- [ ] 본문 시작 전 빈 줄 삽입됨

---

## 9. 참조

- [SAX Principles](./PRINCIPLES.md)
- [Packaging Guide](./PACKAGING.md)
