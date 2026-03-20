# decision

> 자동 생성: semo context sync (2026-03-20T09:00:34.837Z)


## 배경

인증 기능 붙이면 개발 지연. 일단 report.semicolon 등 별도 서비스로 빠르게 배포해 회의용 보고서로 활용 시작.
어느 정도 완성되면 팀 소개 사이트 어드민 섹션으로 통합 예정.


## 회의

[3월 3/4 정기 회고&회의](https://github.com/semicolon-devteam/command-center/discussions/227)


## 담당자

@Yeomsoyam (개발), @reus-jeon (인프라 배포)


## 템플릿

```markdown
####### ADR-XXX: 결정 제목

**날짜**: YYYY-MM-DD
**상태**: Proposed | Accepted | Deprecated

######## 배경
결정이 필요한 이유

######## 결정
선택한 방안

######## 근거
선택 이유
```


## 결정사항

SEO 대시보드를 별도 레포로 먼저 배포, 완성 후 팀 소개 사이트 어드민에 통합.


## 검토된 대안

- 팀 소개 사이트에 바로 붙이기: 로그인·인증 구조 복잡도 높음 — 나중에 통합으로 결정


## 결정 목록

_아직 기록된 결정이 없습니다._

---


## 2026-03-16-통합보고서-프로젝트단위-전환

###### 결정사항
통합 보고서 구성을 업무 단위에서 프로젝트 단위로 변경.
각 프로젝트 슬라이드에 마케팅 성과/재정/개발 이슈/KPI를 통합 포함.

###### 배경
개인별 업무 단위 보고는 프로젝트 관점 추적이 어렵고, 보고 자료 작성자(영록)가 의도를 이해하지 못해 반복 피드백 발생.
프로젝트 단위로 통합하면 SEO·마케팅·재정·개발을 한 슬라이드에서 파악 가능.

###### 검토된 대안
- 업무 단위(SEO 섹션, 개발 섹션 등으로 분리): 프로젝트별 전체 그림 보기 어려움 — 미채택

###### 담당자
@reus-jeon

###### 회의
[3월 3/4 정기 회고&회의](https://github.com/semicolon-devteam/command-center/discussions/227)


## 2026-03-16-백엔드모듈-전환순서-게임랜드-우선

###### 결정사항
백엔드 모듈화 전환 순서: 게임랜드 → 오피스랜드 순. 플레이랜드는 기존 코어 백엔드 유지 후 추후 전환.

###### 배경
플레이랜드는 현재 운영 중인 핵심 서비스로 리스크가 크고, 동시 작업 시 병목 발생.
게임랜드는 트래픽이 적어 1차 전환 테스트에 적합.

###### 검토된 대안
- 플레이랜드 우선: 가장 중요하지만 운영 리스크 큼 — 미채택
- 전체 동시 전환: 비현실적 — 미채택

###### 담당자
@kyago @garden92

###### 회의
[3월 3/4 정기 회고&회의](https://github.com/semicolon-devteam/command-center/discussions/227)


## 2026-03-16-셀퍼럴-테더마이닝-프로젝트-진행

###### 결정사항
셀퍼럴(테더마이닝) 프로젝트 진행 확정. SpaceCL과 협업, reus PM/PO 역할.
장기 목표: 운영권 자사 이관.

###### 배경
대표님(정대표) 요청. 기존 외주(SpaceCL)가 ~15~20% 진행한 소스 코드 인수.
SpaceCL이 거래소별 연동 경험 보유 → 속도 우위. reus가 단독 개발 대신 PM으로 전환.
현재 금액 협의 미완료, 수익 당장 발생 없음.

###### 검토된 대안
- reus 단독 개발: 가능하지만 PS 병행 시 집중력 분산 — 미채택
- 전체 자사 전환: SpaceCL 거래소 연동 노하우 없어 속도 느림 — 장기 목표로 보류

###### 담당자
@reus-jeon

###### 회의
[3월 3/4 정기 회고&회의](https://github.com/semicolon-devteam/command-center/discussions/227)


## 2026-03-16-SEO대시보드-별도배포-후통합

###### 결정사항
SEO 대시보드를 별도 레포로 먼저 배포, 완성 후 팀 소개 사이트 어드민에 통합.

###### 배경
인증 기능 붙이면 개발 지연. 일단 report.semicolon 등 별도 서비스로 빠르게 배포해 회의용 보고서로 활용 시작.
어느 정도 완성되면 팀 소개 사이트 어드민 섹션으로 통합 예정.

###### 검토된 대안
- 팀 소개 사이트에 바로 붙이기: 로그인·인증 구조 복잡도 높음 — 나중에 통합으로 결정

###### 담당자
@Yeomsoyam (개발), @reus-jeon (인프라 배포)

###### 회의
[3월 3/4 정기 회고&회의](https://github.com/semicolon-devteam/command-center/discussions/227)


## bae

Bae. 신규 엔지니어 (인프라/백엔드). 신입이지만 큰 영향력. Slack: U0A54SCQS84.


## bon

bon. 랜드/오피스 풀스택 개발 전담. core-backend 담당. Slack: U09LF7ZS5GR.


## bot-infra-polling

InfraClaw bot:infra 라벨 폴링 추가. 10분 간격. 쿼리: label:bot:infra -label:bot:in-progress -label:bot:blocked. 다른 봇 폴링과 동일 패턴. (2026-03-08)


## bot-no-promise

모든 봇: '하겠습니다' 패턴 금지. Tool call 없는 약속 금지. 한 거 보고해, 할 거 예고하지 마 (2026-02-24).


## design-workflow

디자인 산출물은 반드시 HTML 프로토타입+인터랙티브 프리뷰 먼저. Reus 승인 후에만 구현 이슈 생성. 마크다운만 작성 후 바로 이슈 생성 금지 (2026-03-01).


## dwight-k

dwight.k. 외부 협업자 (카카오모빌리티 FE). 매출지킴이 공동개발, 곧 독립. Slack: U01KNHM6PK3.


## garden

서정원 (Garden). 시스템 아키텍처/기술 통합 리드. 인프라 변경 최종 승인권. Slack: URU4UBX9R.

_metadata: {"role":"DevOps","skills":["OCI","Kubernetes","Docker","Terraform"]}_


## github-workflow

봇 간 인계는 GitHub 이슈 라벨+폴링 방식만 사용. Slack 직접 멘션 인계 전면 금지 (2026-02-20).


## gitops-only

InfraClaw 인프라 작업은 GitOps Only. semi-colon-ops(K8S)/core-terraform(VM)/actions-template(CI/CD)/semi-colon-apps(앱배포) PR 필수. OCI/k8s 명령어는 모니터링만. 유일한 직접작업=OCI Vault 등록. (2026-03-08 Garden 지시)


## goni

Goni. 오피스 프로젝트 서비스 운영/QA. Slack: U09NRR79YCW.


## harry-lee

Harry Lee. 시니어 FE (쿠팡/유니티 출신). 정치판 오너십(순수익 30% 배분). 2026-02-10 합류. 코파운더 아님. Slack: U08PB15P4AV.


## infra-change-control

인프라 변경은 Garden 승인 필수. 모니터링/진단은 자유, 변경(코드/배포/시크릿)은 승인 후. 공용 레포 단독 수정 금지 (2026-02-18).


## infra-pr-review-flow

InfraClaw PR 플로우: InfraClaw→PR생성→ReviewClaw리뷰→Garden승인요청→Merge. (2026-03-08 Garden 지시)


## issue-rr

이슈 등록: 버그/단순수정→SemiClaw 등록→WorkClaw 인계. 기획 필요→PlanClaw 기획→이슈 생성→WorkClaw. 한 기능에 한 이슈, 중복 금지.


## kai

Kai. 견습 엔지니어. celeb-map 작업. Slack: U0A4W1U0BAN.


## kb-usage-logging

KB 사용 로깅+신뢰평가 시스템. semo.kb_usage_log 테이블에 봇별 호출 이력 자동 기록 (bot_id, used_by, query, channel, trust_level). 신뢰평가 4단계: high(85%+)/medium(70-84%)/low(50-69%)/unreliable(50% 미만). 매일 09:00 KST #bot-ops 리포트 크론. 환경변수: KB_BOT_ID, KB_CHANNEL, KB_REQUESTED_BY. (2026-03-08 Garden 요청)


## kyago

강용준 (kyago). 백엔드 리더. ServiceMaker MVP 완료. Slack: U02G8542V9U.


## memory-arch-improvement

메모리 아키텍처 4대 개선 (2026-03-08, Garden 제안 / Reus 승인): 1) 동기 승격 - Vector→Hot 즉시 승격, 크론은 누락 체크 보조용. 2) UUID 기반 중복 방지 - HTML 코멘트 형식으로 UUID 포함, [Project:][Topic:] 태그 필수. 3) Deep Search - --deep 플래그로 아카이브 포함 검색. 4) Hot 메모리 태깅 - 프로젝트/토픽 분류 필수. 적용: 전 봇 AGENTS.md, kb-cli.js, 크론. DB에 uuid 컬럼 추가.


## oci-deploy

2026-03-02: 신규 프로젝트는 Vercel 대신 OCI 환경 기반 배포로 전환.

_metadata: {"scope":"infra","decided_at":"2026-03-02","decided_by":"reus"}_


## planclaw-scope-distribution

PlanClaw 스코프 분배 기준: 변경 대상 레포로 판단. projects/*→bot:spec-ready(WorkClaw), semi-colon-ops/core-terraform/actions-template/semi-colon-apps→bot:infra(InfraClaw), 양쪽→둘다 병렬. (2026-03-08)


## reus

전준영 (Reus). 프론트 리드/협업 매니저, 팀 리더. 전체 프로젝트 관리, 의사결정. Slack: URSQYUNQJ.

_metadata: {"role":"CTO","skills":["TypeScript","Kotlin","React Native","Terraform","AI"]}_


## reviewclaw-merge

ReviewClaw는 직접 머지하지 않음. Approve 후 담당자에게 머지 승인 요청. 담당자 모르면 SemiClaw에게 확인 (2026-03-04).


## roki

노영록 (Roki). 서비스총괄/그로스 디렉터. 링크타/매출지킴이 담당. Slack: U08P11ZQY04.


## security-contract

계약/금액 정보는 업무 채널에서 절대 언급 금지. 리더 DM 또는 개발사업팀 채널에서만.


## semo-claude-md-test

SEMO CLAUDE.md에 OpenClaw 봇팀 ↔ Core DB 동기화 목적 섹션 추가 검증 (2026-03-15). semo context push 동작 테스트용.


## slack-output-rule

최종 결과만 Slack에 보고. 중간 과정/예고성 메시지 금지. 1작업=1메시지. 위반 시 에스컬레이션 (2026-02-19).


## thread-reply

채널에서 메시지 답변 시 기본적으로 스레드(reply)로 달 것 (2026-02-18).


## yeomso

염현준 (Yeomso). 디자인총괄/UI·UX, CMO/마케팅 전권, SI 매니저. 크몽/위시캣/숨고 관리. 본업 있음(18시 퇴근, 20~21시부터 팀 업무). Slack: U01KH8V6ZHP.
