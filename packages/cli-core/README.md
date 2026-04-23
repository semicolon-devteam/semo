# @team-semicolon/semo-core

SEMO L0 메타프레임워크 entry. profile 판별 후 적절한 하위 CLI 에 dispatch.

> **상태**: WIP. 아직 npm publish 안 함 (`"private": true`). 실제 배포는 3-Layer 메타프레임워크 로드맵 P5 에서.

## 역할

| Profile         | 하위 CLI 패키지             | 기본 bin    |
| --------------- | --------------------------- | ----------- |
| `team` (기본값) | `@team-semicolon/semo-cli`  | `semo`      |
| `personal`      | `@team-semicolon/semo-solo` | `semo-solo` |

## Profile 판별 순서

1. `SEMO_PROFILE` 환경변수 (`team` or `personal`)
2. `$SEMO_HOME/config.toml` 의 `profile` 키
3. `~/.semo/config.toml`
4. `$PWD/semo.config.toml` 또는 `$PWD/.semo/config.toml`
5. 기본값: `team`

## 사용 예

```bash
# Profile 확인
semo-core --print-profile

# 아래 둘은 모두 profile 에 따라 dispatch
semo-core kb get semo process service-metadata-sot
semo-core onboarding
```

## 설계 메모

- 이 entry 는 **얇은 래퍼** — 기존 CLI 코드를 `child_process.spawnSync` 로 실행하고 exit code 를 전파한다.
- dispatch 받은 CLI 는 `SEMO_DISPATCHED_PROFILE` 환경변수로 자신이 cli-core 경유임을 알 수 있다.
- 기존 `semo`, `semo-cli`, `semo-solo` bin 은 **유지**. 운영 스크립트 호환성 유지 목적.
