# decision

> 자동 생성: semo context sync (2026-03-15T09:24:59.819Z)


## bot-infra-polling

InfraClaw bot:infra 라벨 폴링 추가. 10분 간격. 쿼리: label:bot:infra -label:bot:in-progress -label:bot:blocked. 다른 봇 폴링과 동일 패턴. (2026-03-08)


## bot-no-promise

모든 봇: '하겠습니다' 패턴 금지. Tool call 없는 약속 금지. 한 거 보고해, 할 거 예고하지 마 (2026-02-24).


## design-workflow

디자인 산출물은 반드시 HTML 프로토타입+인터랙티브 프리뷰 먼저. Reus 승인 후에만 구현 이슈 생성. 마크다운만 작성 후 바로 이슈 생성 금지 (2026-03-01).


## github-workflow

봇 간 인계는 GitHub 이슈 라벨+폴링 방식만 사용. Slack 직접 멘션 인계 전면 금지 (2026-02-20).


## gitops-only

InfraClaw 인프라 작업은 GitOps Only. semi-colon-ops(K8S)/core-terraform(VM)/actions-template(CI/CD)/semi-colon-apps(앱배포) PR 필수. OCI/k8s 명령어는 모니터링만. 유일한 직접작업=OCI Vault 등록. (2026-03-08 Garden 지시)


## infra-change-control

인프라 변경은 Garden 승인 필수. 모니터링/진단은 자유, 변경(코드/배포/시크릿)은 승인 후. 공용 레포 단독 수정 금지 (2026-02-18).


## infra-pr-review-flow

InfraClaw PR 플로우: InfraClaw→PR생성→ReviewClaw리뷰→Garden승인요청→Merge. (2026-03-08 Garden 지시)


## issue-rr

이슈 등록: 버그/단순수정→SemiClaw 등록→WorkClaw 인계. 기획 필요→PlanClaw 기획→이슈 생성→WorkClaw. 한 기능에 한 이슈, 중복 금지.


## kb-usage-logging

KB 사용 로깅+신뢰평가 시스템. semo.kb_usage_log 테이블에 봇별 호출 이력 자동 기록 (bot_id, used_by, query, channel, trust_level). 신뢰평가 4단계: high(85%+)/medium(70-84%)/low(50-69%)/unreliable(50% 미만). 매일 09:00 KST #bot-ops 리포트 크론. 환경변수: KB_BOT_ID, KB_CHANNEL, KB_REQUESTED_BY. (2026-03-08 Garden 요청)


## memory-arch-improvement

메모리 아키텍처 4대 개선 (2026-03-08, Garden 제안 / Reus 승인): 1) 동기 승격 - Vector→Hot 즉시 승격, 크론은 누락 체크 보조용. 2) UUID 기반 중복 방지 - HTML 코멘트 형식으로 UUID 포함, [Project:][Topic:] 태그 필수. 3) Deep Search - --deep 플래그로 아카이브 포함 검색. 4) Hot 메모리 태깅 - 프로젝트/토픽 분류 필수. 적용: 전 봇 AGENTS.md, kb-cli.js, 크론. DB에 uuid 컬럼 추가.


## oci-deploy

2026-03-02: 신규 프로젝트는 Vercel 대신 OCI 환경 기반 배포로 전환.

_metadata: {"scope":"infra","decided_at":"2026-03-02","decided_by":"reus"}_


## planclaw-scope-distribution

PlanClaw 스코프 분배 기준: 변경 대상 레포로 판단. projects/*→bot:spec-ready(WorkClaw), semi-colon-ops/core-terraform/actions-template/semi-colon-apps→bot:infra(InfraClaw), 양쪽→둘다 병렬. (2026-03-08)


## reviewclaw-merge

ReviewClaw는 직접 머지하지 않음. Approve 후 담당자에게 머지 승인 요청. 담당자 모르면 SemiClaw에게 확인 (2026-03-04).


## security-contract

계약/금액 정보는 업무 채널에서 절대 언급 금지. 리더 DM 또는 개발사업팀 채널에서만.


## slack-output-rule

최종 결과만 Slack에 보고. 중간 과정/예고성 메시지 금지. 1작업=1메시지. 위반 시 에스컬레이션 (2026-02-19).


## thread-reply

채널에서 메시지 답변 시 기본적으로 스레드(reply)로 달 것 (2026-02-18).
