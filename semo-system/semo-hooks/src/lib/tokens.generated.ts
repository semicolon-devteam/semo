/**
 * SEMO Hooks Encrypted Tokens
 *
 * 이 파일은 CI/CD에서 자동 생성되었습니다.
 * 직접 수정하지 마세요.
 *
 * Generated: 2025-12-25T13:47:42.512Z
 */

// 암호화된 팀 공용 토큰
export const ENCRYPTED_TOKENS = {
  // SEMO DB Password (Long-term Memory)
  DB_PASSWORD: "04d72d37732634bb407c04a05a895ca2:5e997819332002a13c2e571da066c0964757b4e67e9cd6b659717dc524046a5f",
};

// 토큰 존재 여부 확인
export function hasEncryptedToken(name: keyof typeof ENCRYPTED_TOKENS): boolean {
  return !!ENCRYPTED_TOKENS[name];
}
