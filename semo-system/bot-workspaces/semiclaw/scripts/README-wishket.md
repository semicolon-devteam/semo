# 위시켓 프로젝트 크롤링 & 스코어링

## 개요
위시켓 외주 프로젝트를 크롤링하고 Semicolon 팀 스택 기준으로 스코어링하여 40점 이상 프로젝트를 Slack으로 전송합니다.

## 파일 구조
- `wishket-score.js` - 프로젝트 스코어링 로직
- `wishket-crawler.py` - Python 크롤러 (Playwright 필요, 현재 미사용)
- `wishket-daily.sh` - 일일 실행 스크립트 (mock 데이터)
- `wishket-cache.json` - 캐시 파일 (중복 방지)

## 스코어링 기준

### 기술 스택 점수 (최대 200점+)
| 기술 | 점수 | 카테고리 |
|---|---|---|
| React Native, Kotlin, Spring Boot, TypeScript | 15점 | 핵심 |
| React, Node.js, Next.js, JavaScript, Supabase, AI, LLM | 12점 | 핵심 |
| Java, PostgreSQL, Vue.js, AWS, ChatGPT, Terraform | 10점 | 주요 |
| MySQL, MongoDB, Redis, Docker, Kubernetes, Python, Django, Flask, GraphQL | 8점 | 보조 |
| Angular, Tailwind, HTML, CSS, REST API | 5-6점 | 기본 |

### 도메인 가산점 (최대 30점+)
- AI: 10점
- 핀테크, SaaS: 9점
- 교육, 헬스케어: 8점
- 커머스: 7점
- 엔터테인먼트, 게임: 6-7점

### 기타 가산점
- 예산 1000만원 이상: +10점
- 예산 500~1000만원: +5점
- 경쟁률 5명 미만: +8점
- 경쟁률 5~10명: +4점

### 합격 기준
- **40점 이상** 프로젝트만 Slack 전송

## 사용법

### 1. 테스트 실행 (Mock 데이터)
```bash
cd scripts
echo '[{...}]' | node wishket-score.js
```

### 2. 실제 크롤링 (수동)
위시켓은 로그인이 필요하므로 아래 방법 중 선택:

#### 옵션 A: Playwright 크롤링 v2 (로그인 + 등급 필터링, 권장)
```bash
# Python 가상환경 생성 (최초 1회)
python3 -m venv venv
source venv/bin/activate
pip install playwright
python -m playwright install chromium

# 환경 변수 설정 (선택사항, 기본값: reus@semi-colon.space / team-semicolon)
export WISHKET_EMAIL="reus@semi-colon.space"
export WISHKET_PASSWORD="team-semicolon"

# 크롤링 실행 (v2: 로그인 + BASIC 등급 필터링)
python wishket-crawler-v2.py > projects.json
cat projects.json | node wishket-score.js
```

**v2 크롤러 특징:**
- ✅ 자동 로그인 (계정: reus@semi-colon.space)
- ✅ BASIC 등급 필터링 (BOOST/PRO/PRIME 전용 프로젝트 제외)
- ✅ 목록 화면에서 등급 배지 체크
- ✅ 실제 지원 가능한 프로젝트만 크롤링

**v1 크롤러 (wishket-crawler.py):**
- 로그인 없음
- 등급 필터링 없음
- 공개 프로젝트만 크롤링

#### 옵션 B: 수동 복사
1. https://www.wishket.com/project/ 접속 (로그인)
2. 브라우저 개발자 도구 (F12) 열기
3. Network 탭에서 `project` API 호출 찾기
4. Response JSON 복사 → `projects.json` 저장
5. `cat projects.json | node wishket-score.js` 실행

#### 옵션 C: 위시켓 API (API 키 필요 시)
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://www.wishket.com/api/projects \
     | node wishket-score.js
```

### 3. Slack 전송
```bash
# 환경 변수 설정 (이미 OpenClaw에서 설정됨)
export SLACK_BOT_TOKEN="xoxb-..."

# 스코어링 + Slack 전송
cat projects.json | node wishket-score.js | \
  xargs -0 -I {} openclaw message send \
    --channel=slack \
    --target=C0ABAE680PR \
    --message="<@U01KH8V6ZHP> {}"
```

## Cron 설정

매일 오전 9시 실행:
```bash
openclaw cron add --job='{
  "name": "위시켓 일일 크롤링",
  "schedule": {"kind": "cron", "expr": "0 9 * * *", "tz": "Asia/Seoul"},
  "payload": {"kind": "agentTurn", "message": "위시켓 외주(도급) 프로젝트를 크롤링하고 Semicolon 팀 스택 기준으로 스코어링해서, 40점 이상 프로젝트를 <@U01KH8V6ZHP> 멘션과 함께 C0ABAE680PR 채널에 보내줘. 기존 포맷(점수, 예산, 기간, 경쟁률, 기술스택, 도메인 태그) 유지. 금액 정보는 위시캣 공개 정보이므로 채널 공유 OK."},
  "sessionTarget": "isolated",
  "delivery": {"mode": "none"}
}'
```

## 실제 크롤링 구현 시 고려사항

### 1. 로그인 처리
위시켓은 프로젝트 상세를 보려면 로그인이 필요합니다:
- Playwright로 자동 로그인
- 쿠키/세션 저장하여 재사용
- 또는 위시켓 API 키 발급 (가능하다면)

### 2. 중복 방지
```javascript
// wishket-cache.json에 최근 본 프로젝트 ID 저장
const cache = JSON.parse(fs.readFileSync('wishket-cache.json'));
const newProjects = projects.filter(p => !cache.includes(p.id));
fs.writeFileSync('wishket-cache.json', JSON.stringify([...cache, ...newProjects.map(p => p.id)]));
```

### 3. Rate Limiting
크롤링 간격 조절:
```javascript
await page.waitForTimeout(2000); // 2초 대기
```

### 4. 에러 처리
```javascript
try {
  await page.goto('https://www.wishket.com/project/');
} catch (err) {
  console.error('크롤링 실패:', err);
  // Slack 알림 전송
}
```

## 문제 해결

### Playwright 설치 오류
```bash
# macOS
brew install python@3.11
python3.11 -m venv venv
source venv/bin/activate
pip install playwright
```

### Slack 전송 실패
- `SLACK_BOT_TOKEN` 환경 변수 확인
- 채널 ID 확인: C0ABAE680PR
- 봇 권한 확인: `chat:write`, `users:read`

### 크롤링 데이터 없음
- 위시켓 로그인 상태 확인
- HTML 구조 변경 여부 확인 (셀렉터 수정)
- Network 탭에서 실제 API 엔드포인트 확인

## 향후 개선사항
1. [ ] 실제 위시켓 API/크롤링 구현
2. [ ] 중복 프로젝트 필터링
3. [ ] 프로젝트 카테고리 자동 태깅
4. [ ] 스코어링 가중치 동적 조정
5. [ ] 주간/월간 리포트 자동 생성
6. [ ] 관심 프로젝트 북마크 기능
