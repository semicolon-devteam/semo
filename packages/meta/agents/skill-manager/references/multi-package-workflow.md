# Multi-Package Workflow

> 복수 패키지 접두사 명령 처리 가이드

## 패키지 접두사 시스템

SAX-Meta는 패키지별 또는 전체 패키지를 대상으로 작업할 수 있는 접두사 시스템을 지원합니다.

### 접두사 형식

| 접두사 | 대상 | 예시 |
|--------|------|------|
| `[po]` | sax-po 패키지만 | `[po] 새 Skill 추가해줘` |
| `[next]` | sax-next 패키지만 | `[next] Skill 수정해줘` |
| `[core]` | sax-core 패키지만 | `[core] 규칙 추가해줘` |
| `[meta]` | sax-meta 패키지만 | `[meta] Skill 삭제해줘` |
| `[po \| next]` | 복수 패키지 지정 | `[po \| next] 새 Skill 추가해줘` |
| `[all]` | 모든 패키지 | `[all] Skill 검토해줘` |
| (없음) | 문맥 기반 판단 | `새 Skill 추가해줘` |

### 복수 패키지 지정 (파이프 구문)

`|` (파이프)를 사용하여 여러 패키지를 동시에 지정할 수 있습니다.

**예시**:

- `[po | next]` → sax-po와 sax-next
- `[core | meta]` → sax-core와 sax-meta
- `[po | next | meta]` → sax-po, sax-next, sax-meta

## Multi-Package 워크플로우

### Step 1: 접두사 파싱

사용자 요청에서 패키지 접두사를 추출합니다.

```text
입력: "[po | next] 새 Skill 추가해줘"
파싱 결과:
  - 대상 패키지: ['sax-po', 'sax-next']
  - 작업: "새 Skill 추가해줘"
```

### Step 2: 패키지별 경로 매핑

| 패키지 | skills/ 경로 |
|--------|-------------|
| sax-po | `sax-po/skills/` |
| sax-next | `sax-next/skills/` |
| sax-meta | `sax-meta/skills/` |
| sax-core | `sax-core/` (skills 없음) |

### Step 3: 순차 실행 (권장)

복수 패키지 대상 작업 시 **순차적으로** 처리합니다.

**이유**:

- 패키지 간 일관성 유지
- 에러 발생 시 개별 롤백 가능
- 진행 상황 명확한 추적

**실행 순서**:

1. 첫 번째 패키지 작업 완료
2. 결과 확인 및 검증
3. 두 번째 패키지 동일 작업 적용
4. 반복...
5. 전체 완료 보고

### Step 4: SAX 메시지 출력

복수 패키지 작업 시 진행 상황을 명확히 출력합니다.

```markdown
[SAX] Agent: skill-manager 호출 - Multi-Package Skill 생성

📦 **대상 패키지**: sax-po, sax-next

---

## 1/2: sax-po

[SAX] Agent: skill-manager 호출 - Skill 생성

✅ sax-po/skills/{skill-name}/SKILL.md 생성 완료

---

## 2/2: sax-next

[SAX] Agent: skill-manager 호출 - Skill 생성

✅ sax-next/skills/{skill-name}/SKILL.md 생성 완료

---

[SAX] Multi-Package 작업 완료

**결과**:
- sax-po: ✅ 성공
- sax-next: ✅ 성공

**생성된 파일**:
- `sax-po/skills/{skill-name}/SKILL.md`
- `sax-next/skills/{skill-name}/SKILL.md`
```

## 에러 처리

### 부분 실패 시

일부 패키지에서 에러 발생 시 중단하고 보고합니다.

```markdown
[SAX] Multi-Package 작업 중단

⚠️ **부분 실패**

**성공**:
- sax-po: ✅ 완료

**실패**:
- sax-next: ❌ 에러 (이미 동일 이름의 Skill 존재)

**조치 필요**:
1. 에러 원인 확인 후 재시도
2. 또는 성공한 패키지의 변경사항 롤백

어떻게 진행할까요?
```

### 롤백 옵션

```markdown
[SAX] 롤백 옵션

1. **전체 롤백**: 성공한 패키지의 변경도 취소
2. **부분 유지**: 성공한 패키지는 유지, 실패한 패키지만 재시도
3. **수동 처리**: 사용자가 직접 개별 패키지 처리

선택해주세요.
```

## 패키지별 차이점 처리

동일한 Skill이라도 패키지별로 다른 설정이 필요할 수 있습니다.

### 예시: feedback Skill

| 패키지 | 차이점 |
|--------|--------|
| sax-po | `--repo semicolon-devteam/sax-po`, 라벨 `sax-po` |
| sax-next | `--repo semicolon-devteam/sax-next`, 라벨 `sax-next` |
| sax-meta | `--repo semicolon-devteam/sax-meta`, 라벨 `sax-meta` |

### 처리 방식

1. **템플릿 기반**: 공통 구조는 템플릿으로, 패키지별 변수만 교체
2. **확인 질문**: 패키지별 다른 설정이 필요한 경우 사용자에게 확인

```markdown
[SAX] 패키지별 설정 확인 필요

**{skill-name}** Skill의 GitHub 레포지토리 설정:

- sax-po: `semicolon-devteam/sax-po` (기본값)
- sax-next: `semicolon-devteam/sax-next` (기본값)

기본값으로 진행할까요? 또는 개별 설정이 필요하신가요?
```

## Skill 구조 동기화

복수 패키지에 동일 Skill 생성 시 구조를 동기화합니다.

### 필수 동기화 항목

| 항목 | 설명 |
|------|------|
| `SKILL.md` | Skill 메인 정의 파일 |
| `references/` | 참조 문서 디렉토리 |
| Frontmatter | name, description, tools, model |

### 패키지별 커스터마이징 허용 항목

| 항목 | 설명 |
|------|------|
| 레포지토리 경로 | 이슈 생성 대상 레포 |
| 라벨 | 패키지별 라벨 |
| 특정 워크플로우 | 패키지 특성에 따른 차이 |

## Reference

- [CLAUDE.md - 패키지 접두사 명령 규칙](../../../CLAUDE.md#4-패키지-접두사-명령-규칙)
- [create-workflow.md](create-workflow.md) - Skill 생성 워크플로우
