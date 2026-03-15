# Workflows — GrowthClaw

## 이미지 생성 & Slack 업로드 워크플로우

### 개요
OpenAI Image Gen skill을 사용해 이미지를 생성하고 Slack에 업로드하는 전체 프로세스.

### 사전 요구사항
- OpenAI API 키: `~/.openclaw-growthclaw/workspace/.env`에 `OPENAI_API_KEY` 설정
- OpenAI Image Gen skill: `/Users/reus/.nvm/versions/node/v24.12.0/lib/node_modules/openclaw/skills/openai-image-gen/`
- Slack 권한: `files:write` scope (2026-03-13 추가됨)

### 1단계: 이미지 생성

```bash
cd /Users/reus/.openclaw-growthclaw/workspace

# 환경변수 로드
export OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d '=' -f2)

# 이미지 생성
python3 /Users/reus/.nvm/versions/node/v24.12.0/lib/node_modules/openclaw/skills/openai-image-gen/scripts/gen.py \
  --prompt "your prompt here" \
  --count 1 \
  --model gpt-image-1 \
  --size 1024x1024 \
  --out-dir ./test-images
```

**모델 옵션:**
- `gpt-image-1`: DALL-E 3 (고품질, 권장)
- `gpt-image-2`: DALL-E 2 (저렴함)

**크기 옵션:**
- `1024x1024` (정사각형, 기본값)
- `1024x1792` (세로)
- `1792x1024` (가로)

**출력:**
- 파일명 형식: `{index:03d}-{slug}.png`
- 예시: `001-a-cute-cat-in-space.png`

### 2단계: 허용된 경로로 복사

```bash
# message tool이 접근 가능한 경로로 복사
cp ./test-images/001-xxx.png ~/.openclaw/media/
```

**허용된 경로:**
- `~/.openclaw/media/` (권장)
- `~/.openclaw/agents/`
- 실제 temp 디렉토리 (`/private/tmp` 등, symlink 아님)

**제약사항:**
- ❌ `/tmp` (macOS에서 symlink이므로 차단됨)
- ❌ workspace 직접 경로 (보안 정책상 차단)

### 3단계: Slack 업로드

#### 방법 1: filePath (권장)
`files:write` 권한이 있을 때 사용.

```bash
message --action send \
  --target C0AFBQ209E0 \
  --message "이미지 설명" \
  --filePath "/Users/reus/.openclaw/media/001-xxx.png"
```

#### 방법 2: buffer (대안)
권한 없을 때 또는 data URL 방식 선호 시.

```bash
message --action send \
  --target C0AFBQ209E0 \
  --message "이미지 설명" \
  --buffer "file:///Users/reus/.openclaw/media/001-xxx.png" \
  --filename "001-xxx.png" \
  --contentType "image/png"
```

**buffer 파라미터 형식:**
- `file://` URL: 로컬 파일 경로
- `data:` URL: base64 인코딩 (작은 파일만, 3MB+ 비권장)

### 4단계: 정리 (선택)

```bash
# 테스트 이미지 삭제
rm ~/.openclaw/media/001-xxx.png
rm -rf ./test-images
```

### 전체 통합 예시

```bash
#!/bin/bash
# 이미지 생성 & Slack 업로드 원라이너

PROMPT="a futuristic robot reading a book in a cozy library"
CHANNEL="C0AFBQ209E0"  # #bot-ops

cd /Users/reus/.openclaw-growthclaw/workspace
export OPENAI_API_KEY=$(grep OPENAI_API_KEY .env | cut -d '=' -f2)

# 생성
python3 /Users/reus/.nvm/versions/node/v24.12.0/lib/node_modules/openclaw/skills/openai-image-gen/scripts/gen.py \
  --prompt "$PROMPT" \
  --count 1 \
  --model gpt-image-1 \
  --out-dir ./temp-img

# 복사
IMAGE=$(ls -t ./temp-img/*.png | head -1)
cp "$IMAGE" ~/.openclaw/media/latest-gen.png

# 업로드 (message tool 사용)
# message --action send --target "$CHANNEL" --message "$PROMPT" --filePath ~/.openclaw/media/latest-gen.png

# 정리
rm -rf ./temp-img
```

### 테스트 이력

#### 2026-03-13: 초기 구축
- ✅ OpenAI Image Gen skill 설치
- ✅ "a cute cat in space" 생성 성공 (2.3MB PNG)
- ✅ buffer 방식으로 업로드 성공 (file:// URL)
- ✅ `files:write` 권한 추가 (Reus)
- ✅ filePath 방식으로 업로드 성공

### 트러블슈팅

#### 문제: `missing_scope` 에러
**원인:** Slack bot에 `files:write` 권한 없음  
**해결:** Slack API Dashboard → OAuth & Permissions → Bot Token Scopes에서 `files:write` 추가 후 봇 재설치

#### 문제: `policy violation: path not allowed`
**원인:** 제한된 경로 사용 (`/tmp`, workspace 직접 경로 등)  
**해결:** `~/.openclaw/media/`로 파일 복사 후 업로드

#### 문제: `base64 string too large`
**원인:** 3MB+ 이미지를 data URL로 인코딩 시 파라미터 크기 초과  
**해결:** `file://` URL 방식 사용 또는 filePath 파라미터 사용

### 참고 문서
- OpenAI Image Gen skill: `/Users/reus/.nvm/versions/node/v24.12.0/lib/node_modules/openclaw/skills/openai-image-gen/SKILL.md`
- Creative Toolkit skill: `~/.openclaw-growthclaw/workspace/skills/creative-toolkit/SKILL.md` (MCP 문서, OpenClaw 미지원)
- Message tool 문서: OpenClaw docs (message 섹션)

### 향후 개선 아이디어
- [ ] 이미지 생성 자동화 스크립트 (bash wrapper)
- [ ] 프롬프트 템플릿 라이브러리 구축
- [ ] 생성 이미지 자동 태깅/분류 시스템
- [ ] Creative Toolkit skill 활성화 (OpenClaw MCP 지원 시)
