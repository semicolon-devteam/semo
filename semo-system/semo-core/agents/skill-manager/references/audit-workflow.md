# Audit Workflow

> skill-manager Agent의 Skill 분석 워크플로우

## Phase 4: 분석 (Audit)

### 4.1 분석 범위 결정

- **단일 Skill 분석**: 특정 Skill의 품질 검증
- **패키지 단위 분석**: 특정 패키지(SEMO-PO, SEMO-Meta 등)의 모든 Skills 검증
- **전체 분석**: 모든 SEMO 패키지의 Skills 검증

### 4.2 Anthropic Skills 표준 체크리스트

**✅ Frontmatter 검증**:

- `name`: kebab-case 형식인가?
- `description`: 역할 요약 + "Use when (조건1, 조건2, 조건3)" 포함하는가?
- `tools`: 필요한 도구만 명시되어 있는가?

**✅ 시스템 메시지 규칙 검증**:

- Frontmatter 바로 다음 줄에 시스템 메시지 blockquote가 있는가?
- 형식: `> **🔔 시스템 메시지**: 이 Skill이 호출되면 \`[SEMO] Skill: {skill-name} 호출 - {context}\` 시스템 메시지를 첫 줄에 출력하세요.`

**✅ Progressive Disclosure 검증**:

- SKILL.md 라인 수가 100 lines 이하인가?
- 100 lines 초과 시 references/ 디렉토리가 있는가?
- references/ 구조가 적절한가?

**✅ 구조 검증**:

- Quick Start 섹션이 있는가?
- SEMO Message 포맷이 명시되어 있는가?
- Related 링크가 유효한가?

**✅ 내용 품질 검증**:

- Claude가 이미 아는 내용을 반복하지 않는가?
- SAX/팀 고유의 워크플로우만 포함하는가?
- 불필요한 장황한 설명이 없는가?

### 4.3 분석 수행

```bash
# 패키지별 Skills 디렉토리 탐색
ls -la sax/packages/{package}/skills/

# 각 Skill 분석
for skill in sax/packages/{package}/skills/*/; do
  # SKILL.md 읽기
  cat "$skill/SKILL.md"

  # 라인 수 확인
  wc -l "$skill/SKILL.md"

  # references/ 존재 확인
  ls -la "$skill/references/" 2>/dev/null

  # Frontmatter 파싱
  head -n 10 "$skill/SKILL.md" | grep -E "^(name|description|tools):"
done
```

### 4.4 분석 결과 정리

**패키지별 그루핑**:

```markdown
## 📊 SEMO Skills 분석 결과

### SEMO-PO

#### ✅ 표준 준수 Skills (수정 불필요)
- `skill-a`: SKILL.md 85 lines, references/ 적절히 분리

#### ⚠️ 개선 필요 Skills
- `skill-b`:
  - 문제: SKILL.md 150 lines (100 lines 초과)
  - 권장: references/ 분리 필요
- `skill-c`:
  - 문제: description에 "Use when" 누락
  - 권장: Frontmatter description 업데이트

### SEMO-Meta

#### ✅ 표준 준수 Skills
- ...

#### ⚠️ 개선 필요 Skills
- ...
```

**우선순위 분류**:

- 🔴 **Critical**: 표준 위반이 심각한 경우 (200 lines 초과, Frontmatter 누락 등)
- 🟡 **Important**: 개선이 필요하나 기능에는 문제 없음 (100-200 lines, description 개선 필요)
- 🟢 **Nice-to-have**: 선택적 개선 (구조 최적화, 문서 개선 등)

### 4.5 개선 방안 제시

```markdown
## 🔧 개선 방안

### skill-b (SEMO-PO)

**현재 상태**:
- SKILL.md: 150 lines
- references/: 없음

**권장 구조**:
- SKILL.md: ~70 lines (overview + quick start)
- references/workflow.md: 상세 프로세스 (50 lines)
- references/examples.md: 사용 예시 (30 lines)

**예상 효과**:
- 53% 라인 감소
- Progressive Disclosure 패턴 적용
- 가독성 향상
```

## Output Format

```markdown
## 📊 SEMO Skills 분석 완료

**분석 범위**: {단일 Skill | 패키지 단위 | 전체}
**분석 기준**: Anthropic Skills 표준

### 패키지별 분석 결과

#### SEMO-PO

**✅ 표준 준수**: {count}개
**⚠️ 개선 필요**: {count}개
- 🔴 Critical: {count}개
- 🟡 Important: {count}개
- 🟢 Nice-to-have: {count}개

#### SEMO-Meta

**✅ 표준 준수**: {count}개
**⚠️ 개선 필요**: {count}개

### 상세 개선 리스트

[패키지별 개선 필요 Skills 상세 리스트]

### 권장 조치

1. 우선순위별 개선 작업 진행
2. Progressive Disclosure 패턴 적용
3. Frontmatter description 표준화
```
