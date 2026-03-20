# infra

> 자동 생성: semo context sync (2026-03-20T09:00:34.845Z)


## bot-architecture

8개 봇 팀: SemiClaw(PM), WorkClaw(개발), PlanClaw(기획), ReviewClaw(리뷰), DesignClaw(디자인), GrowthClaw(그로스), InfraClaw(인프라), ReusClaw(별개PC). 각각 독립 OpenClaw 인스턴스.


## central-db

PostgreSQL 16. Docker container pg16-primary on 10.0.0.91. Bastion: 152.70.244.169 (opc@semi-vpn). DB: appdb, User: app. pgvector 0.8.0 설치. SSH key: oci_dev_rsa.

_metadata: {"type":"database","environment":"production"}_


## github-org

GitHub org: semicolon-devteam. Projects 보드 #1. gh-aw (GitHub Agentic Workflows) 엔진 사용. 봇별 팀 멘션 설정.


## semo-kb

KB(Knowledge Base): semo 스키마, PostgreSQL. knowledge_base(공통), bot_knowledge(봇별), ontology(도메인 정의). Voyage-3 임베딩(1024dim), HNSW 인덱스.


## slack-channels

#bot-ops(C0AFBQ209E0): 봇 간 소통. #개발사업팀(C020RQTNPFY): 리더 보고. #platform-land(C0AEFRMN0E9): 랜드 개발.


## tech-stack

주요 기술 스택: TypeScript, React/Next.js (FE), Kotlin/Spring Boot (BE), React Native (모바일), HCL/Terraform (인프라), Supabase, PostgreSQL, pgvector.
