# SAX → SEMO Deprecation Notice

> 기존 SAX 패키지 및 접두사 Deprecation 안내

**적용일**: 2025-12-11
**제거 예정**: 6개월 후 (2026-06-11)

---

## 1. Deprecated 패키지

### 역할 기반 패키지 (모두 Deprecated)

| 기존 패키지 | 상태 | 새 위치 |
|-------------|------|---------|
| `sax-po` | ⚠️ Deprecated | `semo-skills/planner/` |
| `sax-pm` | ⚠️ Deprecated | `semo-skills/planner/` |
| `sax-next` | ⚠️ Deprecated | `semo-skills/coder/` (platform: nextjs) |
| `sax-backend` | ⚠️ Deprecated | `semo-skills/coder/` (platform: spring) |
| `sax-qa` | ⚠️ Deprecated | `semo-skills/tester/` |
| `sax-design` | ⚠️ Deprecated | `semo-skills/writer/` |
| `sax-infra` | ⚠️ Deprecated | `semo-skills/deployer/` |
| `sax-ms` | ⚠️ Deprecated | `semo-skills/coder/` (platform: microservice) |
| `sax-mvp` | ⚠️ Deprecated | `semo-skills/coder/` (platform: mvp) |

### 유지되는 패키지

| 패키지 | 상태 | 비고 |
|--------|------|------|
| `sax-core` | 🔄 마이그레이션 | `semo-core/`로 이관 |
| `sax-meta` | 🔄 마이그레이션 | `semo-core/`로 통합 |

---

## 2. Deprecated 접두사

### 경고 메시지

레거시 접두사 사용 시 다음 경고가 출력됩니다:

```markdown
[SEMO] Warning: [{prefix}] 접두사는 2026-06-11 이후 제거 예정입니다.
[SEMO] 권장: "{자연어 요청}" (Orchestrator가 플랫폼 자동 감지)
```

### 접두사 매핑

| Deprecated 접두사 | 새 라우팅 | 자동 감지 |
|-------------------|----------|----------|
| `[next]` | semo-skills/coder (nextjs) | ✅ |
| `[backend]` | semo-skills/coder (spring) | ✅ |
| `[mvp]` | semo-skills/coder (mvp) | ✅ |
| `[ms]` | semo-skills/coder (microservice) | ✅ |
| `[po]` | semo-skills/planner | ❌ |
| `[pm]` | semo-skills/planner | ❌ |
| `[qa]` | semo-skills/tester | ❌ |
| `[infra]` | semo-skills/deployer | ❌ |
| `[design]` | semo-skills/writer | ❌ |

---

## 3. Deprecated 커맨드

| Deprecated | 새 커맨드 | 비고 |
|------------|----------|------|
| `/SAX:help` | `/SEMO:help` | 병행 지원 |
| `/SAX:slack` | `/SEMO:notify` | 병행 지원 |
| `/SAX:feedback` | `/SEMO:feedback` | 병행 지원 |
| `/SAX:health` | `/SEMO:health` | 병행 지원 |
| `/SAX:audit` | `/SEMO:audit` | 병행 지원 |

---

## 4. 마이그레이션 타임라인

| 단계 | 기간 | 상태 |
|------|------|------|
| **Phase 1-3** | 2025-12-11 | ✅ 새 구조 구축 완료 |
| **Phase 4** | 현재 | 🔄 Deprecation 경고 추가 |
| **병행 운영** | 6개월 | 새 구조 + 레거시 병행 |
| **제거** | 2026-06-11 | 레거시 완전 제거 |

---

## 5. 권장 사항

### DO (권장)

```markdown
✅ "댓글 기능 구현해줘" (Orchestrator가 플랫폼 자동 감지)
✅ /SEMO:help
✅ semo-skills/coder/implement 직접 참조
```

### DON'T (지양)

```markdown
❌ "[next] 댓글 기능 구현해줘" (Deprecated 접두사)
❌ /SAX:help (Deprecated 커맨드)
❌ sax-next/skills/implement 참조
```

---

## 6. 문의

마이그레이션 관련 문의:
- `/SEMO:feedback` 커맨드 사용
- GitHub Issues: [semicolon-devteam/sax](https://github.com/semicolon-devteam/sax/issues)

---

*이 문서는 SEMO 리팩토링 Phase 4의 일부로 작성되었습니다.*
