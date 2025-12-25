#!/bin/bash
#
# semo-hooks 설치 스크립트
#
# 사용법: ./scripts/install.sh
#
# 이 스크립트는 Claude Code의 hooks 설정을 자동으로 구성합니다.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$(dirname "$SCRIPT_DIR")"
SETTINGS_FILE="$HOME/.claude/settings.local.json"

echo "🔧 semo-hooks 설치 시작..."

# 1. 빌드 확인
if [ ! -f "$HOOKS_DIR/dist/index.js" ]; then
  echo "📦 빌드 실행 중..."
  cd "$HOOKS_DIR"
  npm install
  npm run build
fi

# 2. settings.local.json 생성/업데이트
echo "📝 Claude Code 설정 업데이트 중..."

HOOKS_CMD="node $HOOKS_DIR/dist/index.js"

# jq가 설치되어 있는지 확인
if ! command -v jq &> /dev/null; then
  echo "❌ jq가 설치되어 있지 않습니다. 수동으로 설정해주세요."
  echo ""
  echo "설정 파일: $SETTINGS_FILE"
  echo ""
  echo "추가할 내용:"
  cat << EOF
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "$HOOKS_CMD session-start",
            "timeout": 10
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "$HOOKS_CMD user-prompt",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "$HOOKS_CMD stop",
            "timeout": 10
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "$HOOKS_CMD session-end",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
EOF
  exit 1
fi

# 기존 설정 백업
if [ -f "$SETTINGS_FILE" ]; then
  cp "$SETTINGS_FILE" "$SETTINGS_FILE.bak"
  echo "📋 기존 설정 백업: $SETTINGS_FILE.bak"
  EXISTING=$(cat "$SETTINGS_FILE")
else
  mkdir -p "$(dirname "$SETTINGS_FILE")"
  EXISTING="{}"
fi

# hooks 설정 생성
HOOKS_CONFIG=$(cat << EOF
{
  "SessionStart": [
    {
      "matcher": "",
      "hooks": [
        {
          "type": "command",
          "command": "$HOOKS_CMD session-start",
          "timeout": 10
        }
      ]
    }
  ],
  "UserPromptSubmit": [
    {
      "matcher": "",
      "hooks": [
        {
          "type": "command",
          "command": "$HOOKS_CMD user-prompt",
          "timeout": 5
        }
      ]
    }
  ],
  "Stop": [
    {
      "matcher": "",
      "hooks": [
        {
          "type": "command",
          "command": "$HOOKS_CMD stop",
          "timeout": 10
        }
      ]
    }
  ],
  "SessionEnd": [
    {
      "matcher": "",
      "hooks": [
        {
          "type": "command",
          "command": "$HOOKS_CMD session-end",
          "timeout": 10
        }
      ]
    }
  ]
}
EOF
)

# 설정 병합
MERGED=$(echo "$EXISTING" | jq --argjson hooks "$HOOKS_CONFIG" '.hooks = $hooks')
echo "$MERGED" > "$SETTINGS_FILE"

echo ""
echo "✅ semo-hooks 설치 완료!"
echo ""
echo "📁 설정 파일: $SETTINGS_FILE"
echo ""
echo "🔐 DB 연결 설정 (둘 중 하나 선택):"
echo ""
echo "  [옵션 A] 암호화된 토큰 생성 (권장 - 팀 배포용):"
echo "    SEMO_DB_PASSWORD='your-password' npm run generate-tokens"
echo ""
echo "  [옵션 B] 환경 변수 직접 설정 (개인 개발용):"
echo "    export SEMO_DB_PASSWORD='your-password'"
echo ""
echo "🔍 디버그 모드 (선택):"
echo "  export SEMO_HOOKS_DEBUG=true"
echo ""
