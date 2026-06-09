# 손-안전베팅 "시장가 조사" Playwright PoC — 실행 결과

- **일시**: 2026-06-09 (KST)
- **머신**: 네트워크 가능 (실제 외부 HTTP 도달 확인됨)
- **위치**: `/Users/reus/semo-repo/docs/reports/poc/`
- **결론 한 줄**: 퍼시스턴트 세션 + 스크랩 + 집계 메커니즘은 **실제로 동작 입증됨**. 단, **목표였던 네이버쇼핑은 봇/headless·headed 모두 차단**(하드블록 + CAPTCHA)되어, 동일 메커니즘을 **라이브 공개 쇼핑 페이지 2곳 + 정적 fixture**로 실증했다.

---

## 1. 정직한 요약 (무엇이 됐고 무엇이 막혔나)

| 항목                                            | 상태        | 증거                                                                                                                                         |
| ----------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Playwright(chromium) 빌드/설치                  | ✅ 됨       | poc-local `npm i playwright` + `playwright install chromium`(브라우저는 sandbox 권한 문제로 `PLAYWRIGHT_BROWSERS_PATH=./pw-browsers`에 설치) |
| 퍼시스턴트 컨텍스트(`userDataDir=./pw-profile`) | ✅ 됨       | 별도 프로세스 3회 실행에서 `localStorage` 카운터 0→1→2→3 누적. 프로필 디스크 261개 파일, leveldb에 키 물리 잔존                              |
| 스크랩 + 집계 메커니즘                          | ✅ 됨       | **라이브** 공개 쇼핑 페이지 2곳에서 제목·가격 추출 후 개수/평균/최저/최고 계산 성공                                                          |
| **네이버쇼핑 무인증 스크랩 (원 목표)**          | ❌ **막힘** | headless → "쇼핑 서비스 접속이 일시적으로 제한되었습니다" 하드블록 / headed → "보안 확인을 완료해 주세요"(영수증 위치 CAPTCHA)               |
| 차단 시 폴백 + 정직 보고                        | ✅ 됨       | 스크립트가 차단 감지 → fixture 폴백, `naverDiag`에 차단 원문 보존                                                                            |

**핵심**: 메커니즘 자체는 완전 동작. 막힌 것은 오직 네이버의 안티봇 월(WAF/CAPTCHA)이며, 이는 데이터센터/자동화 IP·환경에 대한 정책적 차단이다.

---

## 2. 실행 명령

```bash
# 0) 의존성 (poc 디렉토리 로컬 설치)
cd /Users/reus/semo-repo/docs/reports/poc
npm i playwright@latest
# sandbox가 ~/Library/Caches/ms-playwright 쓰기를 막아 로컬 경로로 브라우저 설치
PLAYWRIGHT_BROWSERS_PATH=./pw-browsers npx playwright install chromium

# 1) 본 PoC (네이버 시도 → 차단 시 fixture 폴백)
PLAYWRIGHT_BROWSERS_PATH=./pw-browsers node market-scan-poc.mjs

# 1b) headed + 실 UA 재시도 (요구사항 4-a)
HEADED=1 SOURCE=naver PLAYWRIGHT_BROWSERS_PATH=./pw-browsers node market-scan-poc.mjs

# 2) 세션 영속 명시 증명 (별도 프로세스 3회 반복 → 카운터 누적)
PLAYWRIGHT_BROWSERS_PATH=./pw-browsers node session-persistence-proof.mjs   # x3
```

---

## 3. 실제 샘플 출력

### 3-1. 본 PoC (`market-scan-poc.mjs`) — 네이버 차단 → fixture 폴백

