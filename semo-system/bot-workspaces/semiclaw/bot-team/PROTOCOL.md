# 🔗 봇간 통신 프로토콜 v1.0

## 원칙
1. SemiClaw = 중앙 허브. 모든 태스크는 SemiClaw를 거쳐 분배
2. 봇은 자기 메시지에 응답하지 않음
3. 동일 태스크 최대 5회 왕복 후 에스컬레이션
4. 서브에이전트(PlanClaw, DesignClaw, GrowthClaw)는 SemiClaw 내부에서만 실행

## 태스크 요청
```
@봇이름 [TASK] {설명}
[PROJECT] {프로젝트명}
[PRIORITY] high | medium | low
[ISSUE] {GitHub 이슈 번호}
[DEPENDS_ON] {선행 태스크 or none}
[SPEC] {스펙 요약 or 링크}
```

## 결과 보고
```
@SemiClaw [DONE] {태스크 설명}
[RESULT] {결과 요약}
[ARTIFACTS] {PR URL, 문서 링크, 배포 URL 등}
[NEXT] {다음 추천 액션 or none}
```

## 에러/블로커 보고
```
@SemiClaw [BLOCKED] {태스크 설명}
[REASON] {블로커 상세}
[NEED] {필요한 것 — 사람 확인, 권한, 정보 등}
```

## 채널 규칙
- `proj-*` 채널: 봇간 통신 허용 (allowBots: true)
- `개발사업팀`: 봇 보고만 (봇간 대화 금지)
- `_reus`: 봇 운영/테스트

## 금지 사항
- 계약/금액 정보를 프로젝트 채널에서 언급 금지
- 대외비 프로젝트(랜드) 정보를 외부 채널에서 언급 금지
- 봇이 사람 행세 금지 — 항상 봇임을 명시
