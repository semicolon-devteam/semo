# SEMO Operations - Monitor Package

> 서비스 현황, 이슈 트래킹, 모니터링

## Package Info

- **Package**: ops/monitor
- **Version**: [../VERSION](../VERSION) 참조
- **Audience**: 운영팀, 개발팀, PM

---

## 핵심 역할

| 기능 | 설명 |
|------|------|
| 서비스 현황 | 운영 중인 서비스 상태 모니터링 |
| SI 현황 | SI 진행 중인 프로젝트 상태 |
| 이슈 트래킹 | 운영 이슈 추적 및 공유 |
| 장애 대응 | 장애 발생 시 알림 및 대응 |
| 상태 리포트 | 서비스 상태 리포트 생성 |

---

## Routing Keywords

| 키워드 | 트리거 |
|--------|--------|
| 현황, status | 서비스 현황 조회 |
| 상태, state | 상태 확인 |
| 이슈, issue | 이슈 트래킹 |
| 장애, incident | 장애 대응 |
| 모니터링, monitoring | 모니터링 작업 |
| SI, 프로젝트 | SI 프로젝트 현황 |

---

## Agents

| Agent | 역할 |
|-------|------|
| orchestrator | monitor 작업 라우팅 |
| service-monitor | 서비스 상태 모니터링 |

---

## Skills

| Skill | 역할 |
|-------|------|
| check-service-status | 서비스 상태 확인 |
| list-active-issues | 활성 이슈 목록 |
| generate-status-report | 상태 리포트 생성 |
| alert-incident | 장애 알림 |
| track-si-progress | SI 프로젝트 진행도 |
| health-check | 환경 검증 |

---

## 모니터링 대상

### 서비스 목록

| 서비스 | 유형 | 상태 체크 방식 |
|--------|------|---------------|
| cm-* | 커뮤니티 서비스 | Health endpoint |
| ms-* | 마이크로서비스 | Health endpoint |
| core-backend | 코어 백엔드 | Health endpoint |

### SI 프로젝트

| 구분 | 추적 항목 |
|------|----------|
| 진행 중 | 마일스톤, 진행률, 블로커 |
| 완료 | 인수인계, 운영 전환 |

---

## 상태 리포트 형식

```markdown
## 서비스 현황 리포트

### 운영 서비스
| 서비스 | 상태 | 마지막 배포 | 이슈 |
|--------|------|------------|------|
| cm-office | 🟢 정상 | 2024-12-15 | 없음 |
| core-backend | 🟢 정상 | 2024-12-14 | 1건 |

### SI 프로젝트
| 프로젝트 | 진행률 | 마일스톤 | 블로커 |
|----------|--------|----------|--------|
| Project A | 75% | Phase 2 | 없음 |

### 이슈 현황
- 총 활성 이슈: 3건
- 긴급: 0건
- 일반: 3건
```

---

## References

- [ops 레이어](../CLAUDE.md)
- [qa 패키지](../qa/CLAUDE.md)
- [improve 패키지](../improve/CLAUDE.md)
