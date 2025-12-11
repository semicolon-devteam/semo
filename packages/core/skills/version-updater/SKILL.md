---
name: version-updater
description: |
  SEMO 패키지 버전 체크 및 업데이트 알림. Use when:
  (1) 새 세션 시작 시 자동 체크, (2) 수동 버전 확인 요청,
  (3) SEMO 업데이트 실행.
tools: [Bash, Read]
---

> **🔔 시스템 메시지**: 이 Skill이 호출되면 `[SEMO] Skill: version-updater 호출` 시스템 메시지를 첫 줄에 출력하세요.

# Version Updater Skill

> SEMO 패키지 버전 체크 및 업데이트 지원

## Purpose

모든 SEMO 패키지에서 공통으로 사용되는 버전 관리 및 무결성 검증:

1. **새 세션 시작 시** 자동 버전 체크 + 무결성 검증
2. **업데이트 가능 시** 사용자에게 알림
3. **업데이트 실행** 지원
4. **무결성 검증** 구조 및 동기화 상태 확인

## 무결성 검증 흐름 (4-Phase)

```text
[세션 시작] → version-updater 호출
                    ↓
              ┌─────┴─────┐
              │ Phase 1   │ 버전 체크
              └─────┬─────┘
                    ↓
              ┌─────┴─────┐
              │ Phase 2   │ 구조 검증 (semo-architecture-checker --check-only)
              └─────┬─────┘
                    ↓
              ┌─────┴─────┐
              │ Phase 3   │ 동기화 검증 (package-sync --check-only)
              └─────┬─────┘      ※ semo-core 존재 시에만
                    ↓
              ┌─────┴─────┐
              │ Phase 4   │ 메모리 복원 (skill:memory sync)
              └─────┬─────┘      ※ .claude/memory/ 존재 시에만
                    ↓
              [무결성 리포트 출력]
```

### 환경 감지

```bash
# semo-core 추출 환경 여부 확인
if [ -d ".claude/semo-core" ]; then
  ENV_TYPE="full"      # Phase 1-2-3 모두 수행
else
  ENV_TYPE="legacy"    # Phase 1-2만 수행 (package-sync 스킵)
fi
```

### Phase별 동작

| Phase | 스킬 | 모드 | 문제 시 동작 |
|-------|------|------|-------------|
| 1 | (내장) | - | 업데이트 안내 |
| 2 | semo-architecture-checker | --check-only | 기본 모드로 재호출 (자동 수정) |
| 3 | package-sync | --check-only | 기본 모드로 재호출 (동기화 실행) |
| 4 | skill:memory | sync | 저장된 결정/선호도 복원 |

## Trigger

### 자동 트리거

- 새 Claude Code 세션 시작 (대화 기록 없음)
- SEMO가 설치된 프로젝트 (`.claude/semo-*` 존재)

### 수동 트리거

- "SEMO 버전 확인", "버전 체크" 키워드
- "SEMO 업데이트해줘" 요청
- "최신 버전이야?", "최신 버전인지 확인" 질문
- "SEMO 버전", "현재 버전" 질문

> **🔴 중요**: 버전 관련 질문 시 **반드시 원격 저장소와 비교**해야 합니다. 로컬 VERSION 파일만 읽고 "최신입니다"라고 응답하면 안 됩니다.

## Workflow

### 1. 버전 체크

```bash
# 설치된 패키지 동적 확인 (semo-* 패턴)
for pkg_dir in .claude/semo-*/; do
  if [ -d "$pkg_dir" ]; then
    pkg=$(basename "$pkg_dir")
    LOCAL=$(cat "$pkg_dir/VERSION" 2>/dev/null || echo "unknown")
    REMOTE=$(gh api "repos/semicolon-devteam/$pkg/contents/VERSION" --jq '.content' 2>/dev/null | base64 -d | tr -d '\n' || echo "unknown")
    echo "$pkg: local=$LOCAL remote=$REMOTE"
  fi
done
```

> **참고**: `semo-*` 패턴을 사용하여 새로운 패키지 추가 시 자동 인식됩니다.

### 🔴 버전 비교 필수 규칙

**"최신 버전이야?" 질문에 대한 응답 프로세스**:

```text
1. 로컬 VERSION 파일 읽기
2. 원격 저장소 VERSION 조회 (gh api)
3. 두 버전 비교
4. 결과에 따른 응답:
   - 동일 → "✅ 최신 버전입니다"
   - 다름 → "⬆️ 업데이트 가능: {local} → {remote}"
```

**❌ 잘못된 응답 (절대 금지)**:

- 로컬 버전만 읽고 "최신입니다" 응답
- 원격 버전 확인 없이 버전 상태 판단

**✅ 올바른 응답**:

- 반드시 로컬과 원격 버전을 비교한 후 결과 출력

### 2. 업데이트 실행

```bash
# 서브모듈 업데이트
cd .claude/{package}
git fetch origin main
git reset --hard origin/main
cd -
```

### 3. 무결성 검증 (Phase 2-3)

업데이트 완료 후 또는 세션 시작 시 무결성 검증:

```text
Phase 2: semo-architecture-checker --check-only
  ↓ 문제 발견 시 → semo-architecture-checker (기본 모드, 자동 수정)

Phase 3: package-sync --check-only (semo-core 환경만)
  ↓ 문제 발견 시 → package-sync (기본 모드, 동기화 실행)
```

> **중요**: 업데이트 후 및 세션 시작 시 반드시 Phase 2-3을 수행해야 합니다.

### 🔴 업데이트 후 심링크 동기화 (Issue #7 대응)