```json
{
  "poc": "market-scan (손-안전베팅 시장가 조사)",
  "query": "실버 반지",
  "source": "fixture(fallback)",
  "fellBackToFixture": true,
  "sessionPersistence": {
    "profileFilesBefore": 0,
    "profileFilesAfter": 54,
    "note": "userDataDir 가 재실행 사이 디스크에 보존되고, poc_visit_count 쿠키가 누적되면 세션 영속 입증"
  },
  "pageMeta": { "title": "실버 반지 : 시장가 조사 fixture (정적)", "blocked": false },
  "naverDiag": {
    "title": "네이버쇼핑",
    "url": "https://search.shopping.naver.com/search/all?query=%EC%8B%A4%EB%B2%84%20%EB%B0%98%EC%A7%80",
    "blocked": true,
    "extracted": 0,
    "bodyTextPreview": "쇼핑 서비스 접속이 일시적으로 제한되었습니다. 네이버는 ... 비정상적인 접근이 감지될 경우 해당 네트워크의 접속을 일시적으로 제한 ... 짧은 시간 내에 너무 많은 요청 / VPN / 특정 확장 프로그램 ..."
  },
  "aggregate": {
    "count": 8,
    "priced": 8,
    "avg": 25600,
    "min": 7500,
    "max": 52000,
    "median": 21950,
    "currency": "KRW"
  },
  "totalExtracted": 8
}
```

### 3-2. headed + 실 UA 재시도 — 네이버가 **CAPTCHA** 로 응답 (하드블록 대신)

headless 와 다르게 headed 에서는 차단 문구가 바뀐다:

```
NAVER
보안 확인을 완료해 주세요.
이 절차는 귀하가 실제 사용자임을 확인하여 ...
영수증의 가게 위치는 고지길 [?] 입니다. (빈 칸을 채워주세요)
새로고침  확인
```

→ 즉, headed 로 가도 **사람 손 CAPTCHA**(영수증 위치 맞히기)를 요구. 무인증·무인 자동화로는 통과 불가.

### 3-3. 세션 영속 명시 증명 (`session-persistence-proof.mjs`, 별도 프로세스 3회)

```json
RUN 1 → { "previousCount": 0, "newCount": 1, "persisted": false }
RUN 2 → { "previousCount": 1, "newCount": 2, "persisted": true }   // 이전 프로세스 값 보존
RUN 3 → { "previousCount": 2, "newCount": 3, "persisted": true }
```

### 3-4. 스크랩+집계 메커니즘 — **라이브 공개 쇼핑 페이지** 2곳 (네이버 대체 실증)

동일 추출/집계 로직을 차단 없는 라이브 사이트에 적용:

```
[books.toscrape (demo store)] extracted=20 avg=32.79 min=10.69 max=59.48
  sample: [{"title":"Sharp Objects","priceText":"£47.82"}, ...]
[webscraper.io test-sites]    extracted=18 avg=400.66 min=24.99 max=899.99
  sample: [{"title":"Nokia 123","priceText":"$24.99"}, ...]
```

→ 라이브 HTML 에서 제목+가격 추출 → 개수/평균/최저/최고 집계가 **실제로** 동작함을 입증.

---

## 4. 세션 영속(퍼시스턴트) 증거

1. **프로세스 간 카운터 누적**: 3개의 독립 Node 프로세스가 같은 `./pw-profile` 를 열어 `localStorage.poc_persist_count` 가 0→1→2→3 으로 이어짐 (위 3-3). 메모리 공유가 아닌 디스크 보존이어야만 가능.
2. **디스크 프로필**: `./pw-profile` 에 **261개 파일** 생성 (`Default/`, `Local State`, `Cookies`, `Local Storage/leveldb/` 등 실제 Chromium 프로필 구조).
3. **leveldb 물리 잔존**: `pw-profile/Default/Local Storage/leveldb/000003.log` 에 `poc_persist_count`, `poc_last_visit`(`2026-06-09T13:48:...Z`), 그리고 `https://search.shopping.naver.com` origin 의 storage 엔트리가 strings 로 직접 확인됨.

> 의미: 로그인 쿠키/세션을 한 번 확보하면 그 인증 상태가 `userDataDir` 에 보존되어 다음 실행에 재사용된다 → **하이베팅(스마트스토어 인증) 시 로그인 1회 후 세션 영속**의 핵심 전제가 확보됨.

