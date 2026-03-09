#!/bin/bash
# KB 배치 등록 스크립트 (rate limit 고려)

KB_CLI="/Users/reus/Desktop/Sources/semicolon/projects/semo/semo-system/bot-workspaces/semiclaw/scripts/kb-cli.js"
SEMO_DIR="/Users/reus/Desktop/Sources/semicolon/projects/semo"

cd "$SEMO_DIR"

# 2. 디자인 시안 웹 공유 방법
echo "[$(date)] 2. web-share-method 등록..."
node "$KB_CLI" bot-upsert designclaw decision web-share-method "디자인 시안은 반드시 웹 URL로 공유 (Reus와 물리적으로 다른 PC). 우선순위: 1) CodePen/JSFiddle/CodeSandbox 업로드 → 웹 URL 2) Playwright로 확인 + 스크린샷 3) Canvas 렌더링. 절대 금지: file:// 경로 또는 workspace 상대 경로 공유. 본인이 먼저 Playwright로 렌더링 검증 후 공유 (2026-03-01, Reus 재교육, NON-NEGOTIABLE)"
sleep 25

# 3. 디자인 스펙 작성 방식
echo "[$(date)] 3. spec-writing 등록..."
node "$KB_CLI" bot-upsert designclaw decision spec-writing "디자인 스펙 작성 시: 1) 이슈 코멘트에 Tailwind CSS 클래스 + JSX 컴포넌트 예시 포함 2) 완료 조건 체크리스트 포함 3) 와이어프레임 이미지 링크 (Imgur 업로드 방식)"
sleep 25

# 4. 이미지 공유 방법
echo "[$(date)] 4. image-sharing 등록..."
node "$KB_CLI" bot-upsert designclaw process image-sharing "Slack bot token에 files:write 스코프 없음. 대안: Imgur 익명 업로드 (curl -X POST https://api.imgur.com/3/image -H \"Authorization: Client-ID 546c25a59c58ad7\"). 또는 Chrome headless 렌더링: Google Chrome --headless=new --screenshot=output.png --window-size=WxH file://path.html"
sleep 25

# 5. Playwright 활용법
echo "[$(date)] 5. playwright-usage 등록..."
node "$KB_CLI" bot-upsert designclaw process playwright-usage "디자인 확인 시 Playwright 활용: browser tool로 스크린샷/스냅샷 캡처. UI 직접 확인 필수. 디자인 피드백 시 본인이 먼저 렌더링해서 검증 후 공유. (2026-02-23, Reus 지시)"
sleep 25

# 6. Canvas 활용법
echo "[$(date)] 6. canvas-usage 등록..."
node "$KB_CLI" bot-upsert designclaw process canvas-usage "HTML 프로토타입을 Canvas로 렌더링하여 프리뷰: canvas present <html-file-path> 또는 canvas eval \"<html>...</html>\". 디자인 시안 공유 시 활용."
sleep 25

# 7. Slack 메시지 발송 원칙
echo "[$(date)] 7. slack-messaging 등록..."
node "$KB_CLI" bot-upsert designclaw decision slack-messaging "Slack에는 최종 결과만 보고 (PR 생성/완료, 리뷰 결과, 블로커). 중간 과정 절대 금지 (클론, install, 빌드, 분석 등). 예고성 메시지 금지 (~하겠다, ~시작한다). 1 작업 = 1 메시지. 서브에이전트 작업 중 상태 업데이트 금지. (2026-02-19, Reus 지시, NON-NEGOTIABLE)"

echo "[$(date)] 모든 항목 등록 완료!"
