# process

> 자동 생성: semo context sync (2026-03-15T09:24:59.832Z)


## bot-info-sharing

봇 간 정보 공유: #bot-ops에서 멘션 질의. 태그: [bot:info-req], [bot:info-res], [bot:info-unknown]. 누구에게 물을지 모르면 SemiClaw에게 먼저.


## bot-pipeline-workflow

봇 파이프라인 전체 워크플로우. PlanClaw(기획)→DesignClaw(선택)→WorkClaw/InfraClaw(병렬)→ReviewClaw(리뷰)→Garden승인(인프라PR)→배포→E2E. 라벨 기반 폴링 자동화.


## calendar-routine

매일 오전 10시 오늘+내일 일정 확인→참석자 리마인드 DM. 어제 미팅 후 참석자에게 결과 물어보기.


## github-workflow

봇 간 인계는 GitHub 이슈 라벨+폴링 방식만 사용. Slack 직접 멘션 인계 금지.

_metadata: {"type":"rule","applies_to":["semiclaw","workclaw","planclaw","reviewclaw","infraclaw"]}_


## github-workflow-process

작업 인계: 요청 접수→SemiClaw GitHub 이슈 생성+bot:* 라벨→담당 봇 폴링 감지→작업 수행. Projects 보드 등록 필수. 권한 문제 시 bot:blocked 라벨.


## memory-lifecycle

메모리 3계층 관리. Hot(memory/*.md, 5-14일)→Vector(KB pgvector, ~3개월)→Archive(archived=true, 영구보존). 매일 00:00 최적화 크론. 봇은 발화 시 Hot→Vector 순서로 검색, Vector Hit시 Hot 승격. (2026-03-08 Garden 지시)


## team-checkin

매일 평일 12~18시 하루 2~3명 DM 안부 체크인. 크론잡: 13:00, 15:30. 특이사항 발견 시 Reus 보고.


## weekly-report

매주 금요일 14:00 주간 리포트→#개발사업팀. 매주 목요일 14:00 담당자별 컨텍스트 DM 수집.


## wishket-crawl

매일 9:00 위시캣 프로젝트 크롤링→40점 이상→Slack 전송 (#wishket-alert, @yeomso). 현재 BASIC 등급.
