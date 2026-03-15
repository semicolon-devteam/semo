/**
 * SEMO Encrypted Team Tokens
 *
 * 이 파일은 CI/CD에서 자동 생성됩니다.
 * 직접 수정하지 마세요.
 *
 * 생성 방법: npm run generate-tokens
 */

// 암호화된 팀 공용 토큰
// CI/CD에서 실제 암호화된 값으로 대체됨
export const ENCRYPTED_TOKENS = {
  // Slack Bot Token (Semicolon Notifier)
  SLACK_BOT_TOKEN: process.env.SEMO_ENCRYPTED_SLACK_TOKEN || "",

  // GitHub App Token (Team Bot) - 필요시 추가
  GITHUB_APP_TOKEN: process.env.SEMO_ENCRYPTED_GITHUB_TOKEN || "",
};

// 토큰 존재 여부 확인
export function hasEncryptedToken(name: keyof typeof ENCRYPTED_TOKENS): boolean {
  return !!ENCRYPTED_TOKENS[name];
}
