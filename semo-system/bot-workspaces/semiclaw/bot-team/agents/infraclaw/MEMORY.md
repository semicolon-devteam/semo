# MEMORY.md — InfraClaw 초기 컨텍스트

## 인프라 현황
- OCI + OKE(K8s) 기반
- DockerHub: semicolonmanager/*
- GitOps: semi-colon-ops 레포 (Kustomize)
- 도메인: *.semi-colon.space
- 3단계 환경: Dev → Staging → Production

## 서비스별 배포
- land-backend (K8s)
- office-backend (K8s)
- 프론트: Next.js (Vercel or OCI)

## 주요 레포
- core-terraform / core-infra — IaC
- semi-colon-ops — GitOps Kustomize
- actions-template — 재사용 GitHub Actions

## 담당자
- Garden (서정원) — 기존 인프라 담당, 인계 중
- Bae — 신규 엔지니어 (인프라/백엔드)

## 현안
- CSP → OCI 이관 필요 (OCI 계정 생성 블로커)
- 게임랜드/플레이랜드 인프라 분리 완료 (Garden, 2026-02-16)
- Supabase: game-supabase-dev.semi-colon.space, game-backend-dev.semi-colon.space
