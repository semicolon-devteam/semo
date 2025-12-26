/**
 * SEMO Hooks Encrypted Tokens
 *
 * 이 파일은 CI/CD에서 자동 생성되었습니다.
 * 직접 수정하지 마세요.
 *
 * Generated: 2025-12-26T06:00:00.000Z
 */

// 암호화된 팀 공용 토큰
export const ENCRYPTED_TOKENS = {
  // SEMO DB Password (Long-term Memory)
  DB_PASSWORD: "04d72d37732634bb407c04a05a895ca2:5e997819332002a13c2e571da066c0964757b4e67e9cd6b659717dc524046a5f",

  // Slack Bot Token (Semicolon Notifier)
  SLACK_BOT_TOKEN: "150a91936d06cd5b8e479d813915a8d9:30e834222b47bad7988a4157acc4ee49fc0477acbe1bca5823cd2b8732f043468e8a0297817709b8db74853904697902a8768bcef673bdfc7c73ae9c2a73d8d4",
};

// 토큰 존재 여부 확인
export function hasEncryptedToken(name: keyof typeof ENCRYPTED_TOKENS): boolean {
  return !!ENCRYPTED_TOKENS[name];
}
