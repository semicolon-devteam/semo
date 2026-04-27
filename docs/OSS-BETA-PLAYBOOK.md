# OSS 베타 플레이북

> SEMO 메타 프레임워크 1차 OSS 공개 후 첫 5–10명의 베타 사용자를 모집/온보딩하기 위한 표준 절차.
> 작성: 2026-04-27

---

## 0. 사전 조건 (배포 전 체크)

| 항목                                                    | 상태 | 검증 방법                                                                        |
| ------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `npm run bundle` 산출물이 외부 환경에서 동작            | ☐    | `cd packages/cli && npm run bundle && node dist/bundle.js --version`             |
| `semo init --profile personal-discord` 빈 머신에서 통과 | ☐    | `SEMO_HOME=/tmp/test-$RANDOM npx ./packages/cli init --profile personal-discord` |
| `semo migrate-sqlite` 스키마 적용                       | ☐    | 위 환경에서 `migrate-sqlite` → `~/.semo/kb.db` 생성 확인                         |
| `semo doctor` green                                     | ☐    | 위 환경에서 doctor 출력에 ✗ 없음                                                 |
| README.md 최신 (이 문서 작성 시점 기준)                 | ✅   | `packages/cli/README.md` v4.18+ 형식                                             |
| 라이선스(Apache-2.0) 명시                               | ✅   | `packages/cli/package.json:license`                                              |

> 위 4개 ☐ 가 모두 통과되어야 npm `latest` 태그로 발행. 검증 전에는 `--tag beta` 로 발행.

---

## 1. 발행 절차 (v4.18.11 베타)

```bash
# 1) 버전 bump
cd packages/cli
npm version 4.18.11 --no-git-tag-version

# 2) 번들 빌드 (외부 머신 또는 CI 에서)
npm run bundle

# 3) 단일 파일 동작 확인
node dist/bundle.js --version
node dist/bundle.js init --profile personal-discord --dry-run

# 4) main/bin 을 dist/bundle.js 로 전환 (검증 후)
#    package.json "main"/"bin" 만 dist/bundle.js 로 수정 → commit

# 5) 베타 태그로 publish
git commit -am "chore(cli): bump to v4.18.11 + bundle 전환"
git tag cli-v4.18.11
git push origin dev --tags
# → publish-cli.yml 트리거
#    (또는 npm publish --tag beta 수동)
```

베타 검증 1주 후 문제 없으면 `npm dist-tag add @team-semicolon/semo-cli@4.18.11 latest`.

---

## 2. 첫 베타 사용자 5명 — 모집 채널

| 우선순위 | 채널                                                 | 메시지 톤                                              | 기대 인원    |
| -------- | ---------------------------------------------------- | ------------------------------------------------------ | ------------ |
| 1        | 세미콜론 사내 (reus 직접 안내)                       | "도와줄 사람 있음?" 캐주얼, 한 명씩 직접 DM            | 1–2명        |
| 2        | 친한 개발자 동료 (Discord/카톡)                      | "Personal AI 봇 띄우는 거 1분이면 됨, 피드백 주실 분?" | 2–3명        |
| 3        | GitHub README — `discussions` 탭 활성화 후 핀고정 글 | 절제된 톤, 베타 모집 / 가이드 / 이슈 링크              | 1–2명 (느림) |
| 4 (보류) | Reddit r/LocalLLaMA, Show HN                         | 번들 안정화 + 1차 피드백 후                            | 후속         |

**핵심**: 첫 5명은 reus가 **직접 옆에서 30분 페어 설치** 한다. 그게 가장 빠르게 막힘 포인트를 발견하는 길.

---

## 3. 사용자 1명 온보딩 30분 플레이북

### Phase A — 환경 점검 (5분)

```bash
node --version          # >= 18
npm --version
which ollama || brew install ollama
```

### Phase B — 설치 (10분)

```bash
ollama serve &
ollama pull qwen2.5-coder:14b
ollama pull nomic-embed-text

npm install -g @team-semicolon/semo-cli@beta
semo init --profile personal-discord
semo migrate-sqlite
semo doctor
```

`doctor` 출력 → 막히는 ✗ 가 있으면 그 자리에서 GitHub Issue 작성.

### Phase C — Discord 봇 (10분)

