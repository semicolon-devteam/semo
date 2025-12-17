# Output Format

## Migration Analysis Report Template

```markdown
# 🔄 Migration Analysis Report

**프로젝트**: [프로젝트명]
**분석일**: [날짜]
**분석자**: migration-analyzer skill

---

## 📊 Executive Summary

**전체 준수율**: [X]%
**예상 작업량**: [Small/Medium/Large]
**권장 우선순위**: [목록]

---

## 🏗️ Structure Analysis

### DDD Architecture

| Layer | 현재 상태 | 규격 | Gap |
|-------|----------|------|-----|
| Repository | [경로/없음] | `app/{domain}/_repositories/` | [✅/❌] |
| API Client | [경로/없음] | `app/{domain}/_api-clients/` | [✅/❌] |
| Hooks | [경로/없음] | `app/{domain}/_hooks/` | [✅/❌] |
| Components | [경로/없음] | `app/{domain}/_components/` | [✅/❌] |

### Atomic Design

| Layer | 현재 상태 | 규격 | Gap |
|-------|----------|------|-----|
| atoms/ | [존재/없음] | `components/atoms/` | [✅/❌] |
| molecules/ | [존재/없음] | `components/molecules/` | [✅/❌] |
| organisms/ | [존재/없음] | `components/organisms/` | [✅/❌] |
| templates/ | [존재/없음] | `components/templates/` | [✅/❌] |

---

## 📄 Documentation Gap

| 문서 | 상태 | 필요 작업 |
|------|------|-----------|
| CLAUDE.md | [✅/❌] | [복사/융합/신규] |
| .claude/ | [✅/❌] | [복사/수정/신규] |
| Constitution | [✅/❌] | [복사/수정/신규] |
| README.md | [✅/❌] | [복사/융합/신규] |
| templates/ | [✅/❌] | [복사 필요] |

---

## ⚠️ Architecture Violations

### Critical (즉시 수정 필요)

1. **[위반 사항]**
   - 위치: `[파일 경로]`
   - 문제: [설명]
   - 해결: [수정 방법]

### Warning (권장 수정)

1. **[위반 사항]**
   - 위치: `[파일 경로]`
   - 문제: [설명]
   - 해결: [수정 방법]

---

## 🗂️ Supabase Integration

### Storage

| 항목 | 현재 | 규격 | 상태 |
|------|------|------|------|
| Public 버킷 | [사용중인 이름] | `public-bucket` | [✅/❌] |
| Private 버킷 | [사용중인 이름] | `private-bucket` | [✅/❌] |
| 경로 패턴 | [현재 패턴] | `{type}/{ownerId}/{filename}` | [✅/❌] |

### RPC Functions

| 항목 | 현재 | 규격 | 상태 |
|------|------|------|------|
| 파라미터 prefix | [현재] | `p_` | [✅/❌] |
| 타입 assertion | [현재] | `as unknown as Type` | [✅/❌] |
| 에러 처리 | [현재] | 표준 패턴 | [✅/❌] |

---

## 📋 Migration Tasks

### Phase 1: Foundation (기반 작업)

- [ ] `templates/` 폴더 복사 (cm-template에서)
- [ ] 기존 문서 백업 (`.migration-backup/`)
- [ ] `CLAUDE.md` 융합
- [ ] `README.md` 융합
- [ ] `.claude/` 디렉토리 복사 및 설정
- [ ] `.specify/memory/constitution.md` 설정
- [ ] 환경변수 정리 (`.env.example`)

### Phase 2: Structure (구조 변경)

- [ ] DDD 4-Layer 디렉토리 생성
- [ ] Repository 마이그레이션
- [ ] API Client 마이그레이션
- [ ] Hooks 도메인별 분리
- [ ] Components 도메인별 분리

### Phase 3: Atomic Design

- [ ] `components/atoms/` 구조화
- [ ] `components/molecules/` 구조화
- [ ] `components/organisms/` 구조화
- [ ] `components/templates/` 구조화

### Phase 4: Supabase Alignment

- [ ] Storage 버킷명 변경
- [ ] RPC 파라미터 prefix 통일 (`p_`)
- [ ] 타입 assertion 패턴 적용

### Phase 5: Quality & Cleanup

- [ ] `types/` → `models/` 마이그레이션
- [ ] ESLint 에러 수정
- [ ] TypeScript 에러 수정
- [ ] `any` 타입 제거
- [ ] console.log 제거

### Phase 6: Documentation

- [ ] README.md 업데이트
- [ ] CLAUDE.md 커스터마이징
- [ ] 도메인별 spec.md 생성 (선택)

---

## 📈 Estimated Effort

| Phase | 예상 시간 | 복잡도 |
|-------|----------|--------|
| Foundation | [X]시간 | [Low/Medium/High] |
| Structure | [X]시간 | [Low/Medium/High] |
| Atomic Design | [X]시간 | [Low/Medium/High] |
| Supabase | [X]시간 | [Low/Medium/High] |
| Quality | [X]시간 | [Low/Medium/High] |
| Documentation | [X]시간 | [Low/Medium/High] |
| **Total** | **[X]시간** | - |

---

## 🎯 Recommended Priority

1. **즉시**: [가장 critical한 항목]
2. **단기**: [1주 내 완료 항목]
3. **중기**: [2-4주 내 완료 항목]
4. **장기**: [선택적 개선 항목]

---

## 🔗 References

- [cm-template](https://github.com/semicolon-devteam/cm-template)
- [Team Codex](https://github.com/semicolon-devteam/docs/wiki/Team-Codex)
- [Development Philosophy](https://github.com/semicolon-devteam/docs/wiki/Development-Philosophy)
- [DDD Architecture Guide](https://github.com/semicolon-devteam/docs/blob/main/guides-architecture-template-ddd.md)
```

## Return Values

```typescript
{
  projectName: string,
  analysisDate: string,
  complianceScore: number,        // 0-100%
  estimatedEffort: "Small" | "Medium" | "Large",
  gaps: {
    structure: GapItem[],
    documentation: GapItem[],
    architecture: ViolationItem[],
    supabase: GapItem[],
    quality: QualityIssue[]
  },
  tasks: MigrationTask[],
  priority: PriorityItem[],
  report: string                  // Markdown formatted
}
```

## Critical Rules

1. **분석만 수행**: 이 스킬은 분석만 수행, 자동 수정 금지
2. **cm-template 기준**: 모든 비교는 cm-template 기준
3. **docs 위키 참조**: Team Codex, Development Philosophy 참조
4. **우선순위 제시**: Critical → Warning → Suggestion 순서
5. **실행 가능한 태스크**: 구체적인 마이그레이션 태스크 제공
6. **문서 유효성 검증**: docs 레포지토리 문서 참조 시 404 응답이면 반드시 사용자에게 알림
   - `gh api repos/semicolon-devteam/docs/contents/{path}` 로 검증
   - 실패 시: "⚠️ 문서 참조 실패: {document_name} - 경로 변경 또는 삭제됨" 출력