> **문제**: 패키지 업데이트 후 새로 추가된 스킬/에이전트의 심링크가 생성되지 않음
>
> **해결**: 업데이트 후 semo-architecture-checker를 **기본 모드**로 호출하여 누락 심링크 자동 생성

**업데이트 완료 후 필수 동작**:

```text
1. 서브모듈 업데이트 (git fetch + reset)
   ↓
2. semo-architecture-checker 기본 모드 호출 (--check-only 아님!)
   - 깨진 심링크 수정
   - 🔴 누락된 심링크 자동 생성 (NEW)
   ↓
3. 심링크 변경 시 세션 재시작 권장 메시지 출력
```

**semo-architecture-checker 기본 모드가 수행하는 작업**:

| 검사 항목 | 수정 동작 |
|-----------|----------|
| 깨진 심링크 | 재생성 |
| 누락된 심링크 | **신규 생성** (semo-core/semo-pkg 비교) |
| .merged 마커 누락 | 생성 |
| 심링크 디렉토리 | 실제 디렉토리로 변환 |

## Output Format

### 업데이트 가능 시

```markdown
[SEMO] Skill: version-updater 호출

## 📦 SEMO 업데이트 알림

| 패키지 | 현재 버전 | 최신 버전 | 상태 |
|--------|----------|----------|------|
| semo-core | 1.2.0 | 1.3.0 | ⬆️ 업데이트 가능 |
| semo-meta | 0.22.2 | 0.22.2 | ✅ 최신 |
| semo-next | 0.25.0 | 0.26.0 | ⬆️ 업데이트 가능 |

**업데이트하려면**: "SEMO 업데이트해줘"
```

### 최신 상태 시

```markdown
[SEMO] Skill: version-updater 호출

## ✅ SEMO 최신 버전 확인

| 패키지 | 버전 | 상태 |
|--------|------|------|
| semo-core | 1.3.0 | ✅ 최신 |
| semo-next | 0.26.0 | ✅ 최신 |

모든 SEMO 패키지가 최신 상태입니다.

---

## 🔍 무결성 검증

### Phase 2: 구조 검증
| 항목 | 상태 |
|------|------|
| semo-core | ✅ |
| CLAUDE.md | ✅ |
| agents/ | ✅ |
| skills/ | ✅ |
| commands/SEMO | ✅ |

### Phase 3: 동기화 검증
| 유형 | 상태 |
|------|------|
| Skills | ✅ 8/8 |
| Agents | ✅ 5/5 |
| Commands | ✅ 4/4 |

### Phase 4: 메모리 복원
| 항목 | 상태 |
|------|------|
| 결정 사항 | ✅ 3건 로드 |
| 선호도 | ✅ 2건 로드 |
| 프로젝트 맥락 | ✅ 로드 |

**무결성**: ✅ 정상
```

### 무결성 문제 발견 시

```markdown
[SEMO] Skill: version-updater 호출

## ✅ SEMO 최신 버전 확인
(버전 테이블)

---

## 🔍 무결성 검증

### Phase 2: 구조 검증
| 항목 | 상태 | 비고 |
|------|------|------|
| agents/ | ⚠️ | 깨진 심링크 2개 |

→ semo-architecture-checker 자동 수정 실행...
→ ✅ 수정 완료

### Phase 3: 동기화 검증
| 유형 | 상태 |
|------|------|
| Skills | ✅ 8/8 |

**무결성**: ✅ 정상 (1개 항목 자동 수정됨)
```

### 업데이트 완료 시

```markdown
[SEMO] Skill: version-updater 호출

## 🔄 SEMO 업데이트 완료

| 패키지 | 이전 버전 | 현재 버전 |
|--------|----------|----------|
| semo-core | 1.2.0 | 1.3.0 |
| semo-next | 0.25.0 | 0.26.0 |

업데이트가 완료되었습니다.

---

[SEMO] version-updater: 업데이트 완료 → semo-architecture-checker 호출

## .claude 디렉토리 검증 결과

| 항목 | 상태 | 비고 |
|------|------|------|
| 패키지 | ✅ | semo-next |
| agents/ | ✅ | 6 symlinks |
| skills/ | ⚠️ → ✅ | 2개 심링크 추가 |
| commands/SEMO | ✅ | 5 symlinks |

**결과**: 1개 항목 자동 수정됨

---

⚠️ **세션 재시작 권장**

심링크 구조가 변경되었습니다. Claude Code가 변경된 경로를 인식하도록
**새 세션을 시작**하는 것을 권장합니다.
```

## 🔴 세션 재시작 권장

> **업데이트 또는 심링크 재설정 후에는 세션 재시작을 권장합니다.**

### 재시작 안내 출력 조건

| 조건 | 안내 출력 |
|------|----------|
| SEMO 업데이트 실행됨 | ✅ 항상 |
| semo-architecture-checker가 심링크 수정함 | ✅ 항상 |
| 버전 체크만 (최신 상태) | ❌ 불필요 |

### 안내 메시지

```markdown
⚠️ **세션 재시작 권장**

심링크 구조가 변경되었습니다. Claude Code가 변경된 경로를 인식하도록
**새 세션을 시작**하는 것을 권장합니다.

재시작 방법: Claude Code 창을 닫고 다시 열기
```

## SEMO Message

```markdown
[SEMO] Skill: version-updater 호출

{output}
```

## References

- [Update Process](references/update-process.md) - 상세 업데이트 절차

## Related

- [semo-core/PRINCIPLES.md](../../PRINCIPLES.md) - SEMO 핵심 원칙
