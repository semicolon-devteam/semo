# SAX Document Index

> docs 레포지토리 및 SAX 패키지 문서 인덱스

## sax-core 문서

| 파일 | 내용 | 중복 검토 범위 |
|------|------|---------------|
| `PRINCIPLES.md` | SAX 핵심 원칙 | 모든 원칙 정의 |
| `MESSAGE_RULES.md` | SAX 메시지 포맷 규칙 | 메시지 포맷, 출력 규칙 |
| `PACKAGING.md` | 패키지 구조 규칙 | 디렉토리 구조, 파일 명명 |
| `TEAM_RULES.md` | 팀 규칙 | 협업 규칙, 커밋 규칙 |

## sax-meta 문서

### Agents

| Agent | 내용 | 관련 키워드 |
|-------|------|------------|
| `orchestrator` | 요청 라우팅 | 라우팅, 의도 분석, 위임 |
| `agent-manager` | Agent CRUD | Agent 생성, 수정, 삭제, 검토 |
| `skill-manager` | Skill CRUD | Skill 생성, 수정, 삭제, 검토 |
| `command-manager` | Command CRUD | Command 생성, 수정, 삭제, 검토 |
| `sax-architect` | 패키지 설계 | 구조, 설계, 아키텍처 |
| `compliance-checker` | 규칙 검증 | 검증, 준수, 위반 |

### Skills

| Skill | 내용 | 관련 키워드 |
|-------|------|------------|
| `package-validator` | 패키지 구조 검증 | 검증, 구조 확인, validate |
| `version-manager` | 버저닝 자동화 | 버전, 릴리스, CHANGELOG |
| `package-sync` | 패키지 동기화 | 동기화, sync |
| `package-deploy` | 패키지 배포 | 배포, deploy, 설치 |
| `sax-help` | 도움말 | 도움말, help, 사용법 |
| `feedback` | 피드백 수집 | 피드백, 버그, 제안 |

## 중복 검토 규칙

### 규칙 정의 중복

**체크 대상**: 새로 추가/수정되는 규칙

| 체크 항목 | 비교 대상 | 위반 조건 |
|----------|----------|----------|
| Orchestrator 규칙 | `sax-core/PRINCIPLES.md` 섹션 3 | 동일/유사 규칙 존재 |
| Agent 규칙 | `sax-core/PRINCIPLES.md` 섹션 4 | 동일/유사 규칙 존재 |
| Skill 규칙 | `sax-core/PRINCIPLES.md` 섹션 5 | 동일/유사 규칙 존재 |
| 메시지 포맷 | `sax-core/MESSAGE_RULES.md` | 동일 포맷 정의 |
| 패키지 구조 | `sax-core/PACKAGING.md` | 동일 구조 정의 |

### Agent/Skill 정의 중복

**체크 대상**: 새로 추가되는 Agent/Skill

| 체크 항목 | 비교 대상 | 위반 조건 |
|----------|----------|----------|
| Agent 이름 | 모든 패키지의 `agents/` | 동일 이름 존재 |
| Skill 이름 | 모든 패키지의 `skills/` | 동일 이름 존재 |
| Agent 역할 | 기존 Agent 역할 | 역할 중복 |
| Skill 기능 | 기존 Skill 기능 | 기능 중복 |

### SoT (Single Source of Truth) 원칙

**핵심**: 동일한 정보는 **단 하나의 위치**에만 존재해야 함

| 정보 유형 | SoT 위치 | 참조 방식 |
|----------|---------|----------|
| SAX 핵심 원칙 | `sax-core/PRINCIPLES.md` | `@import` 또는 링크 참조 |
| 메시지 규칙 | `sax-core/MESSAGE_RULES.md` | `@import` 또는 링크 참조 |
| 팀 규칙 | `sax-core/TEAM_RULES.md` | `@import` 또는 링크 참조 |
| 패키지 버전 | 각 패키지 `VERSION` 파일 | 직접 읽기 |

## 검증 절차

### 1. 신규 문서 추가 시

```bash
# 1. 유사 문서 검색
grep -r "{keyword}" sax-core/ agents/ skills/

# 2. 기존 문서와 내용 비교
diff new_document.md existing_document.md

# 3. SoT 위반 검토
# - 동일 규칙이 복수 위치에 정의되어 있는가?
# - 기존 문서를 확장하는 것이 더 적절한가?
```

### 2. 기존 문서 수정 시

```bash
# 1. 해당 내용을 참조하는 다른 문서 검색
grep -r "{modified_content}" .

# 2. 영향 범위 분석
# - 수정으로 인해 다른 문서와 충돌이 발생하는가?
# - 참조 문서들의 업데이트가 필요한가?
```

## 패키지별 문서 구조

### sax-core

```text
sax-core/
├── PRINCIPLES.md      # SAX 핵심 원칙 (SoT)
├── MESSAGE_RULES.md   # 메시지 규칙 (SoT)
├── PACKAGING.md       # 패키지 구조 (SoT)
├── TEAM_RULES.md      # 팀 규칙 (SoT)
└── README.md          # 개요
```

### sax-meta

```text
sax-meta/
├── CLAUDE.md          # 패키지 설정
├── VERSION            # 버전
├── agents/            # Agent 정의
├── skills/            # Skill 정의
├── commands/          # Command 정의
└── CHANGELOG/         # 변경 이력
```

### sax-po / sax-next

```text
sax-{package}/
├── CLAUDE.md          # 패키지 설정
├── VERSION            # 버전
├── agents/            # Agent 정의
├── skills/            # Skill 정의
├── commands/          # Command 정의
└── CHANGELOG/         # 변경 이력
```
