# SEMO Message Rules

> SEMO 메시지 포맷 및 출력 규칙 상세 정의

---

## 1. 메시지 포맷

### 1.1 기본 구조

```
[SEMO] {Type}: {name} {action}
```

**구성 요소**:

| 요소 | 필수 | 설명 | 예시 |
|------|------|------|------|
| `[SEMO]` | ✅ | 고정 접두사 | `[SEMO]` |
| `Type` | ✅ | 메시지 유형 | `Agent`, `Skill`, `Reference` |
| `name` | ✅ | 대상 이름 | `coder`, `implement` |
| `action` | ✅ | 수행 동작 | `호출`, `사용`, `참조` |
| `(사유: ...)` | ❌ | 부가 설명 | `(사유: 코드 구현 요청)` |

### 1.2 확장 구조

```
[SEMO] {Type}: {name} {action} → {result}
```

**추가 요소**:

| 요소 | 필수 | 설명 | 예시 |
|------|------|------|------|
| `→ {result}` | ❌ | 동작 결과 | `→ 구현 완료` |

---

## 2. 메시지 유형 (Type)

### 2.1 Orchestrator

**용도**: 라우팅 결정 및 의도 분석

**포맷**:
```markdown
[SEMO] Orchestrator: 의도 분석 완료 → {intent_category}

[SEMO] Skill 위임: {skill_name} (platform: {platform})
```

**예시**:
```markdown
[SEMO] Orchestrator: 의도 분석 완료 → 코드 구현 요청

[SEMO] Skill 위임: semo-skills/coder/implement (platform: nextjs)
```

### 2.2 Agent

**용도**: 에이전트 활성화 알림

**포맷**:
```markdown
[SEMO] Agent: {agent_name} 호출 (트리거: {trigger})
```

**예시**:
```markdown
[SEMO] Agent: orchestrator 호출 (트리거: 사용자 요청)
```

### 2.3 Skill

**용도**: 스킬 사용 알림

**포맷**:
```markdown
[SEMO] Skill: {skill_name} 사용
```

**예시**:
```markdown
[SEMO] Skill: implement 사용 (platform: nextjs)

[SEMO] Skill: scaffold 사용
```

### 2.4 Reference

**용도**: 외부 리소스 참조 알림

**포맷**:
```markdown
[SEMO] Reference: {source} 참조
```

**예시**:
```markdown
[SEMO] Reference: supabase-schema 참조

[SEMO] Reference: openapi.yaml 참조
```

---

## 3. 출력 규칙

### 3.1 필수 규칙

| 규칙 | 설명 |
|------|------|
| **별도 줄 출력** | 각 SEMO 메시지는 반드시 별도의 줄에 출력 |
| **빈 줄 삽입** | SEMO 메시지들 사이에 반드시 빈 줄 삽입 |
| **본문 전 빈 줄** | SEMO 메시지 출력 후 일반 텍스트 시작 전에 빈 줄 필수 |

### 3.2 올바른 예시

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → 구현 요청

[SEMO] Skill 위임: implement (platform: nextjs)

## 구현을 시작합니다

...
```

### 3.3 잘못된 예시

```markdown
❌ [SEMO] Orchestrator: 의도 분석 완료 → 구현 요청 [SEMO] Skill 위임: implement
(한 줄에 여러 메시지)

❌ [SEMO] Skill 위임: implement
## 구현을 시작합니다
(빈 줄 누락)
```

---

## 4. 상황별 메시지 패턴

### 4.1 Skill 라우팅 성공

```markdown
[SEMO] Orchestrator: 의도 분석 완료 → {category}

[SEMO] Skill 위임: {skill} (platform: {platform})
```

### 4.2 플랫폼 자동 감지

```markdown
[SEMO] Orchestrator: 플랫폼 감지 → {detected_platform}

[SEMO] Skill 위임: semo-skills/coder/implement (platform: {platform})
```

### 4.3 라우팅 실패

```markdown
[SEMO] Orchestrator: 라우팅 실패 → 적절한 Skill 없음

⚠️ **직접 처리 필요**

현재 요청에 적합한 Skill이 없습니다.
```

### 4.4 Skill 체이닝

여러 Skill 연속 사용 시:

```markdown
[SEMO] Skill: scaffold 사용

[SEMO] Reference: domain-template 참조

[SEMO] Skill: implement 사용
```

---

## 5. 하위 호환성

### 5.1 레거시 접두사 매핑

| 레거시 | 새 라우팅 |
|--------|----------|
| `[next]` | `[SEMO] Skill: coder (platform: nextjs)` |
| `[backend]` | `[SEMO] Skill: coder (platform: spring)` |
| `[po]` | `[SEMO] Skill: planner` |
| `[qa]` | `[SEMO] Skill: tester` |

### 5.2 Deprecation 경고

레거시 접두사 사용 시:

```markdown
[SEMO] Warning: [next] 접두사는 6개월 후 제거 예정입니다.
[SEMO] 권장: "코드 구현해줘" (Orchestrator가 플랫폼 자동 감지)
```

---

## 6. 금지 사항

### 6.1 메시지 생략

SEMO 메시지는 **생략 불가**:

```markdown
❌ (Skill 사용 후 SEMO 메시지 없이 바로 결과 출력)

✅ [SEMO] Skill: verify 사용

   검증 결과: 모든 테스트 통과
```

### 6.2 포맷 변경

SEMO 메시지 포맷은 **변경 불가**:

```markdown
❌ [SEMO Skill] implement 호출
❌ SEMO: Skill implement 호출
❌ [Skill] implement 호출

✅ [SEMO] Skill: implement 호출
```

### 6.3 SEMO 접두사 사용 (Deprecated)

```markdown
❌ [SEMO] Agent: implementation-master 호출

✅ [SEMO] Skill: implement 호출
```

---

## 7. 검증 체크리스트

SEMO 메시지 출력 시 확인:

- [ ] `[SEMO]` 접두사 포함
- [ ] Type이 정의된 유형 중 하나 (Orchestrator, Agent, Skill, Reference)
- [ ] name이 명확하게 명시됨
- [ ] action이 포함됨
- [ ] 각 메시지가 별도 줄에 출력됨
- [ ] 메시지 간 빈 줄 삽입됨
- [ ] 본문 시작 전 빈 줄 삽입됨

---

## 8. 참조

- [SEMO Principles](./PRINCIPLES.md)
- [Context Mesh](../../.claude/memory/)

---

*이 문서는 SEMO Message Rules를 SEMO 구조에 맞게 업데이트했습니다.*
*원본: SEMO Core → SEMO Core v2.0*