---

## 5. 차단/한계 (정직)

- **네이버쇼핑은 무인증·무인 자동화 스크랩을 정책적으로 차단**한다.
  - headless: 즉시 하드블록 페이지("접속이 일시적으로 제한").
  - headed + 실 UA + `--disable-blink-features=AutomationControlled` + ko-KR/Asia-Seoul: 하드블록은 피하나 **영수증 위치 CAPTCHA** 로 전환 → 여전히 통과 불가.
  - 데스크톱/모바일(`msearch`) 엔드포인트 모두 동일하게 차단.
- 차단 사유로 명시된 항목: 짧은 시간 다량 요청 IP, VPN/데이터센터 IP, 특정 확장, 구매·탐색과 무관한 외부 접근. 자동화 환경 자체가 이 트리거에 해당.
- 환경 이슈(부수적):
  - 레포 루트 `node_modules/playwright-core` 는 iCloud 동기화 충돌(" 3.js" 중복 파일)로 손상 → poc-local 설치로 우회.
  - sandbox 가 `~/Library/Caches/ms-playwright` 쓰기를 막음 → `PLAYWRIGHT_BROWSERS_PATH=./pw-browsers` 로 로컬 설치.
- 결과적으로 "실버 반지 실제 네이버 시장가" 수치는 **얻지 못함**. 3-1 의 8개·평균 25,600원은 **fixture(모사) 데이터**이며 실거래가가 아님(명시).

---

## 6. 하이베팅(스마트스토어 인증)으로의 다음 단계

손-안전베팅에서 입증된 자산(퍼시스턴트 세션 + 스크랩 + 집계)을 그대로 인증 경로로 승격:

1. **공식 API 우선** — 네이버 검색광고/커머스 API(스마트스토어 판매자 API). 안티봇 무관, 합법·안정. 스크랩 대비 우선 검토.
2. **세션 영속 로그인** — 본 PoC의 `userDataDir` 그대로 사용. headed 1회 수동 로그인(2FA 포함) → 쿠키/세션이 `./pw-profile` 에 보존 → 이후 무인 재사용. (3-3·4에서 보존 메커니즘 이미 입증.)
3. **CAPTCHA 대응** — 자동 우회 대신 (a) 판매자 본인 인증 세션 재사용으로 CAPTCHA 노출 빈도↓, (b) 불가피 시 휴먼-인-더-루프(headed 알림→사람이 1회 해결) 설계.
4. **차단 회피보다 정상 트래픽화** — 판매자 자신의 계정·정상 디바이스 핑거프린트·합리적 레이트리밋(요청 간 지연, 동시성 1)·실제 referer. "남의 데이터 대량 긁기"가 아니라 "내 스토어/내 권한 데이터 자동 조회"로 스코프 한정.
5. **집계 파이프라인 재사용** — 본 PoC의 `aggregate()`(개수/평균/최저/최고/중앙값)와 정규화(`won()`)를 인증 데이터에 그대로 연결. 메커니즘은 검증 완료.
6. **법무/약관 검토** — 스크랩 전 네이버 약관·robots·개인정보 범위 확인. API 경로가 약관상 안전.

---

## 7. 산출물 파일

- `market-scan-poc.mjs` — 메인 PoC (퍼시스턴트 컨텍스트 + 네이버 시도 + 차단감지 + fixture 폴백 + 집계 + JSON)
- `session-persistence-proof.mjs` — 세션 영속 명시 증명(별도 프로세스 카운터 누적)
- `fixtures/shopping-fixture.html` — 차단 폴백용 정적 fixture
- `market-scan-report.json` — 마지막 실행 리포트(자동 저장)
- `pw-profile/` — 퍼시스턴트 Chromium 프로필(261파일, 세션 영속 증거)
- `pw-browsers/` — poc-local chromium 바이너리(v1223)
