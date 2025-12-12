/**
 * SEMO Token Encryption Module
 *
 * 팀 공용 토큰을 안전하게 암호화/복호화합니다.
 * - 빌드 시: CI/CD에서 토큰을 암호화하여 tokens.ts 생성
 * - 런타임: 암호화된 토큰을 복호화하여 사용
 */

import crypto from "crypto";

// 암호화 키 (32바이트 = 256비트)
// 빌드 시 환경변수로 주입, 런타임에는 내장된 키 사용
const ENCRYPTION_KEY =
  process.env.SEMO_ENCRYPTION_KEY || "semo-default-key-for-development!!";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

/**
 * 문자열을 AES-256-CBC로 암호화
 * @param text 암호화할 문자열
 * @returns IV:암호화된데이터 형식의 hex 문자열
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

/**
 * 암호화된 문자열을 복호화
 * @param encryptedText IV:암호화된데이터 형식의 hex 문자열
 * @returns 복호화된 원본 문자열
 */
export function decrypt(encryptedText: string): string {
  try {
    const [ivHex, encryptedHex] = encryptedText.split(":");
    if (!ivHex || !encryptedHex) {
      console.error("[SEMO] Invalid encrypted token format");
      return "";
    }

    const iv = Buffer.from(ivHex, "hex");
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("[SEMO] Token decryption failed:", error);
    return "";
  }
}
