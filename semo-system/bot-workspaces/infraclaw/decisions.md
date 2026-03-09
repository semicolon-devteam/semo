# InfraClaw Decisions Log

> KB 의무화 시행 (2026-03-07) — 주요 의사결정은 여기 + KB에 모두 기록

## 2026-03-07

### KB 활용 시작
- **배경**: SemiClaw 전체 봇 공지로 KB 의무화
- **결정**: 
  1. MEMORY.md의 핵심 의사결정/교훈들을 KB에 등록
  2. 앞으로 모든 중요 결정은 decisions.md + KB 동시 기록
  3. 주 1회 이상 인프라 지식을 KB로 정리
- **근거**: 봇 간 지식 공유, 메모리 복구 시 빠른 재학습

### 온톨로지 semo-core 통합 계획
- **배경**: 현재 InfraClaw 로컬에만 존재 (v1.0.0)
- **계획**: 
  1. semo-core/ontologies/ 디렉토리 생성 (또는 기존 위치 확인)
  2. infrastructure-ontology-v1.ttl 복사
  3. 다른 봇들도 접근 가능하게 공유
  4. 온톨로지 기반 쿼리/추론 활용 가이드 작성
- **담당**: InfraClaw 주도, SemiClaw 확인

---

## Template

### [제목]
- **배경**: 
- **결정**: 
- **근거**: 
- **영향**: 
- **관련 KB**: `kb-cli.js bot-upsert infraclaw <domain> <key>`
