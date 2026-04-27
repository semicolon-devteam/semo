# @team-semicolon/semo-cli

> SEMO — 자기 KB 위에 봇 하네스를 올리는 메타 프레임워크 (CLI).
> 개인은 노트북 한 대로, 팀은 PostgreSQL 위에서 동일 엔진을 공유한다.

[![npm](https://img.shields.io/npm/v/@team-semicolon/semo-cli.svg)](https://www.npmjs.com/package/@team-semicolon/semo-cli)
[![license](https://img.shields.io/npm/l/@team-semicolon/semo-cli.svg)](https://github.com/semicolon-devteam/semo/blob/main/LICENSE)

---

## 30초 설치

```bash
npm install -g @team-semicolon/semo-cli
semo init                  # 프로파일 선택 → ~/.semo 생성
semo migrate-sqlite        # KB/Ops 스키마 적용 (Personal 기본)
semo doctor                # 설치 헬스체크
```

또는 일회성 실행:

```bash
npx @team-semicolon/semo-cli init
```

---

## 프로파일 — 5분 안에 결정

`semo init` 첫 화면에서 선택한다. 운영 환경이 바뀌면 `~/.semo/config.toml` 만 교체하면 된다.

| 프로파일                  | KB          | 실행 타깃                | 메신저          | 용도                                                                 |
| ------------------------- | ----------- | ------------------------ | --------------- | -------------------------------------------------------------------- |
| `personal-discord` (기본) | SQLite      | Ollama (로컬 LLM)        | Discord 봇      | 노트북 1대, 자기만의 에이전트 — 데이터 로컬, 인터넷 다운돼도 KB 사용 |
| `personal-offline`        | SQLite      | Ollama                   | stdin (CLI)     | 메신저 없이 터미널만으로                                             |
| `solo-connected`          | SQLite      | Anthropic API            | HTTP/Obsidian   | 클라우드 LLM + Tailscale 외부 접근                                   |
| `team`                    | PostgreSQL  | Claude Code Orchestrator | Slack + Discord | 여러 명이 같은 KB 공유 (팀/스타트업)                                 |
| `custom`                  | 빈 스켈레톤 | —                        | —               | 직접 편집                                                            |

> **세미콜론 팀도 `team` 프로파일의 한 사용자**일 뿐. SEMO는 메타 프레임워크.

---

## 1분 만에 Personal Discord 봇 띄우기

```bash
# 1. Ollama 설치 + 모델
brew install ollama && ollama serve &
ollama pull qwen2.5-coder:14b
ollama pull nomic-embed-text

# 2. SEMO 초기화
semo init --profile personal-discord
semo migrate-sqlite

# 3. Discord 봇 등록 (https://discord.com/developers/applications 에서 생성 후)
export DISCORD_TOKEN='your-bot-token'   # ~/.zshrc 또는 direnv 에 영구 저장 권장
semo doctor                              # ✓ Discord 봇 토큰 확인

# 4. Router 데몬 기동 (포그라운드, Ctrl+C 종료)
semo router start --platform discord

# 5. 첫 KB 채우기 — 대화형 온보딩 (별 터미널)
semo onboard          # 닉네임/역할/관심사/목표 → me/* 자동 저장
# 또는 자연어 factory:
semo factory apply "오늘 회의에서 Notion 도입 결정됨" --yes
```

이제 Discord 채널에서 `@SemoBot 안녕`을 보내면 로컬 Ollama가 KB와 함께 응답한다.
자세한 단계별 절차는 [`packages/cli/PERSONAL_TESTING.md`](./PERSONAL_TESTING.md) 참고.

---

## 3-Layer 아키텍처 (요약)

| Layer            | 소유자      | 내용                                                                                   |
| ---------------- | ----------- | -------------------------------------------------------------------------------------- |
| **L0 SEMO Core** | npm 공개    | SemoBot 오케스트레이터, KB/Ops 인프라, 봇 템플릿 카탈로그 (`@team-semicolon/semo-cli`) |
| **L1 Profile**   | 사용자 선택 | `~/.semo/config.toml` — KB 드라이버 / 메신저 / LLM 타깃                                |
| **L2 Tenant**    | 사용자 소유 | 자기 도메인 KB 엔트리, 봇 인스턴스, 자유 CRUD                                          |

업그레이드 시 L0 만 `semo update` 로 갱신, L2 데이터는 그대로.

---

## 봇 카탈로그

`semo templates list` 로 사용 가능한 역할 템플릿 목록. SemoBot 외 모든 봇은 **템플릿 → 복사 → 사용자 정의** 흐름.

| ID                | 역할              | 강점                             |
| ----------------- | ----------------- | -------------------------------- |
| `semoclaw` (필수) | 오케스트레이터    | 사용자 의도 → 적절한 봇 dispatch |
| `planclaw`        | 기획/PRD          | 요구사항 정리, 스펙 작성         |
| `workclaw`        | 풀스택 구현       | 코드 작성, 마이그레이션          |
| `reviewclaw`      | 코드 리뷰/QA      | PR 리뷰, 테스트 설계             |
| `designclaw`      | 디자인/퍼블리싱   | UI 설계, Figma 핸드오프          |
| `growthclaw`      | SEO/마케팅/그로스 | KPI, 콘텐츠                      |
| `infraclaw`       | DevOps/배포       | 인프라, CI/CD                    |

내 도메인에 맞춰 템플릿을 복사하거나 SemoBot 과의 대화로 새 봇을 만들 수 있다 (`semo factory apply "..."`).

---

## 자주 쓰는 명령

| 작업           | 명령                                                       |
| -------------- | ---------------------------------------------------------- |
| 초기화         | `semo init [--profile <name>]`                             |
| KB 검색        | `semo kb search "키워드"`                                  |
| KB 조회        | `semo kb get <도메인> <키> [<sub_key>]`                    |
| KB 저장        | `semo kb upsert <도메인> <키> [<sub_key>] --content "..."` |
| Discord 라우터 | `semo router start --platform discord` (Slack 미지원)      |
| 봇 템플릿 목록 | `semo templates list`                                      |
| 봇 생성        | `semo factory apply "기획 봇 만들어줘"`                    |
| LLM 실행       | `semo exec "프롬프트"`                                     |
| 채팅 REPL      | `semo chat --target ollama --model qwen2.5-coder:14b`      |
| 첫 온보딩      | `semo onboard` (me/\* KB 자동 채움)                        |
| 헬스체크       | `semo doctor`                                              |
| 업그레이드     | `semo update`                                              |

---

## 환경변수

| 변수                | 용도                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `SEMO_HOME`         | 기본 `~/.semo` 변경. 한 머신에서 Team/Personal 프로파일 분리 시 유용 |
| `SEMO_CONFIG_PATH`  | config.toml 경로 직접 지정                                           |
| `ANTHROPIC_API_KEY` | `solo-connected` / `team` 프로파일                                   |
| `DISCORD_TOKEN`     | Discord 봇 토큰 (Personal Discord 프로파일 필수)                     |
| `SLACK_BOT_TOKEN`   | Slack 봇 토큰 (Team 프로파일)                                        |
| `OLLAMA_HOST`       | Ollama 호스트 변경 (기본 `http://127.0.0.1:11434`)                   |

---

## 설치/AX 컨설팅 문의

- 엔진어: 무료 (OSS, Apache-2.0)
- 설치/온톨로지 컨설팅: 세미콜론 팀에서 유상 제공 (Discord/Slack DM)
- 베타 사용자: GitHub Issues 또는 [Discord 커뮤니티](https://github.com/semicolon-devteam/semo/discussions)

---

## 참고

- 메인 레포: <https://github.com/semicolon-devteam/semo>
- 3-Layer 설계: `docs/ARCHITECTURE.md`
- 자주 묻는 질문: `docs/FAQ.md`

## 라이선스

Apache-2.0
