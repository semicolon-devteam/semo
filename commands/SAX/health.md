---
description: SAX 환경 및 구조 통합 검증 - 개발 환경 + .claude 디렉토리 검증
---

# /SAX:health

SAX 환경 및 구조 통합 검증

## 사용법

```
/SAX:health
```

## 동작

### Phase 1: 개발 환경 검증

설치된 SAX 패키지에 따라 해당 패키지의 `skill:health-check` 호출:

| 패키지 | 검증 항목 |
|--------|----------|
| sax-po | gh, git, node, pnpm, supabase, GitHub 인증 |
| sax-next | gh, git, node, pnpm, supabase, GitHub 인증, API 접근 |
| sax-qa | gh, git, node, pnpm, GitHub 인증, 테스트 도구 |
| sax-design | gh, git, node, Chrome, Figma, MCP 서버 |
| sax-backend | gh, git, node, pnpm, supabase, 백엔드 도구 |
| (기타) | gh, git, node, pnpm, GitHub 인증 |

> 패키지에 `skill:health-check`가 없으면 Phase 1 건너뜀

### Phase 2: SAX 구조 검증

`skill:sax-architecture-checker` 호출:

1. 설치된 SAX 패키지 감지 (po, next, qa, meta, pm, backend, infra, design)
2. 심링크 무결성 검증 (CLAUDE.md, agents/, skills/, commands/SAX/)
3. 문제 발견 시 자동 수정 (install-sax.sh 동일 로직)
4. 결과 보고

## 출력 예시

```markdown
[SAX] Skill: health 실행

=== Phase 1: 개발 환경 검증 ===

✅ GitHub CLI: v2.40.0
✅ Git: v2.43.0
✅ Node.js: v20.10.0
✅ pnpm: v8.14.0
⚠️ PostgreSQL: 미설치 (선택)

✅ GitHub 인증: 완료
✅ semicolon-devteam 멤버십: 확인

=== Phase 2: SAX 구조 검증 ===

| 항목 | 상태 | 비고 |
|------|------|------|
| sax-core | ✅ | 존재 |
| sax-next | ✅ | 설치됨 |
| CLAUDE.md | ✅ | 심링크 유효 |
| agents/ | ✅ | 12 symlinks |
| skills/ | ✅ | 8 symlinks |
| commands/SAX | ✅ | 6 symlinks |

=== 결과 ===
✅ 모든 항목 정상
```

## Trigger Keywords

- `/SAX:health`
- `/SAX:health-check` (하위호환)
- "환경 확인", "도구 확인", "설치 확인"
- "SAX 상태", "심링크 확인", ".claude 확인"

## 관련 문서

- `sax-core/skills/sax-architecture-checker/SKILL.md`
- `{패키지}/skills/health-check/SKILL.md`
