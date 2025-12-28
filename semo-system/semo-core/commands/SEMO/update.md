# /SEMO:update

SEMO 업데이트를 확인하고 실행합니다.

## 사용법

```
/SEMO:update
```

## 동작

`version-updater` 스킬을 호출하여 SEMO 패키지 버전을 체크하고 업데이트를 안내합니다.

## 체크 항목 (v4.0)

| 패키지 | 버전 파일 | 설명 |
|--------|----------|------|
| semo-cli | `npm view @team-semicolon/semo-cli version` | CLI 도구 |
| semo-core | `semo-core/VERSION` | 166개 스킬, 41개 에이전트 통합 |
| semo-remote | `semo-remote/VERSION` | 모바일 원격 제어 (선택) |
| semo-hooks | `semo-hooks/package.json` | 로깅/세션 훅 (선택) |
| meta | `meta/VERSION` | SEMO 자체 개발용 (선택) |

## 출력 예시

### 업데이트 가능한 경우

```
[SEMO] 버전 체크 완료

📦 업데이트 가능:
  - semo-core: 1.16.0 → 2.0.0 (BREAKING CHANGES)

💡 업데이트 실행: `semo update`

📋 변경 사항:
  - semo-core 단일 패키지 통합 (166개 스킬, 41개 에이전트)
  - Runtime 자동 감지 기능 추가
  - References 구조 도입 (runtimes/, domains/)
```

### 최신 상태인 경우

```
[SEMO] 버전 체크 완료 ✅

모든 패키지가 최신 버전입니다.
  - semo-cli: 3.0.28
  - semo-core: 2.0.0
```

## 업데이트 명령

```bash
# 전체 업데이트
semo update

# 특정 패키지만
semo update --only semo-core

# CLI만 업데이트
semo update --self
```

## v4.0 마이그레이션

기존 Extension 패키지 사용자는 마이그레이션이 필요합니다:

```bash
# 심볼릭 링크 업데이트
rm -f .claude/agents .claude/skills
ln -s ../semo-system/semo-core/agents .claude/agents
ln -s ../semo-system/semo-core/skills .claude/skills

# Runtime 설정 (선택)
echo "Primary: nextjs" > .claude/memory/runtime.md
```

## 참조 스킬

- `version-updater` - 버전 체크 및 업데이트 알림 스킬
