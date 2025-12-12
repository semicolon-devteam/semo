#!/usr/bin/env node
/**
 * SEMO Token Generator
 *
 * CI/CD에서 실행되어 암호화된 토큰을 생성합니다.
 *
 * 사용법:
 *   SEMO_ENCRYPTION_KEY=xxx SEMO_SLACK_BOT_TOKEN=xoxb-xxx node scripts/generate-tokens.js
 *
 * 출력:
 *   src/tokens.generated.ts 파일 생성
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function encrypt(text, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const keyBuffer = Buffer.from(key.padEnd(32, "0").slice(0, 32));
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

function main() {
  const encryptionKey = process.env.SEMO_ENCRYPTION_KEY;
  const slackToken = process.env.SEMO_SLACK_BOT_TOKEN;
  const githubToken = process.env.SEMO_GITHUB_APP_TOKEN || "";

  if (!encryptionKey) {
    console.error("Error: SEMO_ENCRYPTION_KEY environment variable is required");
    process.exit(1);
  }

  if (!slackToken) {
    console.error("Error: SEMO_SLACK_BOT_TOKEN environment variable is required");
    process.exit(1);
  }

  const encryptedSlack = encrypt(slackToken, encryptionKey);
  const encryptedGithub = githubToken ? encrypt(githubToken, encryptionKey) : "";

  const content = `/**
 * SEMO Encrypted Team Tokens
 *
 * 이 파일은 CI/CD에서 자동 생성되었습니다.
 * 직접 수정하지 마세요.
 *
 * Generated: ${new Date().toISOString()}
 */

// 암호화된 팀 공용 토큰
export const ENCRYPTED_TOKENS = {
  // Slack Bot Token (Semicolon Notifier)
  SLACK_BOT_TOKEN: "${encryptedSlack}",

  // GitHub App Token (Team Bot)
  GITHUB_APP_TOKEN: "${encryptedGithub}",
};

// 토큰 존재 여부 확인
export function hasEncryptedToken(name: keyof typeof ENCRYPTED_TOKENS): boolean {
  return !!ENCRYPTED_TOKENS[name];
}
`;

  const outputPath = path.join(__dirname, "..", "src", "tokens.generated.ts");
  fs.writeFileSync(outputPath, content);

  console.log(`[SEMO] Encrypted tokens generated: ${outputPath}`);
  console.log(`[SEMO] Slack token: ${encryptedSlack.slice(0, 20)}...`);
  if (encryptedGithub) {
    console.log(`[SEMO] GitHub token: ${encryptedGithub.slice(0, 20)}...`);
  }
}

main();
