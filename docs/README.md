# SEMO (Semicolon Orchestrate)

> AI 에이전트 오케스트레이션 프레임워크 for Claude Code v2.0

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
├── Standard (필수)
│   ├── semo-core      # 원칙, 오케스트레이터
│   └── semo-skills    # 13개 통합 스킬
│
└── Extensions (선택)
    ├── semo-next      # 프론트엔드 개발자용
    ├── semo-backend   # 백엔드 개발자용
    ├── semo-po        # PO/기획자용
    └── ...            # 역할별 확장
```

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

## 역할별 패키지

| 패키지 | 대상 | 주요 기능 |
|--------|------|----------|
| **semo-next** | 프론트엔드 개발자 | DDD 아키텍처, API 연동, 컴포넌트 생성 |
| **semo-backend** | 백엔드 개발자 | Spring WebFlux, CQRS, Reactive 패턴 |
| **semo-po** | PO/기획자 | Epic 생성, Task 동기화, 중복 검사 |
| **semo-design** | 디자이너 | 목업 생성, 핸드오프 문서 |
| **semo-qa** | QA/테스터 | 테스트 케이스, 버그 리포트 |
| **semo-pm** | PM | Sprint 관리, 진행도 추적 |
| **semo-infra** | 인프라 엔지니어 | Docker Compose, Nginx, 배포 |
| **semo-ms** | MSA 개발자 | 마이크로서비스 설계, 이벤트 봉투 |
| **semo-mvp** | MVP 개발자 | 빠른 프로토타이핑, 메타데이터 확장 |

> 자세한 내용: [PACKAGES.md](./PACKAGES.md)

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

# 2. 역할 선택 (예: 프론트엔드 개발자)
# 설치 중 패키지 선택 프롬프트 표시

# 3. 사용 시작
# Claude Code에서 자연어로 요청
"로그인 페이지 만들어줘"
```

> 자세한 가이드: [QUICKSTART.md](./QUICKSTART.md)

---

## 문서 목록

| 문서 | 설명 | 대상 |
|------|------|------|
| [QUICKSTART.md](./QUICKSTART.md) | 5분 빠른 시작 가이드 | 신규 사용자 |
| [PACKAGES.md](./PACKAGES.md) | 패키지별 상세 설명 | 패키지 선택 시 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 아키텍처 개요 | 팀 리더, 아키텍트 |
| [USER_GUIDE.md](./USER_GUIDE.md) | 상세 사용자 가이드 | 모든 사용자 |
| [FAQ.md](./FAQ.md) | 자주 묻는 질문 | 문제 해결 시 |

---

## 기여하기

SEMO에 기여하고 싶으시다면:

1. [GitHub Issues](https://github.com/semicolon-devteam/semo/issues)에서 이슈 확인
2. `/SEMO:feedback` 커맨드로 피드백 제출
3. PR은 `semo-meta` 레포지토리로 제출

---

## 라이선스

MIT License - Semicolon DevTeam

---

## 링크

- **GitHub**: [semicolon-devteam](https://github.com/semicolon-devteam)
- **Slack**: `#_협업` 채널
- **문의**: `/SEMO:feedback` 사용
