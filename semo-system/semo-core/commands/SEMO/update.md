# /SEMO:update

SEMO 업데이트를 확인하고 실행합니다.

## 사용법

```
/SEMO:update
```

## 동작

`version-updater` 스킬을 호출하여 SEMO 패키지 버전을 체크하고 업데이트를 안내합니다.

## 체크 항목

| 패키지 | 버전 파일 |
|--------|----------|
| semo-cli | `npm view @team-semicolon/semo-cli version` |
| semo-core | `semo-core/VERSION` |
| semo-skills | `semo-skills/VERSION` |
| Extension 패키지 | `packages/*/VERSION` |

## 출력 예시

### 업데이트 가능한 경우

```
[SEMO] 버전 체크 완료

📦 업데이트 가능:
  - semo-core: 1.0.0 → 1.0.1
  - semo-skills: 1.0.0 → 1.0.2

💡 업데이트 실행: `semo update`
```

### 최신 상태인 경우

```
[SEMO] 버전 체크 완료 ✅

모든 패키지가 최신 버전입니다.
  - semo-cli: 3.0.17
  - semo-core: 1.0.0
  - semo-skills: 1.2.0
```

## 업데이트 명령

```bash
# 전체 업데이트
semo update

# 특정 패키지만
semo update --only semo-core
semo update --only semo-skills

# CLI만 업데이트
semo update --self
```

## 참조 스킬

- `version-updater` - 버전 체크 및 업데이트 알림 스킬
