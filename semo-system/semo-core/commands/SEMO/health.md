# /SEMO:health

SEMO 환경 헬스체크. `.claude` 디렉토리 구조와 패키지 상태를 검증합니다.

## 사용법

```
/SEMO:health
```

## 동작

1. **구조 검증** - `.claude` 디렉토리 무결성 체크
2. **심링크 검증** - 깨진 심링크 탐지
3. **버전 체크** - 설치된 패키지 버전 확인
4. **자동 수정** - 문제 발견 시 자동 복구

## 라우팅

```
/SEMO:health → skill:semo-architecture-checker
```

## 검증 항목

| 항목 | 검증 내용 |
|------|----------|
| semo-core | 디렉토리 존재 여부 |
| semo-{pkg} | Extension 패키지 존재 여부 |
| CLAUDE.md | 심링크 유효성 |
| _shared | semo-core/_shared 참조 확인 |
| agents/ | .merged 마커 + 심링크 유효성 |
| skills/ | .merged 마커 + 심링크 유효성 |
| commands/SEMO | .merged 마커 + 심링크 유효성 |

## 출력 예시

### 정상 상태

```markdown
[SEMO] Skill: semo-architecture-checker 호출

## .claude 디렉토리 검증 결과

| 항목 | 상태 | 비고 |
|------|------|------|
| semo-core | ✅ | 존재 |
| semo-meta | ✅ | Extension |
| CLAUDE.md | ✅ | 심링크 유효 |
| _shared | ✅ | semo-core/_shared |
| agents/ | ✅ | 6 symlinks |
| skills/ | ✅ | 14 symlinks |
| commands/SEMO | ✅ | 6 symlinks |

**결과**: ✅ 구조 정상
```

### 문제 발견 시

```markdown
[SEMO] Skill: semo-architecture-checker 호출

## .claude 디렉토리 검증 결과

| 항목 | 상태 | 비고 |
|------|------|------|
| semo-core | ✅ | 존재 |
| agents/ | ⚠️ → ✅ | 심링크 2개 재생성 |
| skills/ | ❌ → ✅ | .merged 마커 추가 |

**결과**: 2개 항목 자동 수정됨

⚠️ **세션 재시작 권장**
심링크 구조가 변경되었습니다. 새 세션을 시작하세요.
```

## 관련 스킬

- `semo-architecture-checker` - 실제 검증 로직
- `version-updater` - 세션 시작 시 자동 호출 (Phase 2)

## 관련 커맨드

- `/SEMO:update` - 패키지 업데이트
- `/SEMO:dry-run` - 명령 시뮬레이션
