# Severity Levels Reference

## 🔴 CRITICAL (PR 차단)

절대 허용되지 않는 항목:

| Item | Description | Detection |
|------|-------------|-----------|
| `.block()` | Reactive 위반 | grep |
| 컴파일 에러 | 빌드 실패 | compileKotlin |
| 테스트 실패 | 기능 오류 | test |
| `--no-verify` | Hook 우회 | commit history |
| Security 취약점 | 보안 문제 | manual review |

### Action

- PR 생성 차단
- 즉시 수정 필요
- 머지 불가

## 🟡 WARNING (수정 권장)

권장하지 않지만 허용되는 항목:

| Item | Description | Detection |
|------|-------------|-----------|
| `println` | Debug 코드 | grep |
| `TODO` | 미완료 작업 | grep |
| `@Suppress` | 경고 무시 | grep |
| ktlint warnings | 스타일 경고 | ktlintCheck |
| 낮은 테스트 커버리지 | < 70% | jacoco |

### Action

- PR 생성 가능
- 리뷰어 주의 환기
- 가능하면 수정

## 🟢 INFO (선택적)

개선 제안:

| Item | Description |
|------|-------------|
| 성능 최적화 힌트 | 더 나은 방법 제안 |
| 코드 스타일 제안 | 가독성 개선 |
| 리팩토링 기회 | 구조 개선 |
| 문서화 제안 | KDoc 추가 |

### Action

- 참고 사항
- 선택적 적용
- 후속 작업으로 고려

## Threshold Values

| Metric | Threshold | Severity |
|--------|-----------|----------|
| Test Coverage | < 50% | 🔴 CRITICAL |
| Test Coverage | 50-70% | 🟡 WARNING |
| Test Coverage | > 70% | 🟢 OK |
| ktlint errors | > 0 | 🔴 CRITICAL |
| ktlint warnings | > 10 | 🟡 WARNING |
| Compile errors | > 0 | 🔴 CRITICAL |
| Test failures | > 0 | 🔴 CRITICAL |
| .block() calls | > 0 | 🔴 CRITICAL |
