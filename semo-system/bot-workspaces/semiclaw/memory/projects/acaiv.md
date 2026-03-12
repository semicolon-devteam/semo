# ACAIV — Automate Create AI Video

> Slack 채널: #proj-acaiv (`C0ALEM94AQG`)
> 생성일: 2026-03-10
> GitHub: `semicolon-devteam/proj-acaiv` (private)
> 상태: 기획 단계

## 개요
바나나 AI (bbanana.ai) 유사 서비스 — AI 자동 영상 생성 플랫폼
- **용도**: 팀 내부용 (외부 서비스 X, 5~10명 사용)
- **목적**: 유튜브 등 콘텐츠 영상을 AI로 자동 생성

## 레퍼런스
- 바나나 AI: https://www.bbanana.ai/
- 유튜브 리뷰 영상 스크립트 분석 완료 (PlanClaw)

## 파이프라인 (스크립트 분석 기반)
1. 대본 생성 → Gemini API
2. TTS 음성 → ElevenLabs
3. 이미지 생성 → Flux Pro
4. 이미지→영상 변환 → Luma AI
5. 최종 편집/합성 → FFmpeg 등

## 인프라 결정
- **클라우드(OCI) X → 물리 서버(GPU 워크스테이션) O** (InfraClaw 분석)
- 현재 OKE 클러스터 리소스 부족 (7.6 vCPU/12.8GB → 14+/56GB 필요)
- 팀 내부용이므로 물리 서버가 1년 이후 비용 우위
- **권장 스펙**: Ryzen 9 7900X / 32GB DDR5 / RTX 4070
- **네트워크**: Tailscale VPN
- **배포**: Docker Compose

## 비용 추정
- 영상 1개 (40초): ~$5.30 (~530 크레딧)
- 영상 1개 (10분): ~$20~27
- 물리 서버 초기 비용: ~$1,000~1,500
- 손익분기점: ~1년 (vs OCI 클라우드 $122~162/월)

## 참여 봇
- PlanClaw: 기획, 스크립트 분석, 이슈 작성
- InfraClaw: 인프라 분석
- GrowthClaw: bbanana.ai 경쟁사 분석
- SemiClaw: 조율/인계

## 다음 단계
- [ ] PlanClaw이 GitHub 이슈 작성 (서비스 구축 계획)
- [ ] 물리 서버 구매 결정
- [ ] MVP 개발 (Phase 1: 4주 예상)
