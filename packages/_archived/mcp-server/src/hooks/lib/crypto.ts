/**
 * SEMO Token Encryption Module
 *
 * mcp-server/crypto.ts와 동일한 구현
 * 팀 공용 토큰을 안전하게 암호화/복호화합니다.
 */

import crypto from 'crypto';

// 암호화 키 (32바이트 = 256비트)
// 팀 공용 토큰용 고정 키 (패키지에 내장 - 난독화 목적)
const TEAM_TOKEN_KEY = 'semo-team-token-key-2024-secure';

// 사용자 커스텀 키 (환경변수로 주입, 개인 토큰용)
const ENCRYPTION_KEY = process.env.SEMO_ENCRYPTION_KEY || TEAM_TOKEN_KEY;

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * 문자열을 AES-256-CBC로 암호화
 * @param text 암호화할 문자열
 * @returns IV:암호화된데이터 형식의 hex 문자열
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

/**
 * 암호화된 문자열을 복호화
 * @param encryptedText IV:암호화된데이터 형식의 hex 문자열
 * @returns 복호화된 원본 문자열
 */
export function decrypt(encryptedText: string): string {
  try {
    const [ivHex, encryptedHex] = encryptedText.split(':');
    if (!ivHex || !encryptedHex) {
      return '';
    }

    const iv = Buffer.from(ivHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    return '';
  }
}

/**
 * 암호화된 Slack 토큰 로드
 */
function loadEncryptedSlackToken(): string {
  try {
    // CI/CD에서 생성된 암호화 토큰 (배포 패키지용)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const generated = require('./tokens.generated.js');
    if (generated.ENCRYPTED_TOKENS?.SLACK_BOT_TOKEN) {
      const decrypted = decrypt(generated.ENCRYPTED_TOKENS.SLACK_BOT_TOKEN);
      if (decrypted) return decrypted;
    }
  } catch {
    // tokens.generated.js 없음 - 로컬 개발 환경
  }
  return '';
}

/**
 * Slack Bot Token 가져오기 (우선순위: 환경변수 > 암호화된 팀 토큰)
 */
export function getSlackBotToken(): string {
  // 1. 환경변수 우선 (로컬 개발/테스트용)
  if (process.env.SEMO_SLACK_BOT_TOKEN) {
    return process.env.SEMO_SLACK_BOT_TOKEN;
  }
  // 2. 암호화된 팀 토큰 (배포 패키지용)
  return loadEncryptedSlackToken();
}

/**
 * Slack 토큰 사용 가능 여부
 */
export function isSlackEnabled(): boolean {
  return !!getSlackBotToken();
}
