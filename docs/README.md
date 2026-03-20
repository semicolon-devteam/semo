# SEMO (Semicolon Orchestrate)

> AI 에이전트 오케스트레이션 프레임워크 for Claude Code

---

## 한 줄 요약

Claude Code에 **역할별 AI 에이전트**를 설치하여 팀 전체의 개발 생산성을 높입니다.

---

## 왜 SEMO인가?

| 문제 | SEMO 해결책 |
|------|------------|
| Claude Code가 매번 새로 시작 | **Context Mesh**로 세션 간 장기 기억 유지 |
| 역할별 가이드라인 부재 | **패키지별 전문화된 에이전트** 제공 |
| 팀 간 일관성 부족 | **공통 원칙 + Skill 표준화** |
| 반복 작업에 시간 낭비 | **자동화된 Skill**로 작업 효율화 |
| AI 작업 투명성 부족 | **SEMO 메시지**로 모든 동작 명시 |

---

## 30초 설치

```bash
# SEMO CLI로 설치
npx @team-semicolon/semo-cli init

# 또는 수동 설치
bash <(curl -fsSL https://raw.githubusercontent.com/semicolon-devteam/semo-meta/main/scripts/install-semo.sh)
```

설치 후 프로젝트 디렉토리에 `.claude/` 폴더가 생성됩니다.

---

## 핵심 개념

### 구조

```
SEMO Framework
├── semo-core           # 원칙, 오케스트레이터
├── 공유 스킬 (DB)       # skill_definitions 테이블 (중앙 DB SoT)
├── 커맨드 (DB)          # command_definitions 테이블
└── 에이전트 (DB)        # agent_definitions 테이블
```

SessionStart 시 `semo context sync`가 DB → `~/.claude/{skills,commands,agents}/`로 자동 동기화합니다.

### 동작 원리

```
사용자 요청
    ↓
[SEMO] Orchestrator: 의도 분석
    ↓
[SEMO] Skill: {적절한 스킬} 호출
    ↓
[SEMO] Reference: {필요한 문서} 참조
    ↓
결과 출력
```

모든 AI 동작은 `[SEMO]` 접두사와 함께 **투명하게 노출**됩니다.

---

---

## 주요 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/SEMO:help` | SEMO 도움말 |
| `/SEMO:health` | 환경 및 구조 검증 |
| `/SEMO:update` | SEMO 최신 버전으로 업데이트 |
| `/SEMO:slack` | Slack 채널에 메시지 전송 |
| `/SEMO:feedback` | 피드백/버그 리포트 제출 |

---

## 빠른 시작

```bash
# 1. 설치
npx @team-semicolon/semo-cli init

# 2. 사용 시작 — Claude Code에서 자연어로 요청
"로그인 페이지 만들어줘"
```

---

## 문서 목록

| 문서 | 설명 | 대상 |
|------|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 아키텍처 개요 | 팀 리더, 아키텍트 |
| [SKILL_ARCHITECTURE.md](./SKILL_ARCHITECTURE.md) | 스킬/커맨드/에이전트 구조 | 개발자 |
| [FAQ.md](./FAQ.md) | 자주 묻는 질문 | 문제 해결 시 |
| [TESTING.md](./TESTING.md) | E2E 테스트 케이스 | QA/검증 |

---

## 기여하기

SEMO에 기여하고 싶으시다면:

1. [GitHub Issues](https://github.com/semicolon-devteam/semo/issues)에서 이슈 확인
2. `/SEMO:feedback` 커맨드로 피드백 제출
3. PR은 `semo` 레포지토리로 제출

---

## 라이선스

MIT License - Semicolon DevTeam

---

## 링크

- **GitHub**: [semicolon-devteam](https://github.com/semicolon-devteam)
- **Slack**: `#_협업` 채널
- **문의**: `/SEMO:feedback` 사용