1. <https://discord.com/developers/applications> 에서 새 앱
2. Bot 탭 → Token 복사 + **MESSAGE CONTENT INTENT** on
3. OAuth2 URL Generator → `bot` scope + `Send Messages`/`Read Message History` permission → 사용자 본인 서버에 invite
4. 로컬 셸:
   ```bash
   export DISCORD_TOKEN='your-bot-token'   # ~/.zshrc 또는 direnv 에 영구 저장
   semo doctor                              # ✓ Discord 봇 토큰
   semo router start --platform discord     # 포그라운드, Ctrl+C 종료
   ```
5. 별 터미널에서 Discord 채널에 `@SemoBot 안녕` → Ollama 응답 확인

### Phase D — 첫 KB 엔트리 (5분)

```bash
semo chat "내 이름은 [이름]이고 [직무] 입니다. 주력 기술은 [스택]입니다."
semo kb search "내 직무"   # 자동 저장 확인
```

성공: `[me] profile` 또는 그 사용자 도메인 KB 가 잡힘.

---

## 4. 피드백 수집

| 트리거           | 채널                       | 양식                                                         |
| ---------------- | -------------------------- | ------------------------------------------------------------ |
| 설치 중 막힘     | GitHub Issues — `bug` 라벨 | 프로파일 / OS / 에러 메시지 / `semo doctor` 출력             |
| 사용 중 의문     | GitHub Discussions — `Q&A` | 자유                                                         |
| 베타 1주 후 회고 | reus 1:1 30분 영상 통화    | "가장 좋았던 점 1, 가장 짜증났던 점 1, 다음에 뭐 해줬으면 1" |

---

## 5. 베타 KPI (1차 OSS 공개 30일)

| 메트릭                     | 목표     | 측정                                                      |
| -------------------------- | -------- | --------------------------------------------------------- |
| `semo init` 완료 사용자 수 | 5명 이상 | 텔레메트리는 안 보냄. 자발적 보고 + reus 직접 페어 카운트 |
| 30일 후에도 봇 사용 중     | 3명 이상 | 영상 통화 회고 시 확인                                    |
| GitHub Issue 등록          | 5건 이상 | 막힘 패턴 데이터로 활용                                   |
| 첫 유상 AX 컨설팅 문의     | 1건      | 근본 KPI — 후속 개선 우선순위 결정                        |

---

## 6. 알려진 한계 — 베타 사용자에게 미리 공개

`README.md` 또는 `docs/FAQ.md` 에 "베타 한계" 섹션:

- 한국어 임베딩 품질: `nomic-embed-text` 기본값. BGE-m3 통합은 P2.3 이후
- Personal 대시보드 (P4) 미구현 — 현재 KB 열람은 CLI `semo kb get/search` 만
- `semo update` 의 3-way merge 는 단순 호환 모드 (P1.4 이후 본격 구현)
- Telegram 어댑터 없음 (P6.2 — 수요 발생 시)
- Apple Silicon 외 환경(Linux, Windows WSL) 은 reus가 직접 검증 안 함 — 베타 사용자 도움 필요

---

## 7. 베타 → GA 전환 기준

다음을 모두 만족하면 `latest` 태그로 승격:

1. 5명 이상이 30일 활성
2. P0 단계 critical 이슈 0건 (분류 기준: `semo init` / `semo doctor` / `semo chat` 차단)
3. README 가이드대로 따라 했을 때 한 시간 내 첫 KB 응답까지 도달
4. `semo update` 가 기존 `~/.semo/tenant/` 를 보존하며 kernel 만 교체

GA 후 본격 채널 (Reddit, Show HN) 발신.

---

## 부록 A — 직접 페어 설치 시 reus 체크리스트

- [ ] 한국어로 진행할지 영어인지 먼저 확인
- [ ] 본인 노트북 spec 메모 (CPU/RAM/OS) — 추후 호환성 데이터로
- [ ] Ollama 첫 응답까지 시간 기록 (모델 다운로드 시간 포함)
- [ ] 가장 헷갈렸던 단계 1줄 코멘트 받기
- [ ] 추후 어떤 도메인에 봇을 쓰고 싶은지 한 줄
- [ ] 설치 끝나고 `semo doctor` 출력 캡처 받기
