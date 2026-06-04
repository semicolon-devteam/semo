# SEMO → semicolony 마이그레이션 가이드 (구 환경용 deprecation guide)

> 이 파일은 **as-is(`semo`) 구조를 쓰던 환경/스크립트/봇이 변경된 구조(`semicolony`)로 찾아올 수 있도록** 남기는 안내입니다.
> 진행 현황·남은 작업: `docs/plans/2026-06-04-semicolony-rebrand-status-and-remaining.md`
> 결정: KB `semo/decision/rebrand-semo-to-semicolony-2026-06-04`

## TL;DR — 구 명령/경로는 계속 동작합니다 (backward-compat)
`semo` 브랜드는 `semicolony`로 리브랜딩 중이지만 **구 식별자는 무기한 alias로 유지**됩니다. 아무 것도 안 바꿔도 됩니다.

| as-is (구) | to-be (신) | 현재 상태 |
|---|---|---|
| `semo` / `semo-cli` 명령 | `semicolony` | **둘 다 동작** (구 bin 무기한 유지) |
| KB 도메인 `semo` (예: `semo kb get semo bot-ids`) | `semicolony` (`semo kb get semicolony …`) | **둘 다 동작** — 스토어가 legacy `semo`→`semicolony` 자동 정규화(alias). 데이터는 dual-domain |
| env `SEMO_*` | `SEMICOLONY_*` | **둘 다 동작** — `SEMICOLONY_*` 우선, `SEMO_*` fallback (dual-read) |
| dir `~/.semo` | `~/.semicolony` | `SEMICOLONY_HOME`/`~/.semicolony` 우선, 없으면 `~/.semo` (dual-read) |
| npm `@team-semicolon/semo-*` | `@team-semicolon/semicolony-*` | **아직 미변경**(게재명 그대로). Y1 전용 PR 예정 |
| DB 스키마 `semo.*` | (유지 권장) | **변경 안 함**(내부 비노출, 고위험). R1 결정 대기 |

## 트러블슈팅 — "`semo kb`/`semo action-items`가 빈 결과를 줍니다"
원인 후보(우선순위):
1. **마이그레이션 127 미적용 DB**: 이 환경이 붙은 DB에 `127_kb_domain_semicolony_dual.sql`이 안 돌았으면 `semicolony` 도메인이 없어, 정규화된 조회가 빈 결과. → `semo db migrate --status`로 127 확인, 없으면 `semo db migrate`.
2. **Phase 1 DB 스키마 move 진행 중**: 다른 세션이 `semo.*`→`semicolony.*` 스키마 이동을 라이브로 돌리는 중이면 테이블 락/이동으로 일시 빈 결과·실패. → 완료까지 대기.
3. **node_modules 손상**: 동시 npm 작업(패키지 rename 등)으로 워크스페이스 의존성이 깨지면 cli의 DB 레이어가 조용히 실패. → `npm install` 재설치.
4. **DB 터널 down**: `lsof -i :15432` 확인.

**데이터는 안전합니다** — 마이그레이션 127은 additive(구 `semo` 행 무손상). 빈 결과는 *접근 경로* 문제이지 데이터 소실이 아닙니다.

## 봇/스크립트 작성자에게
- `semo kb get semo …` 그대로 써도 됩니다(자동 alias). 점진적으로 `semicolony` 도메인으로 전환 권장.
- 정규화 동작/롤백: 코드 변경 없이 `SEMO_PLATFORM_KB_DOMAIN=semo` 로 정규화를 끌 수 있습니다(legacy 그대로 조회).
- 회사 자산은 변경 없음: npm scope `@team-semicolon`, org `semicolon-devteam`, 도메인 `semi-colon.space`, 봇 `Semi`/`Colony`, 봇 key `semobot`.

## 알려진 backward-compat 개선 예정 (action-item)
- **KB 도메인 정규화 fallback**: 현재 `semo`→`semicolony` 무조건 정규화라, **127 미적용 DB**에서 빈 결과. → "canonical이 비면 legacy로 fallback" + 1회 deprecation 경고를 추가 예정. (`semo action-items list` 의 리브랜딩 항목 참조)
