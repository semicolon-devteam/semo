# Versioning

> SEMO 패키지 버저닝 규칙

## 분리 버전 정책

각 패키지별로 독립적인 버전을 관리합니다:

```
semo-cli (npm)           → package.json
semo-core/VERSION        → 독립 버전
semo-skills/VERSION      → 독립 버전
packages/*/VERSION       → 각 Extension 독립 버전
```

## 버전 타입

| 변경 유형 | 버전 타입 | 예시 |
|----------|----------|------|
| Agent/Skill/Command 추가 | MINOR | 1.0.0 → 1.1.0 |
| Agent/Skill/Command 수정 | MINOR | 1.1.0 → 1.2.0 |
| 버그/오타 수정 | PATCH | 1.2.0 → 1.2.1 |
| Breaking Change | MAJOR | 1.2.1 → 2.0.0 |

## 배포 대상 감지

| 변경 파일 | 배포 대상 | 버전 파일 |
|----------|----------|----------|
| `packages/cli/**` | npm publish | `packages/cli/package.json` |
| `semo-core/**` | GitHub | `semo-core/VERSION` |
| `semo-skills/**` | GitHub | `semo-skills/VERSION` |
| `packages/{ext}/**` | GitHub | `packages/{ext}/VERSION` |

## TodoWrite 연동

Agent/Skill/Command 파일 수정 감지 시:
- TodoWrite에 "버저닝 처리" 항목 자동 추가
- 해당 항목 완료 전까지 작업 미완료로 간주
